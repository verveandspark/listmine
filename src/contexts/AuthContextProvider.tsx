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
          setUserFromAuth(session.user);
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
        setUserFromAuth(session.user);
      } else if (event === "SIGNED_OUT") {
        setUser(null);
      } else if (event === "TOKEN_REFRESHED" && session?.user) {
        setUserFromAuth(session.user);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const setUserFromAuth = (supabaseUser: SupabaseUser) => {
    console.log("[Auth] Setting user from auth:", supabaseUser.id);

    const tierLimits = getTierLimits("free");

    setUser({
      id: supabaseUser.id,
      email: supabaseUser.email || "",
      name: supabaseUser.user_metadata?.name || "User",
      createdAt: new Date(supabaseUser.created_at || new Date()),
      tier: "free",
      listLimit: tierLimits.listLimit,
      itemsPerListLimit: tierLimits.itemsPerListLimit,
    });

    setLoading(false);
    console.log("[Auth] User set successfully");
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
        setUserFromAuth(data.user);
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

      setUserFromAuth(data.user);
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
