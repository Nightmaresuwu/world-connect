import {
    doc,
    getDoc,
    setDoc,
    updateDoc,
    collection,
    query,
    getDocs,
    Timestamp,
    serverTimestamp,
    onSnapshot,
    writeBatch
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
        console.log("Upserting user:", userData.email);
        const userRef = doc(db, "users", userData.uid);
        const userDoc = await getDoc(userRef);

        if (userDoc.exists()) {
            // Update existing user
            const { uid, createdAt, ...updateData } = userData;
            await updateDoc(userRef, {
                ...updateData,
                isOnline: true, // Always set as online when updated
                lastActive: serverTimestamp()
            });
        } else {
            // Create new user
            await setDoc(userRef, {
                ...userData,
                createdAt: serverTimestamp(),
                lastActive: serverTimestamp(),
                isOnline: true // Always create as online
            });
            console.log(`New user created: ${userData.email}`);
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

// Get all users (both online and offline)
export const getAllUsers = async (): Promise<UserData[]> => {
    try {
        console.log("Fetching all users");
        const querySnapshot = await getDocs(userCollection);

        const users = querySnapshot.docs.map(doc => ({
            uid: doc.id,
            ...(doc.data() as Omit<UserData, "uid">)
        }));

        console.log(`Found ${users.length} total users:`, users.map(u => u.username || u.email));
        return users;
    } catch (error) {
        console.error("Error getting all users:", error);
        return [];
    }
};

// Set all users online (for testing)
export const setAllUsersOnline = async (): Promise<boolean> => {
    try {
        console.log("Setting all users as online");
        const querySnapshot = await getDocs(userCollection);

        // Use batch write for better performance
        const batch = writeBatch(db);

        querySnapshot.docs.forEach(doc => {
            batch.update(doc.ref, {
                isOnline: true,
                lastActive: serverTimestamp()
            });
        });

        await batch.commit();
        console.log(`Set ${querySnapshot.docs.length} users online for testing`);
        return true;
    } catch (error) {
        console.error("Error setting all users online:", error);
        return false;
    }
};

// Legacy function - now returns all users for better compatibility
export const getOnlineUsers = async (): Promise<UserData[]> => {
    return getAllUsers();
};

// Subscribe to user changes - for real-time monitoring if needed
export const subscribeToUsers = (callback: (users: UserData[]) => void): () => void => {
    return onSnapshot(userCollection, (snapshot) => {
        const users = snapshot.docs.map(doc => ({
            uid: doc.id,
            ...(doc.data() as Omit<UserData, "uid">)
        }));
        callback(users);
    });
}; 