import {
    collection,
    doc,
    addDoc,
    getDoc,
    getDocs,
    updateDoc,
    query,
    where,
    orderBy,
    Timestamp,
    onSnapshot,
    setDoc
} from "firebase/firestore";
import { db } from "./firebase";
import { UserData } from "./userService";

export interface Room {
    id: string;
    participant1Id: string;
    participant2Id: string;
    participant1?: UserData;
    participant2?: UserData;
    isActive: boolean;
    createdAt: Timestamp;
    offer?: RTCSessionDescriptionInit;
    answer?: RTCSessionDescriptionInit;
}

export interface IceCandidate {
    id?: string;
    roomId: string;
    senderId: string;
    candidate: RTCIceCandidateInit;
    timestamp: Timestamp;
}

export interface ChatMessage {
    id: string;
    roomId: string;
    senderId: string;
    content: string;
    timestamp: Timestamp;
    sender?: UserData;
}

export const roomCollection = collection(db, "rooms");
export const chatMessageCollection = collection(db, "chatMessages");
export const iceCandidateCollection = collection(db, "iceCandidates");

// Create a new room
export const createRoom = async (participant1Id: string, participant2Id: string): Promise<string | null> => {
    try {
        const roomData = {
            participant1Id,
            participant2Id,
            isActive: true,
            createdAt: Timestamp.now()
        };

        const roomRef = await addDoc(roomCollection, roomData);
        return roomRef.id;
    } catch (error) {
        console.error("Error creating room:", error);
        return null;
    }
};

// Get room by ID
export const getRoomById = async (roomId: string): Promise<Room | null> => {
    try {
        const roomDoc = await getDoc(doc(db, "rooms", roomId));

        if (roomDoc.exists()) {
            return {
                id: roomDoc.id,
                ...(roomDoc.data() as Omit<Room, "id">)
            };
        }

        return null;
    } catch (error) {
        console.error("Error getting room:", error);
        return null;
    }
};

// Update room active status
export const updateRoomStatus = async (roomId: string, isActive: boolean): Promise<boolean> => {
    try {
        await updateDoc(doc(db, "rooms", roomId), { isActive });
        return true;
    } catch (error) {
        console.error("Error updating room status:", error);
        return false;
    }
};

// Get active rooms for a user
export const getActiveRoomsForUser = async (userId: string): Promise<Room[]> => {
    try {
        const q = query(
            roomCollection,
            where("isActive", "==", true),
            where("participant1Id", "==", userId)
        );

        const q2 = query(
            roomCollection,
            where("isActive", "==", true),
            where("participant2Id", "==", userId)
        );

        const [snapshot1, snapshot2] = await Promise.all([
            getDocs(q),
            getDocs(q2)
        ]);

        const rooms: Room[] = [];

        snapshot1.forEach(doc => {
            rooms.push({ id: doc.id, ...(doc.data() as Omit<Room, "id">) });
        });

        snapshot2.forEach(doc => {
            rooms.push({ id: doc.id, ...(doc.data() as Omit<Room, "id">) });
        });

        return rooms;
    } catch (error) {
        console.error("Error getting active rooms:", error);
        return [];
    }
};

// WebRTC Signaling Functions
export const addOfferToRoom = async (roomId: string, offer: RTCSessionDescriptionInit): Promise<boolean> => {
    try {
        await updateDoc(doc(db, "rooms", roomId), { offer });
        return true;
    } catch (error) {
        console.error("Error adding offer to room:", error);
        return false;
    }
};

export const addAnswerToRoom = async (roomId: string, answer: RTCSessionDescriptionInit): Promise<boolean> => {
    try {
        await updateDoc(doc(db, "rooms", roomId), { answer });
        return true;
    } catch (error) {
        console.error("Error adding answer to room:", error);
        return false;
    }
};

export const addIceCandidate = async (
    roomId: string,
    senderId: string,
    candidate: RTCIceCandidateInit
): Promise<string | null> => {
    try {
        const candidateData: Omit<IceCandidate, 'id'> = {
            roomId,
            senderId,
            candidate,
            timestamp: Timestamp.now()
        };

        const candidateRef = await addDoc(iceCandidateCollection, candidateData);
        return candidateRef.id;
    } catch (error) {
        console.error("Error adding ICE candidate:", error);
        return null;
    }
};

export const getIceCandidatesForRoom = async (roomId: string, receiverId: string): Promise<IceCandidate[]> => {
    try {
        const q = query(
            iceCandidateCollection,
            where("roomId", "==", roomId),
            where("senderId", "!=", receiverId),
            orderBy("senderId"),
            orderBy("timestamp")
        );

        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...(doc.data() as Omit<IceCandidate, "id">)
        }));
    } catch (error) {
        console.error("Error getting ICE candidates:", error);
        return [];
    }
};

export const subscribeToRoom = (
    roomId: string,
    callback: (room: Room | null) => void
) => {
    return onSnapshot(doc(db, "rooms", roomId), (snapshot) => {
        if (snapshot.exists()) {
            callback({
                id: snapshot.id,
                ...(snapshot.data() as Omit<Room, "id">)
            });
        } else {
            callback(null);
        }
    });
};

export const subscribeToIceCandidates = (
    roomId: string,
    receiverId: string,
    callback: (candidates: IceCandidate[]) => void
) => {
    const q = query(
        iceCandidateCollection,
        where("roomId", "==", roomId),
        where("senderId", "!=", receiverId),
    );

    return onSnapshot(q, (snapshot) => {
        const candidates = snapshot.docs.map(doc => ({
            id: doc.id,
            ...(doc.data() as Omit<IceCandidate, "id">)
        }));

        callback(candidates);
    });
};

// Send a chat message
export const sendChatMessage = async (roomId: string, senderId: string, content: string): Promise<string | null> => {
    try {
        const messageData = {
            roomId,
            senderId,
            content,
            timestamp: Timestamp.now()
        };

        const messageRef = await addDoc(chatMessageCollection, messageData);
        return messageRef.id;
    } catch (error) {
        console.error("Error sending message:", error);
        return null;
    }
};

// Get chat messages for a room
export const getChatMessagesForRoom = async (roomId: string): Promise<ChatMessage[]> => {
    try {
        const q = query(
            chatMessageCollection,
            where("roomId", "==", roomId),
            orderBy("timestamp", "asc")
        );

        const snapshot = await getDocs(q);

        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...(doc.data() as Omit<ChatMessage, "id">)
        }));
    } catch (error) {
        console.error("Error getting chat messages:", error);
        return [];
    }
};

// Subscribe to chat messages for a room
export const subscribeToChatMessages = (
    roomId: string,
    callback: (messages: ChatMessage[]) => void
) => {
    const q = query(
        chatMessageCollection,
        where("roomId", "==", roomId),
        orderBy("timestamp", "asc")
    );

    return onSnapshot(q, (snapshot) => {
        const messages = snapshot.docs.map(doc => ({
            id: doc.id,
            ...(doc.data() as Omit<ChatMessage, "id">)
        }));

        callback(messages);
    });
}; 