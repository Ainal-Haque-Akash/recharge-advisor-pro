import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import {
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut,
  onAuthStateChanged,
  type User as FirebaseUser,
} from "firebase/auth";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { auth, googleProvider, db } from "@/lib/firebase";
import { toast } from "sonner";

export interface AuthUserProfile {
  id: string;
  uid: string;
  name: string;
  email: string;
  photoURL?: string | null;
  role: string;
  createdAt?: string;
}

interface AuthContextType {
  user: AuthUserProfile | null;
  firebaseUser: FirebaseUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signInWithGoogle: () => Promise<void>;
  login: (credentials: { email: string; password: string }) => Promise<void>;
  register: (data: { name: string; email: string; password: string }) => Promise<void>;
  loginAsDemo: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Helper to ensure user document exists in Firestore
async function syncUserToFirestore(fbUser: FirebaseUser, customName?: string) {
  try {
    const userRef = doc(db, "users", fbUser.uid);
    const snap = await getDoc(userRef);
    const name = customName || fbUser.displayName || fbUser.email?.split("@")[0] || "User";

    if (!snap.exists()) {
      await setDoc(userRef, {
        uid: fbUser.uid,
        name,
        email: fbUser.email,
        photoURL: fbUser.photoURL || null,
        role: "USER",
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
      });
    } else {
      await setDoc(
        userRef,
        {
          name: customName || snap.data()?.name || name,
          photoURL: fbUser.photoURL || snap.data()?.photoURL || null,
          lastLoginAt: new Date().toISOString(),
        },
        { merge: true }
      );
    }
  } catch (err) {
    console.warn("Could not sync user to Firestore (may be due to security rules):", err);
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUserProfile | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Map Firebase User to our app profile
  const mapFirebaseUser = useCallback((fbUser: FirebaseUser, customName?: string): AuthUserProfile => {
    return {
      id: fbUser.uid,
      uid: fbUser.uid,
      name: customName || fbUser.displayName || fbUser.email?.split("@")[0] || "User",
      email: fbUser.email || "",
      photoURL: fbUser.photoURL,
      role: "USER",
    };
  }, []);

  // Listen to Firebase Auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setIsLoading(true);
      if (currentUser) {
        setFirebaseUser(currentUser);
        setUser(mapFirebaseUser(currentUser));
        await syncUserToFirestore(currentUser);
      } else {
        setFirebaseUser(null);
        setUser(null);
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [mapFirebaseUser]);

  // 1. Google Sign-In
  const signInWithGoogle = async () => {
    setIsLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const profile = mapFirebaseUser(result.user);
      setUser(profile);
      setFirebaseUser(result.user);
      await syncUserToFirestore(result.user);
      toast.success(`Welcome, ${profile.name}!`);
    } catch (error: any) {
      console.error("Google sign-in error:", error);
      if (error.code === "auth/popup-closed-by-user") {
        toast.info("Google sign-in window was closed.");
      } else if (error.code === "auth/unauthorized-domain") {
        toast.error("Domain unauthorized. Please add localhost to Firebase Auth Authorized Domains.");
      } else {
        toast.error(error.message || "Google sign-in failed.");
      }
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // 2. Email/Password Login
  const login = async (credentials: { email: string; password: string }) => {
    setIsLoading(true);
    try {
      const result = await signInWithEmailAndPassword(auth, credentials.email.trim(), credentials.password);
      const profile = mapFirebaseUser(result.user);
      setUser(profile);
      setFirebaseUser(result.user);
      await syncUserToFirestore(result.user);
      toast.success(`Welcome back, ${profile.name}!`);
    } catch (error: any) {
      console.error("Email login error:", error);
      let msg = error.message;
      if (error.code === "auth/invalid-credential" || error.code === "auth/user-not-found" || error.code === "auth/wrong-password") {
        msg = "Invalid email or password.";
      }
      toast.error(msg);
      throw new Error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  // 3. Email/Password Register
  const register = async (data: { name: string; email: string; password: string }) => {
    setIsLoading(true);
    try {
      const result = await createUserWithEmailAndPassword(auth, data.email.trim(), data.password);
      if (result.user) {
        await updateProfile(result.user, { displayName: data.name.trim() });
      }
      const profile = mapFirebaseUser(result.user, data.name.trim());
      setUser(profile);
      setFirebaseUser(result.user);
      await syncUserToFirestore(result.user, data.name.trim());
      toast.success("Account created successfully!");
    } catch (error: any) {
      console.error("Register error:", error);
      let msg = error.message;
      if (error.code === "auth/email-already-in-use") {
        msg = "An account with this email already exists.";
      } else if (error.code === "auth/weak-password") {
        msg = "Password should be at least 6 characters.";
      }
      toast.error(msg);
      throw new Error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  // 4. Demo Login
  const loginAsDemo = async () => {
    const demoEmail = "demo@metertrace.pro";
    const demoPassword = "DemoPassword123!";
    setIsLoading(true);
    try {
      try {
        await login({ email: demoEmail, password: demoPassword });
      } catch {
        // If demo user does not exist in Firebase yet, auto-create it
        await register({ name: "Demo User", email: demoEmail, password: demoPassword });
      }
    } catch (err: any) {
      toast.error("Demo login error: " + (err.message || "Failed"));
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // 5. Logout
  const logout = async () => {
    try {
      await signOut(auth);
      setUser(null);
      setFirebaseUser(null);
      toast.info("You have signed out.");
    } catch (err: any) {
      toast.error(err.message || "Sign out failed.");
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        firebaseUser,
        isLoading,
        isAuthenticated: Boolean(user && firebaseUser),
        signInWithGoogle,
        login,
        register,
        loginAsDemo,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
