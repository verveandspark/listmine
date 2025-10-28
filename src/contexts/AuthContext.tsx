import { createContext } from "react";

export interface AuthContextType {
  user: any | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  updateUserTier: (tier: "free" | "good" | "even-better" | "lots-more") => void;
  resetPassword: (email: string) => Promise<void>;
  updateProfile: (updates: any) => void;
  loading: boolean;
  error: string | null;
  getTierLimits: (tier: string) => {
    listLimit: number;
    itemsPerListLimit: number;
  };
}

export const AuthContext = createContext<AuthContextType | undefined>(
  undefined,
);
