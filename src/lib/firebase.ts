import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Tumhara Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyAMF-3mZMqZFqOrTdM2cPKalwXU6O2putI",
  authDomain: "fycs-notes-hub-97274.firebaseapp.com",
  projectId: "fycs-notes-hub-97274",
  storageBucket: "fycs-notes-hub-97274.firebasestorage.app",
  messagingSenderId: "81526695854",
  appId: "1:81526695854:web:f548ce0cf67d6dab898a3f"
};

// Initialize Firebase (Check karke ki app pehle se bani hui toh nahi hai)
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Auth aur Database variables setup
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

// Google login popup ko hamesha naya account choose karne ke liye force karna
googleProvider.setCustomParameters({
  prompt: "select_account"
});

export { app, auth, db, googleProvider };
