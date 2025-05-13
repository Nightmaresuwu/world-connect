import React, { useState, useEffect, useRef } from 'react';
import { User } from 'firebase/auth';
import {
    updateUserOnlineStatus,
    getAllUsers,
    UserData,
    setAllUsersOnline,
    subscribeToUsers
} from '../lib/userService';
import {
    createRoom,
    updateRoomStatus,
    sendChatMessage,
    getChatMessagesForRoom,
    subscribeToChatMessages,
    ChatMessage,
    addOfferToRoom,
    addAnswerToRoom,
    addIceCandidate,
    subscribeToRoom,
    subscribeToIceCandidates,
    Room
} from '../lib/roomService';
import { reportUser } from '../lib/reportService';

interface VideoChatProps {
    user: User;
    userProfile?: any;
}

enum ChatState {
    IDLE = 'idle',
    SEARCHING = 'searching',
    CONNECTED = 'connected',
}

const VideoChat: React.FC<VideoChatProps> = ({ user }) => {
    const [chatState, setChatState] = useState<ChatState>(ChatState.IDLE);
    const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);
    const [partnerProfile, setPartnerProfile] = useState<UserData | null>(null);
    const [message, setMessage] = useState('');
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [availableUsers, setAvailableUsers] = useState<UserData[]>([]);
    const [isInitiator, setIsInitiator] = useState(false);

    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
    const localStreamRef = useRef<MediaStream | null>(null);
    const chatMessagesUnsubscribeRef = useRef<(() => void) | null>(null);
    const usersUnsubscribeRef = useRef<(() => void) | null>(null);
    const roomUnsubscribeRef = useRef<(() => void) | null>(null);
    const iceCandidatesUnsubscribeRef = useRef<(() => void) | null>(null);

    // Set user as online when the component mounts and fetch users
    useEffect(() => {
        console.log("Setting user as online and subscribing to user updates");
        updateUserOnlineStatus(user.uid, true);

        // Subscribe to real-time user updates
        const unsubscribe = subscribeToUsers((users) => {
            // Filter out current user
            const filteredUsers = users.filter(u => u.uid !== user.uid);
            console.log(`After filtering current user, found ${filteredUsers.length} other users`);
            setAvailableUsers(filteredUsers);
        });

        usersUnsubscribeRef.current = unsubscribe;

        // Set user as offline when component unmounts
        return () => {
            console.log("Component unmounting, setting user as offline");
            updateUserOnlineStatus(user.uid, false);
            stopLocalStream();

            if (chatMessagesUnsubscribeRef.current) {
                chatMessagesUnsubscribeRef.current();
            }

            if (usersUnsubscribeRef.current) {
                usersUnsubscribeRef.current();
            }

            if (roomUnsubscribeRef.current) {
                roomUnsubscribeRef.current();
            }

            if (iceCandidatesUnsubscribeRef.current) {
                iceCandidatesUnsubscribeRef.current();
            }
        };
    }, [user.uid]);

    // Initialize WebRTC
    useEffect(() => {
        if (chatState === ChatState.IDLE) {
            stopLocalStream();
            return;
        }

        const initializeLocalVideo = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                if (localVideoRef.current) {
                    localVideoRef.current.srcObject = stream;
                }
                localStreamRef.current = stream;

                if (chatState === ChatState.SEARCHING) {
                    // eslint-disable-next-line react-hooks/exhaustive-deps
                    searchForPartner();
                }
            } catch (error) {
                console.error('Error accessing media devices:', error);
                alert('Failed to access camera and microphone. Please check your permissions.');
                setChatState(ChatState.IDLE);
            }
        };

        initializeLocalVideo();
    }, [chatState]);

    // Subscribe to chat messages when connected
    useEffect(() => {
        if (chatState === ChatState.CONNECTED && currentRoomId) {
            // Initial fetch
            getChatMessagesForRoom(currentRoomId).then(messages => {
                setChatMessages(messages);
            });

            // Subscribe to real-time updates
            const unsubscribe = subscribeToChatMessages(currentRoomId, (messages) => {
                setChatMessages(messages);
            });

            chatMessagesUnsubscribeRef.current = unsubscribe;
        }

        return () => {
            if (chatMessagesUnsubscribeRef.current) {
                chatMessagesUnsubscribeRef.current();
            }
        };
    }, [chatState, currentRoomId]);

    // Subscribe to room changes for WebRTC signaling
    useEffect(() => {
        if (currentRoomId && chatState === ChatState.CONNECTED) {
            // Subscribe to the room for SDP offer/answer exchange
            const unsubscribeRoom = subscribeToRoom(currentRoomId, (room) => {
                if (!room) return;

                handleRoomSignaling(room);
            });

            // Subscribe to ICE candidates
            const unsubscribeICE = subscribeToIceCandidates(currentRoomId, user.uid, (candidates) => {
                if (!peerConnectionRef.current) return;

                candidates.forEach(async (candidate) => {
                    try {
                        if (candidate.candidate && peerConnectionRef.current) {
                            await peerConnectionRef.current.addIceCandidate(
                                new RTCIceCandidate(candidate.candidate)
                            );
                            console.log("Added remote ICE candidate");
                        }
                    } catch (err) {
                        console.error("Error adding received ice candidate", err);
                    }
                });
            });

            roomUnsubscribeRef.current = unsubscribeRoom;
            iceCandidatesUnsubscribeRef.current = unsubscribeICE;
        }

        return () => {
            if (roomUnsubscribeRef.current) {
                roomUnsubscribeRef.current();
            }
            if (iceCandidatesUnsubscribeRef.current) {
                iceCandidatesUnsubscribeRef.current();
            }
        };
    }, [currentRoomId, chatState, user.uid]);

    const handleRoomSignaling = async (room: Room) => {
        if (!peerConnectionRef.current) return;

        try {
            // If we are the initiator and there's an answer, set the remote description
            if (isInitiator && room.answer && !peerConnectionRef.current.currentRemoteDescription) {
                console.log("Setting remote description with answer", room.answer);
                await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(room.answer));
            }

            // If we are not the initiator and there's an offer, create and send an answer
            if (!isInitiator && room.offer && !peerConnectionRef.current.currentRemoteDescription) {
                console.log("Setting remote description with offer", room.offer);
                await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(room.offer));

                console.log("Creating answer");
                const answer = await peerConnectionRef.current.createAnswer();
                await peerConnectionRef.current.setLocalDescription(answer);

                // Send the answer to the other peer
                if (currentRoomId) {
                    await addAnswerToRoom(currentRoomId, answer);
                    console.log("Answer sent to room");
                }
            }
        } catch (err) {
            console.error("Error in handleRoomSignaling:", err);
            setError("Error establishing video connection. Please try again.");
        }
    };

    const startSearch = () => {
        console.log("Starting search for partners");
        setChatState(ChatState.SEARCHING);
    };

    const stopSearch = () => {
        if (currentRoomId) {
            updateRoomStatus(currentRoomId, false);
        }
        setChatState(ChatState.IDLE);
        setCurrentRoomId(null);
        setPartnerProfile(null);
        setChatMessages([]);
        closePeerConnection();
    };

    const searchForPartner = async () => {
        try {
            setError(null);

            // Check if we have users in our state
            if (availableUsers.length === 0) {
                // Try to refresh the list
                const users = await getAllUsers();
                // Filter out current user
                const filteredUsers = users.filter(u => u.uid !== user.uid);
                setAvailableUsers(filteredUsers);

                // Check again after refresh
                if (filteredUsers.length === 0) {
                    throw new Error("No other users are currently online. Try again later!");
                }
            }

            console.log("Selecting from available users:", availableUsers.map(u => u.username || u.email));

            // Select a random user
            const randomIndex = Math.floor(Math.random() * availableUsers.length);
            const randomUser = availableUsers[randomIndex];
            console.log("Selected random user:", randomUser.username || randomUser.email);

            // Create a room with the selected user
            const roomId = await createRoom(user.uid, randomUser.uid);

            if (roomId) {
                console.log("Room created with ID:", roomId);
                setCurrentRoomId(roomId);
                setPartnerProfile(randomUser);
                setChatState(ChatState.CONNECTED);

                // Set as initiator since we created the room
                setIsInitiator(true);

                initiatePeerConnection();
            } else {
                throw new Error("Failed to create room");
            }
        } catch (error) {
            console.error('Error searching for partner:', error);
            let errorMessage = error instanceof Error ? error.message : 'Failed to find a chat partner. Please try again.';
            setError(errorMessage);
            setChatState(ChatState.IDLE);
        }
    };

    const initiatePeerConnection = async () => {
        try {
            closePeerConnection(); // Close any existing connection

            const configuration = {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' }
                ]
            };

            const peerConnection = new RTCPeerConnection(configuration);
            peerConnectionRef.current = peerConnection;

            // Add local stream tracks to peer connection
            if (localStreamRef.current) {
                localStreamRef.current.getTracks().forEach(track => {
                    if (localStreamRef.current) {
                        peerConnection.addTrack(track, localStreamRef.current);
                    }
                });
            }

            // Handle incoming streams
            peerConnection.ontrack = (event) => {
                console.log("Received remote track", event.streams[0]);
                if (remoteVideoRef.current && event.streams[0]) {
                    remoteVideoRef.current.srcObject = event.streams[0];
                }
            };

            // Handle ICE candidates
            peerConnection.onicecandidate = async (event) => {
                if (event.candidate && currentRoomId) {
                    console.log("Generated ICE candidate", event.candidate);
                    await addIceCandidate(currentRoomId, user.uid, event.candidate);
                }
            };

            // Connection state change
            peerConnection.onconnectionstatechange = () => {
                console.log("Connection state changed:", peerConnection.connectionState);
                if (peerConnection.connectionState === 'disconnected' ||
                    peerConnection.connectionState === 'failed') {
                    setError("Connection lost. Please try again.");
                }
            };

            // Only create and send offer if we are the initiator
            if (isInitiator && currentRoomId) {
                const offer = await peerConnection.createOffer();
                await peerConnection.setLocalDescription(offer);

                // Send offer to the other peer through Firestore
                await addOfferToRoom(currentRoomId, offer);
                console.log("Offer sent to room");
            }

        } catch (error) {
            console.error('Error setting up peer connection:', error);
            setError('Failed to establish video connection. Please try again.');
        }
    };

    const closePeerConnection = () => {
        if (peerConnectionRef.current) {
            peerConnectionRef.current.close();
            peerConnectionRef.current = null;
        }
    };

    const stopLocalStream = () => {
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => {
                track.stop();
            });
            localStreamRef.current = null;
        }
    };

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!message.trim() || !currentRoomId || !partnerProfile) return;

        try {
            await sendChatMessage(currentRoomId, user.uid, message);
            setMessage('');
        } catch (error) {
            console.error('Error sending message:', error);
            setError('Failed to send message. Please try again.');
        }
    };

    const handleNextPartner = async () => {
        if (currentRoomId) {
            try {
                await updateRoomStatus(currentRoomId, false);
            } catch (error) {
                console.error('Error ending room:', error);
            }
        }

        closePeerConnection();
        setChatState(ChatState.SEARCHING);
        setCurrentRoomId(null);
        setPartnerProfile(null);
        setChatMessages([]);
    };

    const handleReportUser = async () => {
        if (!partnerProfile) return;

        const reason = prompt("Please enter the reason for reporting this user:");
        if (!reason) return;

        try {
            await reportUser(user.uid, partnerProfile.uid, reason);
            alert("User has been reported. Thank you for helping keep our community safe.");
            // End the chat after reporting
            handleNextPartner();
        } catch (error) {
            console.error('Error reporting user:', error);
            alert("Failed to report user. Please try again.");
        }
    };

    const refreshAvailableUsers = async () => {
        try {
            setError(null);
            const users = await getAllUsers();
            // Filter out current user
            const filteredUsers = users.filter(u => u.uid !== user.uid);
            setAvailableUsers(filteredUsers);

            if (filteredUsers.length === 0) {
                setError("No other users are currently online. Try again later!");
            }
        } catch (error) {
            console.error('Error refreshing users:', error);
            setError('Failed to refresh user list.');
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
                <div className="bg-gray-800 rounded-lg overflow-hidden">
                    <div className="relative aspect-video bg-black">
                        {/* Remote Video (Partner) */}
                        <video
                            ref={remoteVideoRef}
                            autoPlay
                            playsInline
                            className={`absolute inset-0 w-full h-full object-cover ${chatState !== ChatState.CONNECTED ? 'hidden' : ''}`}
                        />

                        {/* Local Video (User) */}
                        <video
                            ref={localVideoRef}
                            autoPlay
                            playsInline
                            muted
                            className={`${chatState === ChatState.CONNECTED
                                ? 'absolute bottom-4 right-4 w-1/4 h-auto rounded-lg border-2 border-blue-500 z-10'
                                : 'absolute inset-0 w-full h-full object-cover'
                                }`}
                        />

                        {/* Overlay for different states */}
                        {chatState === ChatState.IDLE && (
                            <div className="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-80">
                                <div className="text-center p-6 w-full max-w-md">
                                    <h3 className="text-2xl font-bold text-white mb-4">Ready to Connect?</h3>
                                    <p className="text-gray-300 mb-6">Click "Start" to begin meeting new people!</p>
                                    <button
                                        onClick={startSearch}
                                        className="px-6 py-3 bg-blue-600 text-white rounded-full text-lg hover:bg-blue-700 transition"
                                    >
                                        Start
                                    </button>
                                    {availableUsers.length > 0 && (
                                        <p className="mt-4 text-green-400">
                                            {availableUsers.length} user{availableUsers.length !== 1 ? 's' : ''} online
                                        </p>
                                    )}
                                    <button
                                        onClick={refreshAvailableUsers}
                                        className="mt-4 text-blue-400 hover:text-blue-300 underline"
                                    >
                                        Refresh user list
                                    </button>
                                </div>
                            </div>
                        )}

                        {chatState === ChatState.SEARCHING && (
                            <div className="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-80">
                                <div className="text-center p-6">
                                    <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
                                    <h3 className="text-2xl font-bold text-white mb-2">Finding a partner...</h3>
                                    <p className="text-gray-300 mb-6">Please wait while we connect you with someone.</p>
                                    <button
                                        onClick={stopSearch}
                                        className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Error Message */}
                        {error && (
                            <div className="absolute top-4 left-0 right-0 mx-auto w-3/4 bg-red-500 text-white p-2 rounded text-center">
                                {error}
                                <button
                                    onClick={() => setError(null)}
                                    className="ml-2 font-bold"
                                >
                                    ×
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="p-4 flex justify-between items-center">
                        <div>
                            {chatState === ChatState.CONNECTED && partnerProfile && (
                                <div className="flex items-center">
                                    <div className="h-3 w-3 bg-green-500 rounded-full mr-2"></div>
                                    <span className="text-white font-medium">
                                        Connected with: {partnerProfile.username || partnerProfile.email || 'Anonymous'}
                                    </span>
                                </div>
                            )}
                        </div>

                        <div className="flex space-x-2">
                            {chatState === ChatState.CONNECTED && (
                                <>
                                    <button
                                        onClick={handleReportUser}
                                        className="px-3 py-1 bg-yellow-600 text-white rounded text-sm hover:bg-yellow-700 transition"
                                    >
                                        Report
                                    </button>
                                    <button
                                        onClick={handleNextPartner}
                                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
                                    >
                                        Next
                                    </button>
                                    <button
                                        onClick={stopSearch}
                                        className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition"
                                    >
                                        Stop
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div className="lg:col-span-1">
                <div className="bg-gray-800 rounded-lg overflow-hidden h-full flex flex-col">
                    <div className="p-4 bg-gray-700">
                        <h3 className="text-lg font-medium text-white">Chat</h3>
                    </div>

                    <div className="flex-1 p-4 overflow-y-auto max-h-96">
                        {chatState !== ChatState.CONNECTED ? (
                            <div className="flex items-center justify-center h-full">
                                <p className="text-gray-400 text-center">
                                    {chatState === ChatState.IDLE
                                        ? 'Start a video chat to message with someone'
                                        : 'Finding someone to chat with...'}
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {chatMessages.length > 0 ? (
                                    chatMessages.map((msg) => (
                                        <div
                                            key={msg.id}
                                            className={`p-3 rounded-lg max-w-[85%] ${msg.senderId === user.uid
                                                ? 'bg-blue-600 ml-auto'
                                                : 'bg-gray-700'
                                                }`}
                                        >
                                            <p className="text-sm font-medium text-white">{msg.content}</p>
                                            <p className="text-xs text-gray-300 mt-1">
                                                {msg.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </p>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-gray-400 text-center">No messages yet. Say hello!</p>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="p-4 bg-gray-700">
                        <form onSubmit={handleSendMessage} className="flex">
                            <input
                                type="text"
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                disabled={chatState !== ChatState.CONNECTED}
                                placeholder={chatState === ChatState.CONNECTED ? "Type a message..." : "Start a chat to send messages"}
                                className="flex-1 px-4 py-2 bg-gray-600 border border-gray-600 rounded-l text-white disabled:opacity-60"
                            />
                            <button
                                type="submit"
                                disabled={chatState !== ChatState.CONNECTED || !message.trim()}
                                className="px-4 py-2 bg-blue-600 text-white rounded-r hover:bg-blue-700 transition disabled:opacity-60"
                            >
                                Send
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default VideoChat; 