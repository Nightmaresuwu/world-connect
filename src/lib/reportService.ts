import {
    collection,
    addDoc,
    Timestamp
} from "firebase/firestore";
import { db } from "./firebase";

export interface Report {
    id: string;
    reporterId: string;
    reportedUserId: string;
    reason: string;
    timestamp: Timestamp;
    status: 'pending' | 'reviewed' | 'rejected' | 'actioned';
}

export const reportCollection = collection(db, "reports");

// Report a user
export const reportUser = async (
    reporterId: string,
    reportedUserId: string,
    reason: string
): Promise<string | null> => {
    try {
        const reportData = {
            reporterId,
            reportedUserId,
            reason,
            timestamp: Timestamp.now(),
            status: 'pending'
        };

        const reportRef = await addDoc(reportCollection, reportData);
        return reportRef.id;
    } catch (error) {
        console.error("Error reporting user:", error);
        return null;
    }
}; 