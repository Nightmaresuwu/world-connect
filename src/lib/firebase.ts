// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
    apiKey: "AIzaSyDfUJZtu6YZp-PNSBLFqPOueg3sGluZcn0",
    authDomain: "world-connect-cc515.firebaseapp.com",
    projectId: "world-connect-cc515",
    storageBucket: "world-connect-cc515.firebasestorage.app",
    messagingSenderId: "118610644476",
    appId: "1:118610644476:web:74081068bfe0694c327679",
    measurementId: "G-YRBFW9XVMK"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db, analytics };