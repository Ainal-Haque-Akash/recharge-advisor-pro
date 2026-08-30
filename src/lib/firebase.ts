import { initializeApp, getApps, getApp } from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Your web app's Firebase configuration
export const firebaseConfig = {
  apiKey: "AIzaSyCTMSCiQRcprxPbFsDqh_T1JCsR_E64XR8",
  authDomain: "meter-a380e.firebaseapp.com",
  projectId: "meter-a380e",
  storageBucket: "meter-a380e.firebasestorage.app",
  messagingSenderId: "141541500158",
  appId: "1:141541500158:web:0923de01e4e876c82231af",
  measurementId: "G-QZKY7VEMXH",
};

// Initialize Firebase (SSR-safe singleton)
export const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Firebase Auth
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

// Cloud Firestore Database
export const db = getFirestore(app);

// Cloud Storage
export const storage = getStorage(app);

// Analytics
export const analytics =
  typeof window !== "undefined"
    ? isSupported().then((yes) => (yes ? getAnalytics(app) : null))
    : null;
