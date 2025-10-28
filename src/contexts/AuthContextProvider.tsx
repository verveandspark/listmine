import { createContext, useState, ReactNode, useEffect } from "react";
import { User } from "@/types";
import { supabase } from "@/lib/supabase";
import { User as SupabaseUser } from "@supabase/supabase-js";
import { AuthContext, AuthContextType } from "./AuthContext";

const logError = (operation: string, error: any, userId?: string) => {
  console.error("[ListMine Error]", {
    operation,
    error: error.message || error,
    userId,
    timestamp: new Date().toISOString(),
  });
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const getTierLimits = (tier: string) => {
    switch (tier) {
      case "free":
        return { listLimit: 5, itemsPerListLimit: 20 };
      case "good":
        return { listLimit: 50, itemsPerListLimit: 150 };
      case "even-better":
        return { listLimit: 100, itemsPerListLimit: 500 };
      case "lots-more":
        return { listLimit: -1, itemsPerListLimit: -1 };
      default:
        return { listLimit: 5, itemsPerListLimit: 20 };
    }
  };

  useEffect(() => {
    const initAuth = async () => {
      try {
        console.log("[Auth] Initializing auth...");
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) {
          console.error("[Auth] Session error:", sessionError);
          throw sessionError;
        }

        console.log("[Auth] Session:", session);

        if (session?.user) {
          await loadUserProfile(session.user);
        } else {
          console.log("[Auth] No session found");
          setLoading(false);
        }
      } catch (error: any) {
        console.error("[Auth] Init error:", error);
        logError("initAuth", error);
        setError(error.message || "Failed to initialize auth");
        setLoading(false);
      }
    };

    initAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("[Auth] State change:", event, session?.user?.id);
      if (event === "SIGNED_IN" && session?.user) {
        await loadUserProfile(session.user);
      } else if (event === "SIGNED_OUT") {
        setUser(null);
      } else if (event === "TOKEN_REFRESHED" && session?.user) {
        await loadUserProfile(session.user);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const loadUserProfile = async (supabaseUser: SupabaseUser) => {
    try {
      console.log("[Profile] Loading profile for:", supabaseUser.id);

      // Get the session to get the access token
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        console.error("[Profile] No access token");
        setLoading(false);
        return;
      }

      console.log("[Profile] Using REST API with token");

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(
        `${supabaseUrl}/rest/v1/users?id=eq.${supabaseUser.id}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        },
      );

      console.log("[Profile] REST API response status:", response.status);

      if (!response.ok) {
        console.error(
          "[Profile] REST API error:",
          response.status,
          response.statusText,
        );
        setLoading(false);
        return;
      }

      const data = await response.json();
      console.log("[Profile] REST API data:", data);

      if (data && data.length > 0) {
        const userData = data[0];
        const tierLimits = getTierLimits(userData.tier);

        setUser({
          id: userData.id,
          email: userData.email,
          name: userData.name,
          createdAt: new Date(userData.created_at),
          tier: userData.tier as "free" | "good" | "even-better" | "lots-more",
          listLimit: tierLimits.listLimit,
          itemsPerListLimit: tierLimits.itemsPerListLimit,
        });

        console.log("[Profile] User set successfully");
      } else {
        console.log("[Profile] No user data found");
      }
    } catch (error: any) {
      console.error("[Profile] Error:", error.message);
      logError("loadUserProfile", error, supabaseUser.id);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      setError(null);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        if (error.message.includes("Invalid login credentials")) {
          throw new Error(
            "Hmm, we couldn't log you in. Check your email and password and try again.",
          );
        }
        throw error;
      }

      if (data.user) {
        await loadUserProfile(data.user);
      }
    } catch (error: any) {
      logError("login", error);
      throw error;
    }
  };

  const register = async (email: string, password: string, name: string) => {
    if (password.length < 8) {
      throw new Error("Password must be at least 8 characters.");
    }

    try {
      setError(null);
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        if (
          error.message.includes("already registered") ||
          error.message.includes("already exists")
        ) {
          throw new Error(
            "This email is already registered. Try logging in instead.",
          );
        }
        throw error;
      }

      if (!data.user) throw new Error("Registration failed.");

      const tierLimits = getTierLimits("free");

      const { error: profileError } = await supabase.from("users").insert({
        id: data.user.id,
        email,
        name,
        tier: "free",
        list_limit: tierLimits.listLimit,
        items_per_list_limit: tierLimits.itemsPerListLimit,
      });

      if (profileError) {
        logError("register:createProfile", profileError, data.user.id);
        throw profileError;
      }

      await loadUserProfile(data.user);
    } catch (error: any) {
      logError("register", error);
      throw error;
    }
  };

  const logout = () => {
    try {
      supabase.auth.signOut();
      setUser(null);
    } catch (error: any) {
      logError("logout", error, user?.id);
      setUser(null);
    }
  };

  const updateUserTier = (
    tier: "free" | "good" | "even-better" | "lots-more",
  ) => {
    if (!user) return;

    const tierLimits = getTierLimits(tier);

    supabase
      .from("users")
      .update({
        tier,
        list_limit: tierLimits.listLimit,
        items_per_list_limit: tierLimits.itemsPerListLimit,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id)
      .then(() => {
        setUser({
          ...user,
          tier,
          listLimit: tierLimits.listLimit,
          itemsPerListLimit: tierLimits.itemsPerListLimit,
        });
      })
      .catch((error: any) => {
        logError("updateUserTier", error, user.id);
      });
  };

  const resetPassword = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) throw error;
    } catch (error: any) {
      logError("resetPassword", error);
      throw error;
    }
  };

  const updateProfile = async (updates: Partial<User>) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from("users")
        .update({
          name: updates.name,
          email: updates.email,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      if (error) throw error;

      setUser({ ...user, ...updates });
    } catch (error: any) {
      logError("updateProfile", error, user.id);
      throw error;
    }
  };

  const value: AuthContextType = {
    user,
    login,
    register,
    logout,
    isAuthenticated: !!user,
    updateUserTier,
    resetPassword,
    updateProfile,
    loading,
    error,
    getTierLimits,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
