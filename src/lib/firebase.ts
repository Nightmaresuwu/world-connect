// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
    apiKey: process.env.REACT_APP_FIREBASE_API_KEY || "AIzaSyDfUJZtu6YZp-PNSBLFqPOueg3sGluZcn0",
    authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || "world-connect-cc515.firebaseapp.com",
    projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || "world-connect-cc515",
    storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || "world-connect-cc515.firebasestorage.app",
    messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || "118610644476",
    appId: process.env.REACT_APP_FIREBASE_APP_ID || "1:118610644476:web:74081068bfe0694c327679",
    measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID || "G-YRBFW9XVMK"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Analytics conditionally (may fail in some environments)
let analytics = null;
isSupported().then(supported => {
    if (supported) {
        analytics = getAnalytics(app);
    }
}).catch(err => {
    console.error("Analytics initialization error:", err);
});

const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db, analytics };