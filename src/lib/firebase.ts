import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyCTNO1Rwdy9kAJETYVr4ZqJaqP0vcMnKJA",
  authDomain: "listmine-828f3.firebaseapp.com",
  projectId: "listmine-828f3",
  storageBucket: "listmine-828f3.firebasestorage.app",
  messagingSenderId: "146572169177",
  appId: "1:146572169177:web:f8d91de428e4562e86d3c8",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);

// Initialize Cloud Firestore and get a reference to the service
export const db = getFirestore(app);

// Initialize Realtime Database
export const realtimeDb = getDatabase(app);

export default app;
