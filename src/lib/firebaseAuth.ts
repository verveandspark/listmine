import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
} from "firebase/auth";
import { auth } from "./firebase";

export const firebaseRegister = async (email: string, password: string) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      email,
      password,
    );
    console.log("[Firebase] User registered:", userCredential.user.uid);
    return userCredential.user;
  } catch (error: any) {
    console.error("[Firebase] Registration error:", error.message);
    throw error;
  }
};

export const firebaseLogin = async (email: string, password: string) => {
  try {
    const userCredential = await signInWithEmailAndPassword(
      auth,
      email,
      password,
    );
    console.log("[Firebase] User logged in:", userCredential.user.uid);
    return userCredential.user;
  } catch (error: any) {
    console.error("[Firebase] Login error:", error.message);
    throw error;
  }
};

export const firebaseLogout = async () => {
  try {
    await signOut(auth);
    console.log("[Firebase] User logged out");
  } catch (error: any) {
    console.error("[Firebase] Logout error:", error.message);
    throw error;
  }
};

export const onAuthChange = (callback: (user: FirebaseUser | null) => void) => {
  return onAuthStateChanged(auth, callback);
};
