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
  console.log("[AuthProvider] Rendering AuthProvider");
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const getTierLimits = (tier: string) => {
    switch (tier) {
      case "free":
        return { listLimit: 5, itemsPerListLimit: 20 };
      case "good":
        return { listLimit: 50, itemsPerListLimit: 150 };
      case "even_better":
        return { listLimit: 100, itemsPerListLimit: 500 };
      case "lots_more":
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
          console.log("[Auth] Session found, calling setUserFromAuth...");
          try {
            await setUserFromAuth(session.user);
            console.log("[Auth] setUserFromAuth completed successfully");
          } catch (err) {
            console.error("[Auth] setUserFromAuth threw an error:", err);
          } finally {
            // Always ensure loading is false after attempting to set user
            console.log("[Auth] Ensuring loading is false after setUserFromAuth");
            setLoading(false);
          }
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
      try {
        if (event === "SIGNED_IN" && session?.user) {
          await setUserFromAuth(session.user);
        } else if (event === "SIGNED_OUT") {
          setUser(null);
          setLoading(false);
        } else if (event === "TOKEN_REFRESHED" && session?.user) {
          await setUserFromAuth(session.user);
        }
      } catch (err) {
        console.error("[Auth] Error in onAuthStateChange handler:", err);
        setLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const setUserFromAuth = async (supabaseUser: SupabaseUser) => {
    console.log("[Auth] Setting user from auth:", supabaseUser.id);

    let tier: 'free' | 'good' | 'even_better' | 'lots_more' = 'free';

    try {
      // Query the users table to get the actual tier with timeout
      console.log("[Auth] Fetching user tier from database...");
      
      // Use AbortController for proper timeout handling
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.log("[Auth] Tier fetch timeout - aborting");
        controller.abort();
      }, 5000);

      const { data: userData, error: tierError } = await supabase
        .from('users')
        .select('tier')
        .eq('id', supabaseUser.id)
        .single()
        .abortSignal(controller.signal);

      clearTimeout(timeoutId);
      
      console.log("[Auth] User tier query completed:", { userData, tierError });

      if (tierError) {
        console.error("[Auth] Error fetching user tier:", tierError);
      } else if (userData) {
        tier = (userData.tier || 'free') as 'free' | 'good' | 'even_better' | 'lots_more';
        console.log("[Auth] Got tier from database:", tier);
      }
    } catch (err: any) {
      console.error("[Auth] Exception fetching user tier:", err?.message || err);
      // Continue with default tier
    } finally {
      console.log("[Auth] Tier fetch finished (finally block), proceeding with tier:", tier);
    }

    const tierLimits = getTierLimits(tier);

    console.log("[Auth] Setting user state with tier:", tier);
    setUser({
      id: supabaseUser.id,
      email: supabaseUser.email || "",
      name: supabaseUser.user_metadata?.name || "User",
      createdAt: new Date(supabaseUser.created_at || new Date()),
      tier: tier,
      listLimit: tierLimits.listLimit,
      itemsPerListLimit: tierLimits.itemsPerListLimit,
    });

    console.log("[Auth] About to set loading to false");
    setLoading(false);
    console.log("[Auth] User set successfully, loading is now false");
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
        await setUserFromAuth(data.user);
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

      await setUserFromAuth(data.user);
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
    tier: "free" | "good" | "even_better" | "lots_more",
  ) => {
    if (!user) return;

    const tierLimits = getTierLimits(tier);

    Promise.resolve(
      supabase
        .from("users")
        .update({
          tier,
          list_limit: tierLimits.listLimit,
          items_per_list_limit: tierLimits.itemsPerListLimit,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id)
    )
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

  const updateEmail = async (newEmail: string) => {
    if (!user) throw new Error("User not authenticated");

    try {
      const { error } = await supabase.auth.updateUser({
        email: newEmail,
      });

      if (error) throw error;

      // Update the users table as well
      await supabase
        .from("users")
        .update({
          email: newEmail,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      setUser({ ...user, email: newEmail });
    } catch (error: any) {
      logError("updateEmail", error, user.id);
      throw error;
    }
  };

  const updatePassword = async (currentPassword: string, newPassword: string) => {
    if (!user) throw new Error("User not authenticated");

    try {
      // First verify the current password by re-authenticating
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });

      if (signInError) {
        throw new Error("Current password is incorrect");
      }

      // Now update to the new password
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;
    } catch (error: any) {
      logError("updatePassword", error, user.id);
      throw error;
    }
  };

  const updateProfile = async (updates: Partial<User>) => {
    if (!user) return;

    try {
      // Check for active auth session before updating auth metadata
      if (updates.name) {
        const { data: sessionData } = await supabase.auth.getSession();
        
        // Only update auth metadata if we have an active session
        if (sessionData?.session) {
          const { error: authError } = await supabase.auth.updateUser({
            data: { name: updates.name },
          });
          // Don't throw on auth error - just log it and continue with DB update
          if (authError) {
            console.warn("Could not update auth metadata:", authError.message);
          }
        }

        // Use database function to update name (avoids RLS recursion)
        const { error: dbError } = await supabase.rpc('update_user_name', {
          user_id: user.id,
          new_name: updates.name
        });

        if (dbError) {
          console.error('Error updating name:', dbError);
          throw new Error('Failed to update name');
        }
      }

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
    updateEmail,
    updatePassword,
    updateProfile,
    loading,
    error,
    getTierLimits,
  };

  console.log("[AuthProvider] Returning provider, loading:", loading, "user:", user?.id);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};