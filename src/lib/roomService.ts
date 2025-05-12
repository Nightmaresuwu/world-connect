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
    onSnapshot
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