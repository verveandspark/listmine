import { createContext } from "react";

export type TierChangeCallback = (newTier: string, prevTier: string) => void;
export type TierChangeUnsubscribe = () => void;

export interface AuthContextType {
  user: any | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  signOut: () => Promise<void>;
  isAuthenticated: boolean;
  updateUserTier: (tier: "free" | "good" | "even_better" | "lots_more") => void;
  resetPassword: (email: string) => Promise<void>;
  updateProfile: (updates: any) => void;
  updateEmail: (newEmail: string) => Promise<void>;
  updatePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  updateAvatar: (file: File) => Promise<string>;
  loading: boolean;
  error: string | null;
  getTierLimits: (tier: string) => {
    listLimit: number;
    itemsPerListLimit: number;
  };
  onTierChange: (callback: TierChangeCallback) => TierChangeUnsubscribe;
}

export const AuthContext = createContext<AuthContextType | undefined>(
  undefined,
);
