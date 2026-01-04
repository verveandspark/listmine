import { createContext, useState, ReactNode, useEffect, useRef, useCallback, useMemo } from "react";
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
  
  // Use a ref to cache the user's tier to prevent flickering
  // Initialize synchronously from localStorage for persistence across page reloads
  const getInitialTier = (): string | null => {
    try {
      return localStorage.getItem('listmine_user_tier');
    } catch (e) {
      return null;
    }
  };
  
  const getInitialUserId = (): string | null => {
    try {
      return localStorage.getItem('listmine_user_id');
    } catch (e) {
      return null;
    }
  };
  
  const cachedTierRef = useRef<string | null>(getInitialTier());
  const userIdRef = useRef<string | null>(getInitialUserId());
  
  // Tier change callback subscribers
  const tierChangeCallbacksRef = useRef<Set<(newTier: string, prevTier: string) => void>>(new Set());

  // Helper to save tier to localStorage
  const saveTierToStorage = (userId: string, tier: string) => {
    try {
      localStorage.setItem('listmine_user_tier', tier);
      localStorage.setItem('listmine_user_id', userId);
    } catch (e) {
      // localStorage not available
    }
  };

  // Helper to clear tier from localStorage
  const clearTierFromStorage = () => {
    try {
      localStorage.removeItem('listmine_user_tier');
      localStorage.removeItem('listmine_user_id');
    } catch (e) {
      // localStorage not available
    }
  };

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

  // Register a callback for tier changes, returns unsubscribe function
  const onTierChange = useCallback((callback: (newTier: string, prevTier: string) => void) => {
    tierChangeCallbacksRef.current.add(callback);
    return () => {
      tierChangeCallbacksRef.current.delete(callback);
    };
  }, []);

  // Notify all subscribers of a tier change
  const notifyTierChange = useCallback((newTier: string, prevTier: string) => {
    tierChangeCallbacksRef.current.forEach(callback => {
      try {
        callback(newTier, prevTier);
      } catch (err) {
        console.error('[Auth] Error in tier change callback:', err);
      }
    });
  }, []);

  useEffect(() => {
    let isMounted = true;
    
    const initAuth = async () => {
      // Set a global timeout to ensure loading is always cleared
      const globalTimeout = setTimeout(() => {
        if (isMounted) {
          setUser(null);
          setLoading(false);
        }
      }, 10000);
      
      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) {
          console.error("[Auth] Session error:", sessionError);
          // Clear any invalid session data
          await supabase.auth.signOut();
          if (isMounted) {
            setUser(null);
            setLoading(false);
          }
          clearTimeout(globalTimeout);
          return;
        }

        // Check if session is expired
        if (session?.expires_at) {
          const expiresAt = new Date(session.expires_at * 1000);
          const now = new Date();
          
          if (expiresAt < now) {
            await supabase.auth.signOut();
            if (isMounted) {
              setUser(null);
              setLoading(false);
            }
            clearTimeout(globalTimeout);
            return;
          }
        }

        if (session?.user) {
          console.log('[Auth Debug] Initial session load:', {
            userId: session.user.id,
            cachedTier: cachedTierRef.current,
            cachedUserId: userIdRef.current
          });
          try {
            await setUserFromAuth(session.user, true);
          } catch (err) {
            console.error("[Auth] setUserFromAuth threw an error:", err);
            // Even if setUserFromAuth fails, we should still set a basic user
            // Use cached tier if available for the same user
            const fallbackTier = (session.user.id === userIdRef.current && cachedTierRef.current) 
              ? cachedTierRef.current as 'free' | 'good' | 'even_better' | 'lots_more'
              : 'free';
            const tierLimits = getTierLimits(fallbackTier);
            
            if (isMounted) {
              setUser({
                id: session.user.id,
                email: session.user.email || "",
                name: session.user.user_metadata?.name || "User",
                createdAt: new Date(session.user.created_at || new Date()),
                tier: fallbackTier,
                listLimit: tierLimits.listLimit,
                itemsPerListLimit: tierLimits.itemsPerListLimit,
                avatarUrl: session.user.user_metadata?.avatar_url || undefined,
              });
              // Update cache and localStorage
              userIdRef.current = session.user.id;
              cachedTierRef.current = fallbackTier;
              saveTierToStorage(session.user.id, fallbackTier);
            }
          }
        }
      } catch (error: any) {
        console.error("[Auth] Init error:", error);
        logError("initAuth", error);
        if (isMounted) {
          setError(error.message || "Failed to initialize auth");
          setUser(null);
        }
      } finally {
        clearTimeout(globalTimeout);
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    initAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;
      
      try {
        if (event === "SIGNED_IN" && session?.user) {
          // Only fetch tier if user ID changed
          if (session.user.id !== userIdRef.current) {
            await setUserFromAuth(session.user, true);
          }
        } else if (event === "SIGNED_OUT") {
          cachedTierRef.current = null;
          userIdRef.current = null;
          clearTierFromStorage();
          setUser(null);
          setLoading(false);
        } else if (event === "TOKEN_REFRESHED" && session?.user) {
          // On token refresh, use cached tier to avoid flickering
          if (session.user.id === userIdRef.current && cachedTierRef.current) {
            // Same user, use cached tier
            await setUserFromAuth(session.user, false);
          } else {
            // Different user or no cache, fetch tier
            await setUserFromAuth(session.user, true);
          }
        } else if (event === "TOKEN_REFRESHED" && !session) {
          // Token refresh failed - session is invalid
          cachedTierRef.current = null;
          userIdRef.current = null;
          clearTierFromStorage();
          setUser(null);
          setLoading(false);
        }
      } catch (err) {
        console.error("[Auth] Error in onAuthStateChange handler:", err);
        setLoading(false);
      }
    });

    // Set up realtime subscription for user tier changes
    let userChannel: ReturnType<typeof supabase.channel> | null = null;
    
    const setupUserRealtimeSubscription = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) {
        console.log('[Auth Realtime] No session user, skipping realtime subscription setup');
        return;
      }
      
      const channelName = `user-tier-${session.user.id}`;
      console.log('[Auth Realtime] Setting up realtime subscription:', { channelName, userId: session.user.id });
      
      userChannel = supabase
        .channel(channelName)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "users",
            filter: `id=eq.${session.user.id}`,
          },
          async (payload) => {
            // User record updated - check if tier changed
            const newData = payload.new as any;
            console.log('[Auth Realtime] ====== TIER UPDATE EVENT RECEIVED ======');
            console.log('[Auth Realtime] Payload:', {
              userId: newData?.id,
              newTier: newData?.tier,
              oldTier: (payload.old as any)?.tier,
              isMounted,
              timestamp: new Date().toISOString()
            });
            
            if (newData && newData.tier && isMounted) {
              const newTier = newData.tier as 'free' | 'good' | 'even_better' | 'lots_more';
              const tierLimits = getTierLimits(newTier);
              const prevTier = cachedTierRef.current || 'free';
              
              console.log('[Auth Realtime] Processing tier change:', {
                newTier,
                prevTier,
                tierChanged: prevTier !== newTier,
                listLimit: tierLimits.listLimit,
                itemsPerListLimit: tierLimits.itemsPerListLimit
              });
              
              // Update cached tier FIRST
              cachedTierRef.current = newTier;
              saveTierToStorage(session.user.id, newTier);
              console.log('[Auth Realtime] Cached tier updated to:', newTier);
              
              // Update user state synchronously
              setUser(prev => {
                console.log('[Auth Realtime] setUser callback executing:', {
                  prevState: prev?.tier,
                  newTier,
                  userId: prev?.id
                });
                if (!prev) return prev;
                return {
                  ...prev,
                  tier: newTier,
                  listLimit: tierLimits.listLimit,
                  itemsPerListLimit: tierLimits.itemsPerListLimit,
                };
              });
              
              // Notify subscribers of tier change AFTER state update
              // This triggers list refresh and UI updates
              if (prevTier !== newTier) {
                console.log('[Auth Realtime] Notifying tier change subscribers:', { prevTier, newTier });
                // Small delay to ensure React state has propagated
                setTimeout(() => {
                  notifyTierChange(newTier, prevTier);
                  console.log('[Auth Realtime] Tier change notification sent');
                }, 50);
              }
              
              console.log('[Auth Realtime] ====== TIER UPDATE PROCESSING COMPLETE ======');
            }
          }
        )
        .subscribe((status, err) => {
          console.log('[Auth Realtime] Subscription status changed:', { status, error: err?.message });
          if (status === 'SUBSCRIBED') {
            console.log('[Auth Realtime] Successfully subscribed to user tier changes');
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            console.error('[Auth Realtime] Subscription failed:', { status, error: err });
            // Start polling as fallback if realtime fails
            startTierPolling();
          }
        });
    };
    
    // Fallback polling mechanism if realtime subscription fails
    let pollingInterval: ReturnType<typeof setInterval> | null = null;
    const startTierPolling = async () => {
      console.log('[Auth Polling] Starting tier polling fallback');
      // Poll every 30 seconds
      pollingInterval = setInterval(async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user?.id || !isMounted) {
          if (pollingInterval) clearInterval(pollingInterval);
          return;
        }
        
        try {
          const { data: userData, error } = await (supabase.from('users') as any)
            .select('tier')
            .eq('id', session.user.id)
            .single();
          
          if (error || !userData) return;
          
          const fetchedTier = userData.tier as 'free' | 'good' | 'even_better' | 'lots_more';
          const currentTier = cachedTierRef.current || 'free';
          
          if (fetchedTier !== currentTier) {
            console.log('[Auth Polling] Tier change detected:', { currentTier, fetchedTier });
            cachedTierRef.current = fetchedTier;
            saveTierToStorage(session.user.id, fetchedTier);
            
            const tierLimits = getTierLimits(fetchedTier);
            setUser(prev => {
              if (!prev) return prev;
              return {
                ...prev,
                tier: fetchedTier,
                listLimit: tierLimits.listLimit,
                itemsPerListLimit: tierLimits.itemsPerListLimit,
              };
            });
            
            notifyTierChange(fetchedTier, currentTier);
          }
        } catch (err) {
          console.error('[Auth Polling] Error polling tier:', err);
        }
      }, 30000);
    };
    
    setupUserRealtimeSubscription();

    return () => {
      isMounted = false;
      subscription.unsubscribe();
      if (userChannel) {
        supabase.removeChannel(userChannel);
      }
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, []);

  const setUserFromAuth = async (supabaseUser: SupabaseUser, fetchTier: boolean = true) => {
    let tier: 'free' | 'good' | 'even_better' | 'lots_more' = 'free';
    let avatarUrl: string | undefined = supabaseUser.user_metadata?.avatar_url || undefined;
    let userName: string = supabaseUser.user_metadata?.name || 'User';
    
    // If we have a cached tier for this user and don't need to fetch, use it
    // IMPORTANT: When fetchTier is true, we ALWAYS fetch from database to ensure sync with admin changes
    if (!fetchTier && supabaseUser.id === userIdRef.current && cachedTierRef.current) {
      tier = cachedTierRef.current as 'free' | 'good' | 'even_better' | 'lots_more';
      console.log('[Auth Debug] Using cached tier:', tier);
    } else {
      try {
        // Query the users table to get the actual tier with timeout
        // Use Promise.race for timeout handling
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(new Error('Tier fetch timeout after 5s'));
          }, 5000);
        });

        const queryPromise = supabase
          .from('users')
          .select('tier, avatar_url, name')
          .eq('id', supabaseUser.id)
          .single();

        const { data: userData, error: tierError } = await Promise.race([queryPromise, timeoutPromise]);

        console.log('[Auth Debug] Fetched from public.users:', {
          userId: supabaseUser.id,
          tier: userData?.tier,
          error: tierError?.message
        });

        if (tierError) {
          // If error and we have cached tier for same user, use it as fallback only
          if (supabaseUser.id === userIdRef.current && cachedTierRef.current) {
            tier = cachedTierRef.current as 'free' | 'good' | 'even_better' | 'lots_more';
            console.log('[Auth Debug] Error fetching, using cached tier:', tier);
          }
        } else if (userData) {
          // ALWAYS use the fetched tier from database - this is the source of truth
          // This allows both upgrades AND downgrades to take effect immediately
          tier = (userData.tier || 'free') as 'free' | 'good' | 'even_better' | 'lots_more';
          console.log('[Auth Debug] Using fetched tier (source of truth):', tier);
          
          // Get avatar_url from database (prioritize over auth metadata)
          if (userData.avatar_url) {
            avatarUrl = userData.avatar_url;
          }
          
          // Get name from database (prioritize over auth metadata)
          if (userData.name) {
            userName = userData.name;
          }
        }
      } catch (err: any) {
        console.error('[Auth Debug] Exception fetching tier:', err);
        // If error and we have cached tier for same user, use it as fallback only
        if (supabaseUser.id === userIdRef.current && cachedTierRef.current) {
          tier = cachedTierRef.current as 'free' | 'good' | 'even_better' | 'lots_more';
        }
      }
    }

    // Cache the tier and user ID
    cachedTierRef.current = tier;
    userIdRef.current = supabaseUser.id;
    
    // Also save to localStorage for persistence
    saveTierToStorage(supabaseUser.id, tier);

    const tierLimits = getTierLimits(tier);

    console.log('[Auth Debug] Final setUser call:', {
      userId: supabaseUser.id,
      tier,
      listLimit: tierLimits.listLimit,
      itemsPerListLimit: tierLimits.itemsPerListLimit
    });

    setUser({
      id: supabaseUser.id,
      email: supabaseUser.email || "",
      name: userName,
      createdAt: new Date(supabaseUser.created_at || new Date()),
      tier: tier,
      listLimit: tierLimits.listLimit,
      itemsPerListLimit: tierLimits.itemsPerListLimit,
      avatarUrl: avatarUrl,
    });

    setLoading(false);
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
        await setUserFromAuth(data.user, true);
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
        options: {
          data: { name },
        },
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

      // Use SECURITY DEFINER RPC to create user profile
      const { error: profileError } = await supabase.rpc('upsert_user_profile', {
        p_id: data.user.id,
        p_email: email,
        p_name: name,
        p_tier: "free",
        p_list_limit: tierLimits.listLimit,
        p_items_per_list_limit: tierLimits.itemsPerListLimit,
      });

      if (profileError) {
        logError("register:createProfile", profileError, data.user.id);
        throw profileError;
      }

      await setUserFromAuth(data.user, true);
    } catch (error: any) {
      logError("register", error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      // Clear cache on logout
      cachedTierRef.current = null;
      userIdRef.current = null;
      clearTierFromStorage();
      // Set user to null first to trigger immediate UI update
      setUser(null);
      // Then sign out from Supabase (await to ensure it completes)
      await supabase.auth.signOut();
    } catch (error: any) {
      logError("logout", error, user?.id);
      cachedTierRef.current = null;
      userIdRef.current = null;
      clearTierFromStorage();
      setUser(null);
    }
  };

  const updateUserTier = (
    tier: "free" | "good" | "even_better" | "lots_more",
  ) => {
    if (!user) return;

    const tierLimits = getTierLimits(tier);
    
    // Update cache immediately
    cachedTierRef.current = tier;
    saveTierToStorage(user.id, tier);

    Promise.resolve(
      supabase
        .from("users")
        .update({
          tier,
          list_limit: tierLimits.listLimit,
          items_per_list_limit: tierLimits.itemsPerListLimit,
          updated_at: new Date().toISOString(),
        } as any)
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
        redirectTo: 'https://app.listmine.com/auth/callback',
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

  const updateAvatar = async (file: File): Promise<string> => {
    if (!user) throw new Error("User not authenticated");

    try {
      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        throw new Error('Please upload a valid image file (JPEG, PNG, GIF, or WebP)');
      }

      // Validate file size (max 5MB)
      const maxSize = 5 * 1024 * 1024;
      if (file.size > maxSize) {
        throw new Error('Image must be less than 5MB');
      }

      // Generate unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true,
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw new Error('Failed to upload image');
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      const avatarUrl = urlData.publicUrl;

      // Update user metadata in auth
      const { error: authError } = await supabase.auth.updateUser({
        data: { avatar_url: avatarUrl },
      });

      if (authError) {
        console.warn("Could not update auth metadata:", authError.message);
      }

      // Update avatar_url in users table using RPC function
      const { error: dbError } = await supabase.rpc('update_user_avatar', {
        user_id: user.id,
        new_avatar_url: avatarUrl,
      });

      if (dbError) {
        console.error('Error updating avatar in database:', dbError);
        throw new Error('Failed to save avatar');
      }

      // Update local user state
      setUser({ ...user, avatarUrl });

      return avatarUrl;
    } catch (error: any) {
      logError("updateAvatar", error, user.id);
      throw error;
    }
  };

  const value: AuthContextType = useMemo(() => ({
    user,
    login,
    register,
    logout,
    signOut: logout,
    isAuthenticated: !!user,
    updateUserTier,
    resetPassword,
    updateEmail,
    updatePassword,
    updateProfile,
    updateAvatar,
    loading,
    error,
    getTierLimits,
    onTierChange,
  }), [user, loading, error, onTierChange]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};