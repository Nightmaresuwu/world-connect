import {
    doc,
    getDoc,
    setDoc,
    updateDoc,
    collection,
    query,
    where,
    getDocs,
    Timestamp
} from "firebase/firestore";
import { db } from "./firebase";

export interface UserData {
    uid: string;
    email: string;
    username?: string;
    avatarUrl?: string;
    gender?: string;
    interests?: string;
    isOnline?: boolean;
    lastActive?: Timestamp;
    createdAt?: Timestamp;
}

export const userCollection = collection(db, "users");

// Get user by ID
export const getUserById = async (uid: string): Promise<UserData | null> => {
    try {
        const userDoc = await getDoc(doc(db, "users", uid));
        if (userDoc.exists()) {
            return { uid, ...(userDoc.data() as Omit<UserData, "uid">) };
        }
        return null;
    } catch (error) {
        console.error("Error getting user:", error);
        return null;
    }
};

// Create or update user
export const upsertUser = async (userData: UserData): Promise<boolean> => {
    try {
        const userRef = doc(db, "users", userData.uid);
        const userDoc = await getDoc(userRef);

        if (userDoc.exists()) {
            // Update existing user
            const { uid, createdAt, ...updateData } = userData;
            await updateDoc(userRef, {
                ...updateData,
                lastActive: Timestamp.now()
            });
        } else {
            // Create new user
            await setDoc(userRef, {
                ...userData,
                createdAt: Timestamp.now(),
                lastActive: Timestamp.now(),
                isOnline: false
            });
        }

        return true;
    } catch (error) {
        console.error("Error upserting user:", error);
        return false;
    }
};

// Update user online status
export const updateUserOnlineStatus = async (uid: string, isOnline: boolean): Promise<boolean> => {
    try {
        await updateDoc(doc(db, "users", uid), {
            isOnline,
            lastActive: Timestamp.now()
        });
        return true;
    } catch (error) {
        console.error("Error updating online status:", error);
        return false;
    }
};

// Get all online users
export const getOnlineUsers = async (): Promise<UserData[]> => {
    try {
        const q = query(userCollection, where("isOnline", "==", true));
        const querySnapshot = await getDocs(q);

        return querySnapshot.docs.map(doc => ({
            uid: doc.id,
            ...(doc.data() as Omit<UserData, "uid">)
        }));
    } catch (error) {
        console.error("Error getting online users:", error);
        return [];
    }
}; 