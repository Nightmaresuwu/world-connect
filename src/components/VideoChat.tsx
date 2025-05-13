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
    Room,
    subscribeToRoomMessages,
    subscribeToOffers,
    subscribeToAnswers,
    subscribeToUserIceCandidates,
    findOrCreateRoom,
    createRoomWithUser
} from '../lib/roomService';
import { reportUser } from '../lib/reportService';
import { CircularProgress } from '@mui/material';

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
    const [isLoading, setIsLoading] = useState(true);
    const [isChatting, setIsChatting] = useState(false);
    const [connected, setConnected] = useState(false);

    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
    const localStreamRef = useRef<MediaStream | null>(null);
    const chatMessagesUnsubscribeRef = useRef<(() => void) | null>(null);
    const usersUnsubscribeRef = useRef<(() => void) | null>(null);
    const roomUnsubscribeRef = useRef<(() => void) | null>(null);
    const iceCandidatesUnsubscribeRef = useRef<(() => void) | null>(null);
    const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);

    // Update the main useEffect that runs on component mount
    useEffect(() => {
        // Set user online status when component mounts
        const setUserOnline = async () => {
            if (user?.uid) {
                await updateUserOnlineStatus(user.uid, true);
                console.log("User set as online:", user.uid);
            }
        };

        // Initialize component
        const initialize = async () => {
            await setUserOnline();
            await initializeLocalVideo();
            fetchAvailableUsers();
        };

        initialize();

        // Set up subscription to users
        const unsubUsers = subscribeToUsers((users) => {
            const filteredUsers = users.filter(u => u.uid !== user?.uid);
            setAvailableUsers(filteredUsers);
            setIsLoading(false);
        });

        // Clean up on unmount
        return () => {
            console.log("Cleaning up VideoChat component");

            // Close any active connections
            endChat();

            // Stop local stream tracks
            if (localStreamRef.current) {
                localStreamRef.current.getTracks().forEach(track => {
                    track.stop();
                });
                localStreamRef.current = null;
            }

            // Unsubscribe from users
            if (unsubUsers) unsubUsers();
        };
    }, [user]);

    // Initialize WebRTC
    useEffect(() => {
        if (chatState === ChatState.IDLE) {
            stopLocalStream();
            return;
        }

        const initializeLocalVideo = async () => {
            try {
                console.log("Initializing local video stream");
                const constraints = {
                    audio: true,
                    video: {
                        width: { ideal: 640 },
                        height: { ideal: 480 }
                    }
                };

                const stream = await navigator.mediaDevices.getUserMedia(constraints);
                localStreamRef.current = stream;

                if (localVideoRef.current) {
                    localVideoRef.current.srcObject = stream;
                    console.log("Setting local video stream");
                    await localVideoRef.current.play().catch(err => {
                        console.error("Error playing local video:", err);
                    });
                }

                console.log("Local video initialized successfully");
            } catch (error) {
                console.error('Error accessing media devices:', error);
                setError('Camera or microphone access denied. Please check your permissions.');
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

    const startRandomChat = async () => {
        setIsChatting(true);
        setIsSearching(true);
        setChatMessages([]);
        setError(null);

        try {
            // Make sure we have access to camera and mic first
            if (!localStreamRef.current) {
                console.log("Getting local media stream");
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: true,
                    audio: true
                });

                localStreamRef.current = stream;

                if (localVideoRef.current) {
                    localVideoRef.current.srcObject = stream;
                    await localVideoRef.current.play().catch(err => {
                        console.error("Error playing local video:", err);
                    });
                }
            }

            // Search for partner
            console.log("Searching for chat partner");
            let roomData;

            if (selectedUserId) {
                console.log(`Connecting with selected user: ${selectedUserId}`);
                roomData = await createRoomWithUser(user.uid, selectedUserId);
                setIsInitiator(true);
            } else {
                console.log("Finding random partner");
                roomData = await findOrCreateRoom(user.uid);
                setIsInitiator(roomData.isInitiator);
            }

            setCurrentRoomId(roomData.roomId);
            setPartnerUid(roomData.partnerId);

            console.log("Room created/joined:", roomData);
            console.log("Is initiator:", roomData.isInitiator);

            // Set up peer connection
            await initiatePeerConnection();

            // Subscribe to necessary signaling channels
            const unsubscribeOffers = await subscribeToRoomOffers(roomData.roomId);
            const unsubscribeAnswers = await subscribeToRoomAnswers(roomData.roomId);
            const unsubscribePartnerCandidates = await subscribeToIceCandidates(
                roomData.roomId,
                roomData.partnerId
            );

            // Subscribe to room messages
            const unsubscribeMessages = await subscribeToRoomMessages(
                roomData.roomId,
                (message) => {
                    setChatMessages(prevMessages => [...prevMessages, message]);
                }
            );

            // Store unsubscribe functions
            unsubscribeRefs.current = [
                unsubscribeOffers || (() => { }),
                unsubscribeAnswers || (() => { }),
                unsubscribePartnerCandidates || (() => { }),
                unsubscribeMessages || (() => { })
            ];

            // Update UI state
            setIsSearching(false);
            setConnected(true);

        } catch (error) {
            console.error("Error starting chat:", error);
            setError('Failed to start chat. Please try again.');
            setIsSearching(false);
            closePeerConnection();
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

    // Handle room offers subscription
    const subscribeToRoomOffers = async (roomId: string) => {
        if (!roomId) return;

        console.log("Subscribing to room offers for room:", roomId);

        return subscribeToOffers(roomId, async (offer) => {
            console.log("Received offer:", offer);

            // Only process the offer if we are not the initiator
            if (!isInitiator && peerConnectionRef.current) {
                try {
                    const peerConnection = peerConnectionRef.current;

                    if (peerConnection.signalingState !== 'stable') {
                        console.log("Resetting connection for new offer");
                        await closePeerConnection();
                        await initiatePeerConnection();
                    }

                    console.log("Setting remote description from offer");
                    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

                    console.log("Creating answer");
                    const answer = await peerConnection.createAnswer();

                    console.log("Setting local description with answer");
                    await peerConnection.setLocalDescription(answer);

                    // Wait briefly for ICE gathering
                    await new Promise<void>(resolve => setTimeout(resolve, 1000));

                    // Send answer to the room
                    await addAnswerToRoom(roomId, peerConnection.localDescription as RTCSessionDescription);
                    console.log("Answer sent to room");
                } catch (error) {
                    console.error("Error handling offer:", error);
                    setError("Failed to process connection offer. Please try again.");
                }
            }
        });
    };

    // Handle room answers subscription
    const subscribeToRoomAnswers = async (roomId: string) => {
        if (!roomId) return;

        console.log("Subscribing to room answers for room:", roomId);

        return subscribeToAnswers(roomId, async (answer) => {
            console.log("Received answer:", answer);

            // Only process the answer if we are the initiator
            if (isInitiator && peerConnectionRef.current) {
                try {
                    console.log("Setting remote description from answer");
                    await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(answer));
                    console.log("Remote description set successfully");
                } catch (error) {
                    console.error("Error handling answer:", error);
                    setError("Failed to process connection answer. Please try again.");
                }
            }
        });
    };

    // Handle ICE candidates subscription
    const subscribeToIceCandidates = async (roomId: string, otherUserId: string) => {
        if (!roomId || !otherUserId) return;

        console.log(`Subscribing to ICE candidates from user ${otherUserId} in room ${roomId}`);

        return subscribeToUserIceCandidates(roomId, otherUserId, async (candidate) => {
            console.log("Received ICE candidate:", candidate);

            if (peerConnectionRef.current && peerConnectionRef.current.remoteDescription) {
                try {
                    await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
                    console.log("Added remote ICE candidate");
                } catch (error) {
                    console.error("Error adding remote ICE candidate:", error);
                }
            } else {
                // Queue candidates if remote description isn't set yet
                console.log("Queuing ICE candidate - remote description not set");
                pendingCandidatesRef.current.push(candidate);
            }
        });
    };

    // Process any queued ICE candidates
    const processPendingCandidates = async () => {
        if (peerConnectionRef.current && peerConnectionRef.current.remoteDescription) {
            while (pendingCandidatesRef.current.length > 0) {
                const candidate = pendingCandidatesRef.current.shift();
                if (candidate) {
                    try {
                        await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
                        console.log("Added queued ICE candidate");
                    } catch (error) {
                        console.error("Error adding queued ICE candidate:", error);
                    }
                }
            }
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
                                        onClick={startRandomChat}
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
                                        onClick={handleNextPartner}
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
                                        onClick={handleNextPartner}
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