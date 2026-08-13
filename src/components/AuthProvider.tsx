import { useEffect, useState, type ReactNode } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  type User,
} from "firebase/auth";
import { auth, firebaseConfigReady } from "../lib/firebase";
import { AuthContext, type AuthContextValue } from "../hooks/authContext";

/** UI preview mode (npm run preview:ui) — see lib/db.preview.ts. */
const UI_PREVIEW = import.meta.env.VITE_UI_PREVIEW === "1";
const PREVIEW_USER = { uid: "preview", email: "preview@local" } as User;

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(UI_PREVIEW ? PREVIEW_USER : null);
  const [loading, setLoading] = useState(!UI_PREVIEW);

  useEffect(() => {
    if (UI_PREVIEW) return; // no Firebase listener; the fixture user is already set
    if (!firebaseConfigReady) {
      setLoading(false);
      return;
    }
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsub;
  }, []);

  const value: AuthContextValue = {
    user,
    loading,
    configReady: UI_PREVIEW || firebaseConfigReady,
    signIn: async (email, password) => {
      await signInWithEmailAndPassword(auth, email, password);
    },
    signUp: async (email, password) => {
      await createUserWithEmailAndPassword(auth, email, password);
    },
    logOut: async () => {
      await signOut(auth);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
