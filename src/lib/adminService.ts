import { doc, getDoc, collection, getDocs, query, where } from "firebase/firestore";
import { db } from "./firebase";

// Interface for Admin data
export interface AdminData {
    uid: string;
    email: string;
    role: 'admin' | 'superadmin';
    createdAt?: any;
}

// Collection reference
export const adminCollection = collection(db, "admins");

// Check if a user is an admin
export const checkIsAdmin = async (uid: string, email: string): Promise<AdminData | null> => {
    try {
        // First try to get admin by uid
        const adminDoc = await getDoc(doc(db, "admins", uid));

        if (adminDoc.exists()) {
            return { uid, ...(adminDoc.data() as Omit<AdminData, "uid">) };
        }

        // If not found by UID, try by email
        const emailQuery = query(adminCollection, where("email", "==", email));
        const querySnapshot = await getDocs(emailQuery);

        if (!querySnapshot.empty) {
            const adminData = querySnapshot.docs[0].data() as Omit<AdminData, "uid">;
            return { uid: querySnapshot.docs[0].id, ...adminData };
        }

        return null;
    } catch (error) {
        console.error("Error checking admin status:", error);
        return null;
    }
};

// Get all admins
export const getAllAdmins = async (): Promise<AdminData[]> => {
    try {
        const querySnapshot = await getDocs(adminCollection);
        return querySnapshot.docs.map(doc => ({
            uid: doc.id,
            ...(doc.data() as Omit<AdminData, "uid">)
        }));
    } catch (error) {
        console.error("Error getting admins:", error);
        return [];
    }
}; 