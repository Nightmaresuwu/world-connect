import {
    doc,
    getDoc,
    setDoc,
    updateDoc,
    collection,
    query,
    where,
    getDocs,
    Timestamp,
    serverTimestamp
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
                lastActive: serverTimestamp()
            });
        } else {
            // Create new user
            await setDoc(userRef, {
                ...userData,
                createdAt: serverTimestamp(),
                lastActive: serverTimestamp(),
                isOnline: true // Set new users as online by default
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
        console.log(`Setting user ${uid} online status to: ${isOnline}`);
        await updateDoc(doc(db, "users", uid), {
            isOnline,
            lastActive: serverTimestamp()
        });
        return true;
    } catch (error) {
        console.error("Error updating online status:", error);
        return false;
    }
};

// Get all online users with better debugging and handling
export const getOnlineUsers = async (): Promise<UserData[]> => {
    try {
        console.log("Fetching online users");
        const q = query(userCollection, where("isOnline", "==", true));
        const querySnapshot = await getDocs(q);

        const onlineUsers = querySnapshot.docs.map(doc => ({
            uid: doc.id,
            ...(doc.data() as Omit<UserData, "uid">)
        }));

        console.log(`Found ${onlineUsers.length} online users:`, onlineUsers.map(u => u.username || u.email));
        return onlineUsers;
    } catch (error) {
        console.error("Error getting online users:", error);
        return [];
    }
};

// Force all users online (for testing)
export const setAllUsersOnline = async (): Promise<boolean> => {
    try {
        const querySnapshot = await getDocs(userCollection);

        const updatePromises = querySnapshot.docs.map(doc =>
            updateDoc(doc.ref, {
                isOnline: true,
                lastActive: serverTimestamp()
            })
        );

        await Promise.all(updatePromises);
        console.log(`Set ${updatePromises.length} users online for testing`);
        return true;
    } catch (error) {
        console.error("Error setting all users online:", error);
        return false;
    }
};

// Get all users (for debugging)
export const getAllUsers = async (): Promise<UserData[]> => {
    try {
        const querySnapshot = await getDocs(userCollection);

        const users = querySnapshot.docs.map(doc => ({
            uid: doc.id,
            ...(doc.data() as Omit<UserData, "uid">)
        }));

        console.log(`Found ${users.length} total users:`, users.map(u => ({
            username: u.username || u.email,
            isOnline: u.isOnline
        })));
        return users;
    } catch (error) {
        console.error("Error getting all users:", error);
        return [];
    }
}; 