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
    ChatMessage
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
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [availableUsers, setAvailableUsers] = useState<UserData[]>([]);
    const [showUsersList, setShowUsersList] = useState(false);
    const [refreshingUsers, setRefreshingUsers] = useState(false);

    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
    const localStreamRef = useRef<MediaStream | null>(null);
    const chatMessagesUnsubscribeRef = useRef<(() => void) | null>(null);
    const usersUnsubscribeRef = useRef<(() => void) | null>(null);

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
        };
    }, [user.uid]);

    // Manual refresh of users list
    const refreshUsersList = async () => {
        try {
            setRefreshingUsers(true);
            const users = await getAllUsers();
            // Filter out current user
            const filteredUsers = users.filter(u => u.uid !== user.uid);
            console.log(`After manual refresh, found ${filteredUsers.length} other users`);
            setAvailableUsers(filteredUsers);
        } catch (error) {
            console.error('Error getting users:', error);
        } finally {
            setRefreshingUsers(false);
        }
    };

    const makeAllUsersOnline = async () => {
        try {
            setLoading(true);
            await setAllUsersOnline();
            await refreshUsersList();
            setLoading(false);
            setError("All users have been set as online for testing");
            setTimeout(() => setError(null), 3000);
        } catch (error) {
            console.error('Error setting all users online:', error);
            setError('Failed to set all users online');
            setLoading(false);
        }
    };

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

    const startSearch = () => {
        console.log("Starting search for partners");
        if (availableUsers.length === 0) {
            setError("No other users found. Invite your friends to join the app!");
            return;
        }
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
            setLoading(true);

            // Check if we have users in our state
            if (availableUsers.length === 0) {
                // Try to refresh the list
                await refreshUsersList();

                // Check again after refresh
                if (availableUsers.length === 0) {
                    throw new Error("No other users are registered. Invite your friends to join!");
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
                initiatePeerConnection();
            } else {
                throw new Error("Failed to create room");
            }
        } catch (error) {
            console.error('Error searching for partner:', error);
            let errorMessage = error instanceof Error ? error.message : 'Failed to find a chat partner. Please try again.';
            setError(errorMessage);
            setChatState(ChatState.IDLE);
        } finally {
            setLoading(false);
        }
    };

    const connectWithUser = async (selectedUser: UserData) => {
        try {
            setLoading(true);
            setChatState(ChatState.SEARCHING);

            console.log("Connecting with selected user:", selectedUser.username || selectedUser.email);

            // Create a room with the selected user
            const roomId = await createRoom(user.uid, selectedUser.uid);

            if (roomId) {
                console.log("Room created with ID:", roomId);
                setCurrentRoomId(roomId);
                setPartnerProfile(selectedUser);
                setChatState(ChatState.CONNECTED);
                initiatePeerConnection();
                setShowUsersList(false);
            } else {
                throw new Error("Failed to create room with selected user");
            }
        } catch (error) {
            console.error('Error connecting with user:', error);
            setError('Failed to connect with selected user. Please try again.');
            setChatState(ChatState.IDLE);
        } finally {
            setLoading(false);
        }
    };

    const initiatePeerConnection = async () => {
        try {
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
                if (remoteVideoRef.current && event.streams[0]) {
                    remoteVideoRef.current.srcObject = event.streams[0];
                }
            };

            // Create offer
            const offer = await peerConnection.createOffer();
            await peerConnection.setLocalDescription(offer);

            // In a real implementation, you would send this offer to the partner through a signaling server
            // For demo purposes, we're just simulating a connection

            // Normally, you would receive an answer from the partner
            // For demo purposes, we're creating a fake remote stream
            const fakeRemoteStream = new MediaStream();
            if (remoteVideoRef.current) {
                remoteVideoRef.current.srcObject = fakeRemoteStream;
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

    // Component to show available users
    const AvailableUsersList = () => {
        if (availableUsers.length === 0) {
            return (
                <div className="text-center py-8">
                    <p className="text-gray-400">No other users are registered.</p>
                    <p className="text-gray-400 mt-2">Invite your friends to join!</p>
                </div>
            );
        }

        return (
            <div className="py-4">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-semibold text-white">
                        Available Users ({availableUsers.length})
                    </h3>
                    <button
                        onClick={refreshUsersList}
                        disabled={refreshingUsers}
                        className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition disabled:opacity-60"
                    >
                        {refreshingUsers ? 'Refreshing...' : 'Refresh'}
                    </button>
                </div>
                <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                    {availableUsers.map(user => (
                        <div key={user.uid} className="flex justify-between items-center p-3 bg-gray-700 rounded">
                            <div className="flex items-center">
                                {user.avatarUrl ? (
                                    <img
                                        src={user.avatarUrl}
                                        alt={user.username || 'User'}
                                        className="w-10 h-10 rounded-full mr-3 object-cover"
                                        onError={(e) => {
                                            const target = e.target as HTMLImageElement;
                                            target.src = 'https://via.placeholder.com/40?text=User';
                                        }}
                                    />
                                ) : (
                                    <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center mr-3">
                                        <span className="text-white font-medium">
                                            {(user.username || 'U').charAt(0).toUpperCase()}
                                        </span>
                                    </div>
                                )}
                                <div>
                                    <p className="font-medium text-white">{user.username || user.email || 'Anonymous'}</p>
                                    {user.gender && (
                                        <p className="text-xs text-gray-400">{user.gender}</p>
                                    )}
                                </div>
                            </div>
                            <button
                                onClick={() => connectWithUser(user)}
                                className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition"
                            >
                                Connect
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        );
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
                                    <p className="text-gray-300 mb-6">Click below to start meeting new people or see who's registered!</p>
                                    <div className="flex flex-col space-y-3 sm:flex-row sm:space-y-0 sm:space-x-3 justify-center">
                                        <button
                                            onClick={startSearch}
                                            className="px-6 py-3 bg-blue-600 text-white rounded-full text-lg hover:bg-blue-700 transition"
                                        >
                                            Random Match
                                        </button>
                                        <button
                                            onClick={() => setShowUsersList(!showUsersList)}
                                            className="px-6 py-3 bg-green-600 text-white rounded-full text-lg hover:bg-green-700 transition"
                                        >
                                            {showUsersList ? 'Hide Users' : 'Show Users'}
                                        </button>
                                    </div>

                                    {showUsersList && (
                                        <div className="mt-6 bg-gray-800 p-4 rounded-lg max-h-96 overflow-y-auto text-left">
                                            <div className="flex justify-between mb-4">
                                                <div className="text-sm text-gray-300">
                                                    {availableUsers.length === 0 ? (
                                                        <span>No other users found</span>
                                                    ) : (
                                                        <span>Click on a user to connect directly</span>
                                                    )}
                                                </div>
                                                <button
                                                    onClick={makeAllUsersOnline}
                                                    disabled={loading}
                                                    className="px-3 py-1 bg-yellow-600 text-white text-sm rounded hover:bg-yellow-700 transition disabled:opacity-60"
                                                >
                                                    {loading ? 'Processing...' : 'Refresh Users'}
                                                </button>
                                            </div>
                                            <AvailableUsersList />
                                        </div>
                                    )}
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
                                        End Chat
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