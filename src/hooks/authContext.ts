import { createContext } from "react";
import type { User } from "firebase/auth";

export interface AuthContextValue {
  user: User | null;
  loading: boolean;
  configReady: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  logOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | undefined>(
  undefined
);
