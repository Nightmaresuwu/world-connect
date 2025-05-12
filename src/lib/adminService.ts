import { doc, getDoc, collection, getDocs, query, where, setDoc, Timestamp, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";

// Interface for Admin data
export interface AdminData {
    uid: string;
    email: string;
    username?: string;  // Added username field
    role: 'admin' | 'superadmin';
    createdAt?: any;
}

// Collection reference
export const adminCollection = collection(db, "admins");

// Check if a user is an admin by uid, email, or username
export const checkIsAdmin = async (uid: string, emailOrUsername: string): Promise<AdminData | null> => {
    try {
        // First try to get admin by uid
        const adminDoc = await getDoc(doc(db, "admins", uid));

        if (adminDoc.exists()) {
            return { uid, ...(adminDoc.data() as Omit<AdminData, "uid">) };
        }

        // If not found by UID, try by email or username
        const isEmail = emailOrUsername.includes('@');

        let adminQuery;
        if (isEmail) {
            adminQuery = query(adminCollection, where("email", "==", emailOrUsername.toLowerCase()));
        } else {
            adminQuery = query(adminCollection, where("username", "==", emailOrUsername));
        }

        const querySnapshot = await getDocs(adminQuery);

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

// Find admin by username
export const getAdminByUsername = async (username: string): Promise<AdminData | null> => {
    try {
        const q = query(adminCollection, where("username", "==", username));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            const adminDoc = querySnapshot.docs[0];
            return { uid: adminDoc.id, ...(adminDoc.data() as Omit<AdminData, "uid">) };
        }

        return null;
    } catch (error) {
        console.error("Error finding admin by username:", error);
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

// Create or update admin
export const upsertAdmin = async (adminData: AdminData): Promise<boolean> => {
    try {
        console.log("Upserting admin:", adminData.email);

        // Ensure username is unique if provided
        if (adminData.username) {
            const existingAdmin = await getAdminByUsername(adminData.username);
            if (existingAdmin && existingAdmin.uid !== adminData.uid) {
                console.error("Admin username already taken");
                return false;
            }
        }

        const adminRef = doc(db, "admins", adminData.uid);
        const adminDoc = await getDoc(adminRef);

        if (adminDoc.exists()) {
            // Update existing admin
            const { uid, createdAt, ...updateData } = adminData;
            await setDoc(adminRef, {
                ...updateData,
                lastUpdated: serverTimestamp()
            }, { merge: true });
        } else {
            // Create new admin
            await setDoc(adminRef, {
                ...adminData,
                createdAt: serverTimestamp(),
                email: adminData.email.toLowerCase()
            });
            console.log(`New admin created: ${adminData.email}`);
        }

        return true;
    } catch (error) {
        console.error("Error upserting admin:", error);
        return false;
    }
}; 