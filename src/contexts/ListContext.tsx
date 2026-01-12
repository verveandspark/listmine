import {
  createContext,
  useEffect,
  useState,
  ReactNode,
  useContext,
  useRef,
  useMemo,
  useCallback,
} from "react";
import { supabase } from "@/lib/supabase";
import { List, ListItem, ListCategory, ListType, ListItemAttributes } from "@/types";
import { useAuth } from "./useAuthHook";
import {
  validateListName,
  validateCategory,
  validateImportData,
  validateItemName,
  validateQuantity,
  validateNotes,
  sanitizeInput,
  validateEmail,
  validateTag,
} from "@/lib/validation";
import html2pdf from "html2pdf.js";
import { canAccessListType, getAvailableListTypes, getTierDisplayName, canShareLists, canInviteGuests, canImportLists, getAvailableExportFormats, UserTier } from "@/lib/tierUtils";
import { useToast } from "@/components/ui/use-toast";

const OPERATION_TIMEOUT = 15000;

const withTimeout = <T,>(
  promise: Promise<T> | any,
  timeoutMs: number = OPERATION_TIMEOUT,
): Promise<T> => {
  return Promise.race([
    Promise.resolve(promise),
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("Operation timed out")), timeoutMs),
    ),
  ]);
};

const logError = (operation: string, error: any, userId?: string) => {
  console.error("[ListMine Error]", {
    operation,
    error: error.message || error,
    userId,
    timestamp: new Date().toISOString(),
  });
};

interface ListContextType {
  lists: List[];
  hasLoadedOnce: boolean;
  addList: (
    title: string,
    category: ListCategory,
    listType: ListType,
    accountId?: string | null,
  ) => Promise<string>;
  updateList: (id: string, updates: Partial<List>) => Promise<void>;
  deleteList: (id: string) => Promise<void>;
  restoreList: (listData: any) => Promise<void>;
  unarchiveList: (listId: string) => Promise<void>;
  addItemToList: (
    listId: string,
    item: Omit<ListItem, "id" | "order">,
  ) => Promise<void>;
  updateListItem: (
    listId: string,
    itemId: string,
    updates: Partial<ListItem>,
  ) => Promise<void>;
  deleteListItem: (listId: string, itemId: string) => Promise<void>;
  restoreListItem: (listId: string, itemData: any) => Promise<void>;
  bulkDeleteItems: (listId: string, itemIds: string[]) => Promise<void>;
  restoreBulkItems: (listId: string, itemsData: any[]) => Promise<void>;
  bulkUpdateItems: (
    listId: string,
    itemIds: string[],
    updates: Partial<ListItem>,
  ) => Promise<void>;
  reorderListItems: (listId: string, items: ListItem[]) => Promise<void>;
  toggleFavorite: (listId: string) => Promise<void>;
  importList: (
    data: string,
    format: "csv" | "txt",
    category: ListCategory,
    listType: ListType,
    accountId?: string | null,
  ) => Promise<void>;
  exportList: (listId: string, format: "csv" | "txt" | "pdf") => void;
  generateShareLink: (listId: string, shareMode?: 'view_only' | 'importable' | 'registry_buyer') => Promise<string>;
  updateShareMode: (listId: string, shareMode: 'view_only' | 'importable' | 'registry_buyer') => Promise<void>;
  unshareList: (listId: string) => Promise<void>;
  addCollaborator: (listId: string, email: string) => Promise<void>;
  searchLists: (query: string) => List[];
  searchAllLists: (query: string, filters?: {
    includeArchived?: boolean;
    favoritesOnly?: boolean;
    category?: ListCategory;
    type?: ListType;
  }) => Promise<List[]>;
  filterLists: (filters: {
    category?: ListCategory;
    type?: ListType;
    tags?: string[];
  }) => List[];
  addTagToList: (listId: string, tag: string) => Promise<void>;
  removeTagFromList: (listId: string, tag: string) => Promise<void>;
  importFromShareLink: (shareId: string, accountId?: string | null) => Promise<string>;
  importFromWishlist: (
    items: Array<{ name: string; price?: string; link?: string; image?: string }>,
    listName: string,
    category: ListCategory,
    importUrl: string,
    retailer: string,
    accountId?: string | null,
  ) => Promise<string>;
  loading: boolean;
  error: string | null;
  retryLoad: () => Promise<void>;
  refreshLists: () => Promise<void>;
}

// ListContext for managing list state across the application
// Context must be stable across hot module reloads
export const ListContext = createContext<ListContextType | undefined>(
  undefined,
);

export function ListProvider({ children }: { children: ReactNode }) {
  const [lists, setLists] = useState<List[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user, onTierChange } = useAuth();
  const { toast } = useToast();
  
  // Use refs to track current user and request ID to prevent race conditions
  const currentUserIdRef = useRef<string | null>(null);
  const currentUserTierRef = useRef<string | null>(null);
  const loadRequestIdRef = useRef(0);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isLoadingRef = useRef(false);
  const lastLoadTimeRef = useRef(0);

  // Debounced load function to prevent rapid reloads
  const debouncedLoadLists = (userId: string, userTier: string) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    // Longer debounce for realtime events to batch multiple changes
    debounceTimerRef.current = setTimeout(() => {
      // Skip if we just loaded within the last 500ms
      const now = Date.now();
      if (now - lastLoadTimeRef.current < 500) {
        // Skip - too soon since last load
        return;
      }
      loadLists(userId, userTier);
    }, 500);
  };

  useEffect(() => {
    const userId = user?.id || null;
    const userTier = user?.tier || 'free';
    
    // Only reload if user ID or tier actually changed
    const userChanged = userId !== currentUserIdRef.current;
    const tierChanged = userTier !== currentUserTierRef.current && userId === currentUserIdRef.current;
    
    if (userChanged || tierChanged) {
      
      // Reset hasLoadedOnce when user changes
      if (userChanged) {
        setHasLoadedOnce(false);
        setLists([]); // Clear lists immediately when user changes
      }
      
      currentUserIdRef.current = userId;
      currentUserTierRef.current = userTier;
      
      if (userId) {
        // Increment request ID to invalidate any in-flight requests
        loadRequestIdRef.current += 1;
        loadLists(userId, userTier);
      } else {
        setLists([]);
        setLoading(false);
        setHasLoadedOnce(false);
      }
    }

    let listsChannel: ReturnType<typeof supabase.channel> | null = null;
    let itemsChannel: ReturnType<typeof supabase.channel> | null = null;
    let favoritesChannel: ReturnType<typeof supabase.channel> | null = null;
    let teamListsChannel: ReturnType<typeof supabase.channel> | null = null;
    
    if (user) {
      // Use a stable channel name based only on user ID
      const channelName = `lists-changes-${user.id}`;
      listsChannel = supabase
        .channel(channelName)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "lists",
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            // Lists realtime event received
            // Use debounced reload to prevent rapid updates
            if (currentUserIdRef.current && currentUserTierRef.current) {
              debouncedLoadLists(currentUserIdRef.current, currentUserTierRef.current);
            }
          },
        )
        .subscribe();

      // Listen for ALL list changes to catch team list updates
      // This is necessary because team lists have the team owner's user_id, not the member's
      const teamListsChannelName = `team-lists-changes-${user.id}`;
      teamListsChannel = supabase
        .channel(teamListsChannelName)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "lists",
          },
          (payload) => {
            // Check if this is a team list change that affects the current user
            // We'll reload to be safe - the loadLists function will filter appropriately
            const record = payload.new as any || payload.old as any;
            if (record?.account_id) {
              // This is a team list change - reload to check if user has access
              if (currentUserIdRef.current && currentUserTierRef.current) {
                debouncedLoadLists(currentUserIdRef.current, currentUserTierRef.current);
              }
            }
          },
        )
        .subscribe();

      // Also listen for list_items changes to catch purchase status updates
      const itemsChannelName = `list-items-changes-${user.id}`;
      itemsChannel = supabase
        .channel(itemsChannelName)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "list_items",
          },
          () => {
            // List items realtime event received
            // Use debounced reload to prevent rapid updates
            if (currentUserIdRef.current && currentUserTierRef.current) {
              debouncedLoadLists(currentUserIdRef.current, currentUserTierRef.current);
            }
          },
        )
        .subscribe();

      // Listen for user_favorites changes to update favorite status in real-time
      const favoritesChannelName = `user-favorites-changes-${user.id}`;
      favoritesChannel = supabase
        .channel(favoritesChannelName)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "user_favorites",
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            // User favorites realtime event received
            if (currentUserIdRef.current && currentUserTierRef.current) {
              debouncedLoadLists(currentUserIdRef.current, currentUserTierRef.current);
            }
          },
        )
        .subscribe();
    }

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (listsChannel) {
        supabase.removeChannel(listsChannel);
      }
      if (teamListsChannel) {
        supabase.removeChannel(teamListsChannel);
      }
      if (itemsChannel) {
        supabase.removeChannel(itemsChannel);
      }
      if (favoritesChannel) {
        supabase.removeChannel(favoritesChannel);
      }
    };
  }, [user?.id, user?.tier]);

  // Guard to prevent stale UI during tier change processing
  const tierChangeInProgressRef = useRef<boolean>(false);
  
  // Subscribe to tier changes and refresh lists + show toast
  useEffect(() => {
    if (!onTierChange) {
      console.log('[ListContext TierChange] onTierChange not available, skipping subscription');
      return;
    }
    
    console.log('[ListContext TierChange] Registering tier change callback');
    
    const unsubscribe = onTierChange(async (newTier, prevTier) => {
      console.log('[ListContext TierChange] ====== TIER CHANGE CALLBACK FIRED ======');
      console.log('[ListContext TierChange] Tier changed from', prevTier, 'to', newTier);
      console.log('[ListContext TierChange] Current user ID:', currentUserIdRef.current);
      console.log('[ListContext TierChange] Timestamp:', new Date().toISOString());
      
      // Set guard to prevent stale UI
      tierChangeInProgressRef.current = true;
      
      const newTierTyped = newTier as UserTier;
      const prevTierTyped = prevTier as UserTier;
      
      // Update the current tier ref immediately
      currentUserTierRef.current = newTier;
      
      // Check if this is a downgrade that removes sharing capability
      const couldShareBefore = canShareLists(prevTierTyped);
      const canShareNow = canShareLists(newTierTyped);
      const couldInviteGuestsBefore = canInviteGuests(prevTierTyped);
      const canInviteGuestsNow = canInviteGuests(newTierTyped);
      
      console.log('[ListContext TierChange] Capability check:', {
        couldShareBefore,
        canShareNow,
        couldInviteGuestsBefore,
        canInviteGuestsNow
      });
      
      // Auto-unshare lists if user lost sharing capability
      // Policy: When downgrading from Good+ to Free, shared lists are unshared
      if (couldShareBefore && !canShareNow && currentUserIdRef.current) {
        console.log('[ListContext TierChange] User lost sharing capability, unsharing all shared lists in DB');
        try {
          // TS2589 workaround: avoid deep supabase-js builder inference by casting to any
          const userId: string = currentUserIdRef.current as string;
          const listsQuery = supabase.from('lists') as any;
          const { error, count } = await listsQuery
            .update({
              share_link: null,
              is_shared: false,
              share_mode: null,
            })
            .eq('user_id', userId)
            .eq('is_shared', true);
          
          if (error) {
            console.error('[ListContext TierChange] Error unsharing lists on downgrade:', error);
          } else {
            console.log('[ListContext TierChange] Successfully unshared all lists in DB, count:', count);
            // Show specific toast about unsharing
            if (count && count > 0) {
              toast({
                title: "Shared Lists Unshared",
                description: `Your plan no longer supports sharing. ${count} shared list(s) have been made private.`,
                variant: "destructive",
                duration: 8000,
              });
            }
          }
        } catch (err) {
          console.error('[ListContext TierChange] Exception unsharing lists on downgrade:', err);
        }
      }
      
      // Remove all guests if user lost guest invite capability
      // Policy: When downgrading from Even Better/Lots More to Good/Free, 
      // existing guests are removed since the plan no longer supports guest invites
      if (couldInviteGuestsBefore && !canInviteGuestsNow && currentUserIdRef.current) {
        console.log('[ListContext TierChange] User lost guest capability, removing all guests from DB');
        try {
          // TS2589 workaround: avoid deep supabase-js builder inference by casting to any
          const userId: string = currentUserIdRef.current as string;
          const guestsQuery = supabase.from('list_guests') as any;
          const { error, count } = await guestsQuery
            .delete()
            .eq('owner_id', userId);
          
          if (error) {
            console.error('[ListContext TierChange] Error removing guests on downgrade:', error);
          } else {
            console.log('[ListContext TierChange] Successfully removed all guests from DB, count:', count);
            // Show specific toast about guest removal
            if (count && count > 0) {
              toast({
                title: "Guests Removed",
                description: `Your plan no longer supports guest invites. ${count} guest(s) have been removed from your lists.`,
                variant: "destructive",
                duration: 8000,
              });
            }
          }
        } catch (err) {
          console.error('[ListContext TierChange] Exception removing guests on downgrade:', err);
        }
      }
      
      // Clear any pending/optimistic state
      console.log('[ListContext TierChange] Clearing pending state and forcing fresh load');
      isLoadingRef.current = false; // Reset loading flag to allow new load
      lastLoadTimeRef.current = 0; // Force fresh load
      
      // Refresh lists immediately with the new tier
      if (currentUserIdRef.current) {
        console.log('[ListContext TierChange] Triggering loadLists with new tier:', newTier);
        try {
          await loadLists(currentUserIdRef.current, newTier);
          console.log('[ListContext TierChange] Lists reloaded successfully');
        } catch (loadErr) {
          console.error('[ListContext TierChange] Error reloading lists:', loadErr);
        }
      }
      
      // Show toast notification - different messaging for upgrade vs downgrade
      const newTierName = getTierDisplayName(newTierTyped);
      const prevTierName = getTierDisplayName(prevTierTyped);
      
      // Determine if this is a downgrade based on tier order
      const tierOrder = ['free', 'good', 'even_better', 'lots_more'];
      const isDowngrade = tierOrder.indexOf(newTier) < tierOrder.indexOf(prevTier);
      
      // Always show main tier change toast
      toast({
        title: isDowngrade ? "Plan Downgraded" : "Plan Upgraded",
        description: isDowngrade 
          ? `Your plan was changed from ${prevTierName} to ${newTierName}. Some features may no longer be available.`
          : `Your plan was changed from ${prevTierName} to ${newTierName}. Enjoy your new features!`,
        variant: isDowngrade ? "destructive" : "default",
        duration: 8000,
      });
      
      // Clear the guard
      tierChangeInProgressRef.current = false;
      console.log('[ListContext TierChange] ====== TIER CHANGE PROCESSING COMPLETE ======');
    });
    
    console.log('[ListContext TierChange] Tier change callback registered successfully');
    
    return () => {
      console.log('[ListContext TierChange] Unsubscribing tier change callback');
      unsubscribe();
    };
  }, [onTierChange, toast]);

  const loadLists = async (targetUserId?: string, targetUserTier?: string) => {
    const userId = targetUserId || currentUserIdRef.current || user?.id;
    const userTier = (targetUserTier || currentUserTierRef.current || user?.tier || 'free') as UserTier;
    
    if (!userId) {
      setLists([]);
      setLoading(false);
      return;
    }

    // Prevent concurrent loads
    if (isLoadingRef.current) {
      // Load already in progress
      return;
    }

    // Capture the current request ID at the start
    const requestId = loadRequestIdRef.current;
    isLoadingRef.current = true;
    lastLoadTimeRef.current = Date.now();

    try {
      setLoading(true);
      setError(null);

      // Verify Supabase client is initialized
      if (!supabase) {
        throw new Error("Supabase client not initialized");
      }

      // Fetch owned lists
      const { data: ownedLists, error: ownedError } = await supabase
        .from("lists")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (ownedError) {
        // Check if it's a network error - don't throw, just log and retry later
        if (ownedError.message?.includes("Failed to fetch") || ownedError.message?.includes("NetworkError")) {
          console.warn("[ListMine Warning]", {
            operation: "loadLists - owned lists query",
            message: "Network error fetching lists, will retry on next load",
          });
          isLoadingRef.current = false;
          setLoading(false);
          return;
        }
        console.error("[ListMine Error]", {
          operation: "loadLists - owned lists query",
          error: ownedError,
          errorCode: ownedError.code,
          errorMessage: ownedError.message,
          userId: userId,
        });
        throw ownedError;
      }

      // Fetch team lists where user is a team member OR team owner
      // First, get accounts where user is a member
      const { data: teamMemberships, error: teamMemberError } = await supabase
        .from("account_team_members")
        .select("account_id")
        .eq("user_id", userId);

      // Also get accounts where user is the owner
      const { data: ownedAccounts, error: ownedAccountsError } = await supabase
        .from("accounts")
        .select("id, owner_id")
        .eq("owner_id", userId);

      let teamLists: any[] = [];
      
      // Create a map of account_id -> owner_id for all team accounts
      const accountOwnerMap = new Map<string, string>();
      
      // Combine account IDs from memberships and owned accounts
      const memberAccountIds = (!teamMemberError && teamMemberships) 
        ? teamMemberships.map((m) => m.account_id) 
        : [];
      const ownerAccountIds = (!ownedAccountsError && ownedAccounts) 
        ? ownedAccounts.map((a) => a.id) 
        : [];
      
      // Populate accountOwnerMap from owned accounts
      if (!ownedAccountsError && ownedAccounts) {
        ownedAccounts.forEach((a) => {
          accountOwnerMap.set(a.id, a.owner_id);
        });
      }
      
      // Deduplicate account IDs
      const allTeamAccountIds = [...new Set([...memberAccountIds, ...ownerAccountIds])];
      
      // Fetch owner info for accounts where user is a member (not owner)
      const memberOnlyIds = memberAccountIds.filter(id => !ownerAccountIds.includes(id));
      if (memberOnlyIds.length > 0) {
        const { data: memberAccountsData } = await supabase
          .from("accounts")
          .select("id, owner_id")
          .in("id", memberOnlyIds);
        
        if (memberAccountsData) {
          memberAccountsData.forEach((a) => {
            accountOwnerMap.set(a.id, a.owner_id);
          });
        }
      }

      if (allTeamAccountIds.length > 0) {
        // Check if user can access lists via RLS
        const { data: teamListsData, error: teamListsError } = await supabase
          .from("lists")
          .select("id, title, account_id, user_id, created_at")
          .in("account_id", allTeamAccountIds)
          .order("created_at", { ascending: false });
        
        if (teamListsError) {
          console.error("[ListMine Error] teamLists query error:", teamListsError);
        } else {
          // If we got results, fetch full data
          if (teamListsData && teamListsData.length > 0) {
            const teamListIds = teamListsData.map(l => l.id);
            const { data: fullTeamListsData, error: fullTeamListsError } = await supabase
              .from("lists")
              .select("*")
              .in("id", teamListIds)
              .order("created_at", { ascending: false });
            
            if (fullTeamListsError) {
              console.error("[ListMine Error] Full team lists query error:", fullTeamListsError);
              teamLists = [];
            } else {
              teamLists = fullTeamListsData || [];
            }
          } else {
            teamLists = [];
          }
        }
      }

      // Fetch lists where user is a guest (with permission)
      const { data: guestListData, error: guestIdsError } = await supabase
        .from("list_guests")
        .select("list_id, permission")
        .eq("user_id", userId);

      // Create a map of list_id -> permission for guest lists
      const guestPermissionMap = new Map<string, 'view' | 'edit'>();
      if (guestListData) {
        guestListData.forEach((g) => {
          guestPermissionMap.set(g.list_id, g.permission as 'view' | 'edit');
        });
      }

      if (guestIdsError) {
        console.error("[ListMine Error] guestListData query error:", guestIdsError);
      }

      let guestLists: any[] = [];
      if (guestListData && guestListData.length > 0) {
        const guestIds = guestListData.map((g) => g.list_id);
        
        const { data: guestListsData, error: guestListsError } = await supabase
          .from("lists")
          .select("*")
          .in("id", guestIds)
          .order("created_at", { ascending: false });
        
        if (guestListsError) {
          console.error("[ListMine Error] guestLists query error:", guestListsError);
        }
        
        guestLists = guestListsData || [];
      }

      // Combine owned, team, and guest lists (deduplicate by ID)
      const ownedIds = new Set((ownedLists || []).map((l) => l.id));
      const teamIds = new Set(teamLists.map((l) => l.id));
      const combinedLists = [
        ...(ownedLists || []),
        ...teamLists.filter((l) => !ownedIds.has(l.id)),
        ...guestLists.filter((l) => !ownedIds.has(l.id) && !teamIds.has(l.id)),
      ];
      const listsData = combinedLists;

      // Check if this request is still valid (user hasn't changed)
      if (requestId !== loadRequestIdRef.current || userId !== currentUserIdRef.current) {
        // Stale request detected
        isLoadingRef.current = false;
        return;
      }

      // Fetch user favorites
      const { data: userFavorites, error: favoritesError } = await supabase
        .from("user_favorites")
        .select("list_id")
        .eq("user_id", userId);
      
      const userFavoriteIds = new Set((userFavorites || []).map((f) => f.list_id));

      // Only fetch items if we have lists
      let itemsData: any[] = [];
      if (listsData && listsData.length > 0) {
        const { data: items, error: itemsError } = await supabase
          .from("list_items")
          .select("*")
          .in("list_id", listsData.map((l) => l.id));

        // Check again if this request is still valid
        if (requestId !== loadRequestIdRef.current || userId !== currentUserIdRef.current) {
      // Stale request after items query
          isLoadingRef.current = false;
          return;
        }

        if (itemsError) {
          // Check if it's a network error - don't throw, just log and continue with empty items
          if (itemsError.message?.includes("Failed to fetch") || itemsError.message?.includes("NetworkError")) {
            console.warn("[ListMine Warning]", {
              operation: "loadLists - items query",
              message: "Network error fetching items, will retry on next load",
            });
            // Continue with empty items - the realtime subscription will trigger a reload
          } else {
            console.error("[ListMine Error]", {
              operation: "loadLists - items query",
              error: itemsError,
            });
            throw itemsError;
          }
        }
        
        itemsData = items || [];

        // Sync purchase statuses from purchases table for registry/wishlist lists only
        // Note: shopping-list does NOT support purchase tracking
        const registryWishlistListIds = listsData
          .filter((l) => l.list_type === "registry-list" || l.list_type === "registry" || l.list_type === "wishlist")
          .map((l) => l.id);

        if (registryWishlistListIds.length > 0) {
          try {
            const { data: purchases } = await supabase
              .from("purchases")
              .select("item_id")
              .in("list_id", registryWishlistListIds);

            if (purchases && purchases.length > 0) {
              const purchasedItemIds = new Set(purchases.map((p) => p.item_id));
              
              // Update items that have purchases but don't have purchaseStatus set
              itemsData = itemsData.map((item) => {
                if (purchasedItemIds.has(item.id)) {
                  const currentAttributes = item.attributes || {};
                  if (currentAttributes.purchaseStatus !== "purchased") {
                    return {
                      ...item,
                      attributes: {
                        ...currentAttributes,
                        purchaseStatus: "purchased",
                      },
                    };
                  }
                }
                return item;
              });
            }
          } catch (purchaseError) {
            // Non-critical - just log and continue without purchase sync
            console.warn("[ListMine Warning]", {
              operation: "loadLists - purchases sync",
              message: "Failed to sync purchase statuses, will retry on next load",
            });
          }
        }
      }


      // Track which list IDs are guest-accessed (not owned by user)
      const guestListIdSet = new Set(guestLists.map((l) => l.id));
      
      // Track which account IDs the user is a member of (not owner) for team member permission
      const memberOnlyAccountIds = new Set(memberAccountIds.filter(id => !ownerAccountIds.includes(id)));
      
      const listsWithItems: List[] = listsData?.map((list) => ({
        id: list.id,
        userId: list.user_id,
        accountId: list.account_id || null,
        title: list.title,
        category: list.category as ListCategory,
        listType: (list.list_type || 'custom') as ListType,
        items: (itemsData?.filter((item) => item.list_id === list.id) || [])
          .sort((a, b) => (a.item_order || 0) - (b.item_order || 0))
          .map((item) => ({
          id: item.id,
          text: item.text,
          quantity: item.quantity || undefined,
          priority: item.priority as 'low' | 'medium' | 'high' | undefined,
          dueDate: item.due_date ? new Date(item.due_date) : undefined,
          notes: item.notes || undefined,
          completed: item.completed || false,
          order: item.item_order || 0,
          attributes: item.attributes as ListItemAttributes | undefined,
          links: item.links as string[] | undefined,
          assignedTo: item.assigned_to || undefined,
        })),
        isPinned: list.is_pinned || false,
        isFavorite: userFavoriteIds.has(list.id),
        isShared: list.is_shared || false,
        isArchived: list.is_archived || list.title?.startsWith("[Archived]") || false,
        shareLink: list.share_link || undefined,
        shareMode: list.share_mode || 'view_only',
        tags: (list.tags as string[]) || [],
        collaborators: [],
        createdAt: new Date(list.created_at),
        updatedAt: new Date(list.updated_at),
        showPurchaserInfo: list.show_purchaser_info || false,
        isGuestAccess: guestListIdSet.has(list.id),
        guestPermission: guestPermissionMap.get(list.id),
        // isTeamMember is true if the list belongs to a team account where user is a member (not owner)
        isTeamMember: list.account_id ? memberOnlyAccountIds.has(list.account_id) : false,
        // isTeamOwner is true if the list belongs to a team account where user is the owner
        isTeamOwner: list.account_id ? ownerAccountIds.includes(list.account_id) : false,
        // Store the account owner ID for team lists
        accountOwnerId: list.account_id ? accountOwnerMap.get(list.account_id) || null : null,
        // Source and template tracking
        source: list.source || 'standard',
        templateId: list.template_id || null,
        // Last edited tracking
        lastEditedByUserId: list.last_edited_by_user_id || null,
        lastEditedByEmail: list.last_edited_by_email || null,
        lastEditedAt: list.last_edited_at ? new Date(list.last_edited_at) : null,
      })) || [];

      // Split lists into categories for tier filtering
      // Tier limits should ONLY apply to personal owned lists, NOT team or guest/shared lists
      const personalOwnedLists = listsWithItems.filter(
        (list) => !list.accountId && !list.isGuestAccess && list.userId === userId
      );
      const teamOwnedLists = listsWithItems.filter(
        (list) => list.accountId !== null && list.accountId !== undefined
      );
      const guestSharedLists = listsWithItems.filter(
        (list) => list.isGuestAccess
      );
      
      // Apply tier limits ONLY to personal owned lists
      const limitedPersonalLists = personalOwnedLists.filter((list) => 
        canAccessListType(userTier, list.listType)
      );
      
      // DEFENSIVE UI: For Free tier users, sanitize any shared state that shouldn't exist
      // This prevents shared state from reappearing after refresh if DB cleanup failed
      const canShareNow = canShareLists(userTier);
      // Note: canInviteGuests check can be added here if needed for guest-related UI sanitization
      
      const sanitizedPersonalLists = limitedPersonalLists.map((list) => {
        if (!canShareNow && (list.isShared || list.shareLink)) {
          console.log('[ListContext] Defensive UI: Hiding share state for free tier list:', list.id);
          return {
            ...list,
            isShared: false,
            shareLink: undefined,
            shareMode: 'view_only' as const,
          };
        }
        return list;
      });
      
      // Recombine: tier-limited personal + all team + all guest/shared
      const filteredLists = [...sanitizedPersonalLists, ...teamOwnedLists, ...guestSharedLists];

      // Final check before setting state
      if (requestId !== loadRequestIdRef.current || userId !== currentUserIdRef.current) {
      // Stale request before setLists
        isLoadingRef.current = false;
        return;
      }

      setLists(filteredLists);
      setHasLoadedOnce(true);
    } catch (err: any) {
      // Don't set error if this is a stale request
      if (requestId !== loadRequestIdRef.current || userId !== currentUserIdRef.current) {
      // Stale request error
        isLoadingRef.current = false;
        return;
      }
      
      // Check if it's a network error - don't show error to user, just log
      const errorMessage = err instanceof Error ? err.message : "Failed to load lists";
      if (errorMessage.includes("Failed to fetch") || errorMessage.includes("NetworkError")) {
        console.warn("[ListMine Warning]", {
          operation: "loadLists",
          message: "Network error, will retry on next load",
        });
      } else {
        console.error("[ListMine Error]", {
          operation: "loadLists",
          error: err,
          errorMessage,
        });
        setError(errorMessage);
      }
    } finally {
      isLoadingRef.current = false;
      // Only set loading to false if this is still the current request
      if (requestId === loadRequestIdRef.current && userId === currentUserIdRef.current) {
        setLoading(false);
      }
    }
  };

  const addList = async (
    title: string,
    category: ListCategory,
    listType: ListType = "custom",
    accountId?: string | null,
  ): Promise<string> => {
    if (!user) throw new Error("User not authenticated");

    // Use getUser() to validate the JWT token server-side - this is the most reliable method
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
    
    if (authError) {
      console.error("[ListContext] Auth error before list creation:", authError);
      // Try to refresh the session
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
      
      if (refreshError || !refreshData?.session) {
        console.error("[ListContext] Failed to refresh session:", refreshError);
        throw new Error("Your session has expired. Please log in again.");
      }
      
      console.log("[ListContext] Session refreshed successfully after auth error");
    }
    
    if (!authUser) {
      console.error("[ListContext] No authenticated user found before list creation");
      throw new Error("Your session has expired. Please log in again.");
    }
    
    // Verify user ID matches between context and auth
    if (authUser.id !== user.id) {
      console.error("[ListContext] User ID mismatch:", { 
        authUserId: authUser.id, 
        contextUserId: user.id 
      });
      throw new Error("Session mismatch. Please log in again.");
    }
    
    console.log("[ListContext] User verified for list creation:", {
      userId: user.id,
      authUserId: authUser.id,
      userIdsMatch: authUser.id === user.id
    });

    const nameValidation = validateListName(title);
    if (!nameValidation.valid) {
      throw new Error(nameValidation.error);
    }

    const categoryValidation = validateCategory(category);
    if (!categoryValidation.valid) {
      throw new Error(categoryValidation.error);
    }

    // For team lists, always use 'lots_more' tier - no restrictions for team members
    // For personal lists, use the user's own tier
    let effectiveTier: UserTier = accountId ? 'lots_more' : (user.tier || 'free') as UserTier;
    let effectiveListLimit = accountId ? -1 : user.listLimit; // -1 = unlimited for team lists
    let teamOwnerId: string | null = null;
    
    if (accountId) {
      // Fetch the team account to get the owner for reference (not for tier gating)
      const { data: teamAccount, error: teamAccountError } = await supabase
        .from("accounts")
        .select("owner_id")
        .eq("id", accountId)
        .single();
      
      if (teamAccountError) {
        console.error("[ListContext] Error fetching team account:", teamAccountError);
      } else if (teamAccount) {
        teamOwnerId = teamAccount.owner_id;
        console.log("[ListContext] Team list creation - using lots_more tier:", {
          teamOwnerId: teamAccount.owner_id,
          effectiveTier,
          effectiveListLimit,
        });
      }
    }
    
    // Validate list type access based on effective tier (lots_more for team lists)
    if (!canAccessListType(effectiveTier, listType)) {
      throw new Error(
        `${listType} lists are not available on your current tier. Please upgrade to access this list type.`
      );
    }

    const existingList = lists.find(
      (l) => l.title.toLowerCase() === nameValidation.value!.toLowerCase(),
    );
    if (existingList) {
      throw new Error(
        `This list name already exists. Try another name like "${nameValidation.value} 2" or "${nameValidation.value} - New".`,
      );
    }

    // For personal lists, check user's own limits
    // For team lists, check team owner's limits against team lists only
    if (!accountId) {
      // Personal list: count only personal owned lists (exclude guest access, archived, and team lists)
      const personalActiveListsCount = lists.filter(
        (l) => l.userId === user.id && !l.isGuestAccess && !l.isArchived && !l.title.startsWith("[Archived]") && !l.accountId
      ).length;
      
      console.log("[ListContext] Personal list limit check:", {
        personalActiveListsCount,
        userListLimit: user.listLimit,
        userId: user.id,
      });
      
      if (user.listLimit !== -1 && personalActiveListsCount >= user.listLimit) {
        const tierName =
          user.tier === "free"
            ? "Free"
            : user.tier === "good"
              ? "Good"
              : user.tier === "even_better"
                ? "Even Better"
                : "Lots More";
        throw new Error(
          `You've reached your limit of ${user.listLimit} personal lists on the ${tierName} tier. Upgrade to create more lists.`,
        );
      }
    } else {
      // Team list: count team lists for this account
      const teamActiveListsCount = lists.filter(
        (l) => l.accountId === accountId && !l.isArchived && !l.title.startsWith("[Archived]")
      ).length;
      
      console.log("[ListContext] Team list limit check:", {
        teamActiveListsCount,
        effectiveListLimit,
        accountId,
      });
      
      // Team lists use the team owner's list limit
      // Note: For team accounts, we might want unlimited lists or a separate limit
      // For now, we'll use the team owner's limit but this could be adjusted
      if (effectiveListLimit !== -1 && teamActiveListsCount >= effectiveListLimit) {
        throw new Error(
          `This team has reached its limit of ${effectiveListLimit} lists. The team owner needs to upgrade to create more team lists.`,
        );
      }
    }

    try {
      // Use getUser() to validate the JWT token server-side and get the authenticated user
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
      
      if (authError) {
        console.error("[ListContext] Auth error before list creation:", authError);
        throw new Error("Authentication error. Please log in again.");
      }
      
      if (!authUser) {
        console.error("[ListContext] No authenticated user found");
        throw new Error("You must be logged in to create a list. Please log in again.");
      }
      
      // For team lists, use the team owner's ID as user_id so the owner always has full control
      // For personal lists, use the authenticated user's ID
      const insertUserId = (accountId && teamOwnerId) ? teamOwnerId : authUser.id;
      
      console.log("[ListContext] List creation user_id:", {
        isTeamList: !!accountId,
        teamOwnerId,
        authUserId: authUser.id,
        insertUserId,
      });
      
      // Build the insert payload
      const insertPayload: {
        user_id: string;
        title: string;
        category: string;
        list_type: string;
        account_id?: string | null;
      } = {
        user_id: insertUserId,
        title: nameValidation.value,
        category: categoryValidation.value,
        list_type: listType,
      };
      
      // Add account_id if provided (for team lists)
      if (accountId !== undefined && accountId !== null) {
        insertPayload.account_id = accountId;
      }
      
      // Ensure user profile exists in public.users table via SECURITY DEFINER RPC (non-fatal)
      // This is best-effort - list creation proceeds even if profile upsert fails
      try {
        const { error: upsertError } = await supabase.rpc('upsert_user_profile', {
          p_id: insertUserId,
          p_email: authUser.email || "",
          p_name: authUser.email?.split("@")[0] || "User",
          p_tier: "free",
          p_list_limit: 5,
          p_items_per_list_limit: 20,
        });
        
        if (upsertError) {
          // Log but don't abort - profile may already exist or have different values
          console.warn("[ListContext] User profile upsert warning (non-fatal):", upsertError);
        }
      } catch (profileError) {
        // Non-fatal - proceed with list creation anyway
        console.warn("[ListContext] User profile ensure failed (non-fatal):", profileError);
      }
      
      const { data: newList, error } = await supabase
        .from("lists")
        .insert([insertPayload])
        .select()
        .single();

      if (error) {
        console.error("[ListContext] List creation error:", error);
        if (error.message.includes("unique")) {
          throw new Error("This list name already exists. Try another name.");
        }
        // Handle RLS violation specifically
        if (error.message.includes("row-level security") || error.code === "42501") {
          console.error("[ListContext] RLS violation - attempting SECURITY DEFINER function fallback");
          
          // Use the SECURITY DEFINER function as fallback
          const { data: rpcData, error: rpcError } = await supabase.rpc('create_list_for_user', {
            p_user_id: insertUserId,
            p_list_name: nameValidation.value,
            p_category: categoryValidation.value,
            p_list_type: listType,
            p_account_id: accountId || null,
          });
          
          if (rpcError) {
            console.error("[ListContext] RPC fallback failed:", rpcError);
            // Try session refresh as last resort
            const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
            if (refreshError || !refreshData?.session) {
              throw new Error("Your session has expired. Please log in again.");
            }
            
            await new Promise(resolve => setTimeout(resolve, 150));
            
            // Re-validate user after refresh using getUser()
            const { data: { user: refreshedUser }, error: refreshedUserError } = await supabase.auth.getUser();
            if (refreshedUserError || !refreshedUser) {
              console.error("[ListContext] Failed to get user after refresh:", refreshedUserError);
              throw new Error("Your session has expired. Please log in again.");
            }
            
            // For team lists, still use the team owner's ID
            const retryUserId = (accountId && teamOwnerId) ? teamOwnerId : refreshedUser.id;
            
            // Retry with RPC after refresh
            const { data: retryRpcData, error: retryRpcError } = await supabase.rpc('create_list_for_user', {
              p_user_id: retryUserId,
              p_list_name: nameValidation.value,
              p_category: categoryValidation.value,
              p_list_type: listType,
              p_account_id: accountId || null,
            });
            
            if (retryRpcError) {
              console.error("[ListContext] Retry RPC after refresh failed:", retryRpcError);
              throw new Error("Unable to create list. Please log out and log back in.");
            }
            
            const retryCreated = Array.isArray(retryRpcData) ? retryRpcData[0] : retryRpcData;
            const retryListId = retryCreated?.id;
            
            await loadLists();
            return retryListId;
          }
          
          const created = Array.isArray(rpcData) ? rpcData[0] : rpcData;
          const newListId = created?.id;
          console.log("[ListContext] List created via RPC fallback:", newListId);
          await loadLists();
          return newListId;
        }
        throw error;
      }

      await loadLists();
      return newList.id;
    } catch (error: any) {
      logError("addList", error, user?.id);

      if (error.message === "Operation timed out") {
        throw new Error(
          "This is taking longer than expected. Try again in a moment.",
        );
      } else if (
        error.message.includes("network") ||
        error.message.includes("fetch")
      ) {
        throw new Error("Connection lost. Check your internet and try again.");
      } else if (error.message.includes("rate limit")) {
        throw new Error(
          "Slow down! You're making too many requests. Wait a moment and try again.",
        );
      } else if (
        error.message.includes("JWT") ||
        error.message.includes("token")
      ) {
        throw new Error("Your session has expired. Please log in again.");
      } else if (
        error.message.includes("row-level security") ||
        error.code === "42501"
      ) {
        throw new Error("Session error. Please log out and log back in.");
      } else if (
        !error.message.includes("already exists") &&
        !error.message.includes("limit") &&
        !error.message.includes("session")
      ) {
        throw new Error("Couldn't create list. Try again or contact support.");
      }
      throw error;
    }
  };

  const updateList = async (listId: string, updates: Partial<List>) => {
    try {
      const result = (await withTimeout(
        supabase
          .from("lists")
          .update({
            title: updates.title,
            category: updates.category,
            list_type: updates.listType,
            is_pinned: updates.isPinned,
            is_favorite: updates.isFavorite,
            tags: updates.tags,
            updated_at: new Date().toISOString(),
            last_edited_by_user_id: user?.id || null,
            last_edited_by_email: user?.email || null,
            last_edited_at: new Date().toISOString(),
          })
          .eq("id", listId),
      )) as any;
      const { error } = result;

      if (error) throw error;
      await loadLists();
    } catch (error: any) {
      logError("updateList", error, user?.id);

      if (error.message === "Operation timed out") {
        throw new Error(
          "This is taking longer than expected. Try again in a moment.",
        );
      } else if (
        error.message.includes("network") ||
        error.message.includes("fetch")
      ) {
        throw new Error("Connection lost. Check your internet and try again.");
      } else {
        throw new Error("Couldn't update list. Try again or contact support.");
      }
    }
  };

  const deleteList = async (listId: string) => {
    try {
      const result = (await withTimeout(
        supabase.from("lists").delete().eq("id", listId),
      )) as any;
      const { error } = result;

      if (error) throw error;
      await loadLists();
    } catch (error: any) {
      logError("deleteList", error, user?.id);

      if (error.message === "Operation timed out") {
        throw new Error(
          "This is taking longer than expected. Try again in a moment.",
        );
      } else if (
        error.message.includes("network") ||
        error.message.includes("fetch")
      ) {
        throw new Error("Connection lost. Check your internet and try again.");
      } else {
        throw new Error("Couldn't delete list. Try again or contact support.");
      }
    }
  };

  // Restore a deleted list with all its items
  const restoreList = async (listData: any) => {
    try {
      // First restore the list
      const { data: restoredList, error: listError } = await supabase
        .from("lists")
        .insert({
          id: listData.id,
          user_id: listData.user_id,
          title: listData.title,
          category: listData.category,
          list_type: listData.list_type,
          is_pinned: listData.is_pinned,
          tags: listData.tags,
          share_id: listData.share_id,
          show_purchaser_info: listData.show_purchaser_info,
          created_at: listData.created_at,
          updated_at: new Date().toISOString(),
          last_edited_by_user_id: user?.id || null,
          last_edited_by_email: user?.email || null,
          last_edited_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (listError) throw listError;

      // Then restore all items if any
      if (listData.items && listData.items.length > 0) {
        const itemsToInsert = listData.items.map((item: any) => ({
          id: item.id,
          list_id: listData.id,
          text: item.text,
          quantity: item.quantity,
          priority: item.priority,
          due_date: item.due_date,
          notes: item.notes,
          assigned_to: item.assigned_to,
          completed: item.completed,
          links: item.links,
          attributes: item.attributes,
          item_order: item.item_order,
          created_at: item.created_at,
          updated_at: new Date().toISOString(),
          last_edited_by_user_id: user?.id || null,
          last_edited_by_email: user?.email || null,
          last_edited_at: new Date().toISOString(),
        }));

        const { error: itemsError } = await supabase
          .from("list_items")
          .insert(itemsToInsert);

        if (itemsError) throw itemsError;
      }

      await loadLists();
    } catch (error: any) {
      logError("restoreList", error, user?.id);
      throw new Error("Couldn't restore list. Try again or contact support.");
    }
  };

  // Unarchive a list (restore from archived state)
  const unarchiveList = async (listId: string) => {
    try {
      const list = lists.find((l) => l.id === listId);
      if (!list) throw new Error("List not found");

      // Remove [Archived] prefix from title if present
      let newTitle = list.title;
      if (newTitle.startsWith("[Archived] ")) {
        newTitle = newTitle.replace("[Archived] ", "");
      }

      const { error } = await supabase
        .from("lists")
        .update({
          is_archived: false,
          title: newTitle,
          updated_at: new Date().toISOString(),
          last_edited_by_user_id: user?.id || null,
          last_edited_by_email: user?.email || null,
          last_edited_at: new Date().toISOString(),
        })
        .eq("id", listId);

      if (error) throw error;
      await loadLists();
    } catch (error: any) {
      logError("unarchiveList", error, user?.id);
      throw new Error("Couldn't restore list. Try again or contact support.");
    }
  };

  const addItemToList = async (
    listId: string,
    item: Omit<ListItem, "id" | "order">,
  ) => {
    const list = lists.find((l) => l.id === listId);
    if (!list) return;

    const nameValidation = validateItemName(item.text);
    if (!nameValidation.valid) {
      throw new Error(nameValidation.error);
    }

    if (item.quantity !== undefined) {
      const quantityValidation = validateQuantity(item.quantity);
      if (!quantityValidation.valid) {
        throw new Error(quantityValidation.error);
      }
    }

    if (item.notes) {
      const notesValidation = validateNotes(item.notes);
      if (!notesValidation.valid) {
        throw new Error(notesValidation.error);
      }
    }

    // Note: Duplicate items are allowed - users may want multiple of the same item

    // Item limit check - only applies to personal lists (no accountId)
    // Team lists bypass personal item limits
    if (
      user &&
      !list.accountId &&
      user.itemsPerListLimit !== -1 &&
      list.items.length >= user.itemsPerListLimit
    ) {
      const tierName =
        user.tier === "free"
          ? "Free"
          : user.tier === "good"
            ? "Good"
            : user.tier === "even_better"
              ? "Even Better"
              : "Lots More";
      throw new Error(
        `This list has reached the ${user.itemsPerListLimit} item limit for your ${tierName} tier. Upgrade to add more items.`,
      );
    }

    try {
      const result = (await withTimeout(
        supabase.from("list_items").insert({
          list_id: listId,
          text: nameValidation.value,
          quantity: item.quantity,
          priority: item.priority,
          due_date: item.dueDate?.toISOString(),
          notes: item.notes ? sanitizeInput(item.notes) : null,
          assigned_to: item.assignedTo ? sanitizeInput(item.assignedTo) : null,
          completed: item.completed || false,
          item_order: list.items.length,
          links: item.links,
          attributes: item.attributes,
          last_edited_by_user_id: user?.id || null,
          last_edited_by_email: user?.email || null,
          last_edited_at: new Date().toISOString(),
        }),
      )) as any;
      const { error } = result;

      if (error) throw error;

      // Also update the parent list's last edited info
      await supabase
        .from("lists")
        .update({
          updated_at: new Date().toISOString(),
          last_edited_by_user_id: user?.id || null,
          last_edited_by_email: user?.email || null,
          last_edited_at: new Date().toISOString(),
        })
        .eq("id", listId);

      await loadLists();
    } catch (error: any) {
      logError("addItemToList", error, user?.id);

      if (error.message === "Operation timed out") {
        throw new Error(
          "This is taking longer than expected. Try again in a moment.",
        );
      } else if (
        error.message.includes("network") ||
        error.message.includes("fetch")
      ) {
        throw new Error("Connection lost. Check your internet and try again.");
      } else if (error.message.includes("rate limit")) {
        throw new Error(
          "Slow down! You're making too many requests. Wait a moment and try again.",
        );
      } else if (
        !error.message.includes("blank") &&
        !error.message.includes("already exists") &&
        !error.message.includes("limit")
      ) {
        throw new Error("Couldn't add item. Try again or contact support.");
      }
      throw error;
    }
  };

  const updateListItem = async (
    listId: string,
    itemId: string,
    updates: Partial<ListItem>,
  ) => {
    try {
      const updateData: any = {
        updated_at: new Date().toISOString(),
        last_edited_by_user_id: user?.id || null,
        last_edited_by_email: user?.email || null,
        last_edited_at: new Date().toISOString(),
      };

      // Only include fields that are being updated
      if (updates.text !== undefined) updateData.text = updates.text;
      if (updates.quantity !== undefined)
        updateData.quantity = updates.quantity;
      if (updates.priority !== undefined)
        updateData.priority = updates.priority;
      if (updates.dueDate !== undefined)
        updateData.due_date = updates.dueDate?.toISOString();
      if (updates.notes !== undefined) updateData.notes = updates.notes;
      if (updates.assignedTo !== undefined)
        updateData.assigned_to = updates.assignedTo;
      if (updates.completed !== undefined)
        updateData.completed = updates.completed;
      if (updates.links !== undefined) updateData.links = updates.links;
      if (updates.attributes !== undefined)
        updateData.attributes = updates.attributes;

      const result = await supabase
        .from("list_items")
        .update(updateData)
        .eq("id", itemId);
      const { error } = result;

      if (error) throw error;
      
      // Also update the parent list's last edited info
      await supabase
        .from("lists")
        .update({
          updated_at: new Date().toISOString(),
          last_edited_by_user_id: user?.id || null,
          last_edited_by_email: user?.email || null,
          last_edited_at: new Date().toISOString(),
        })
        .eq("id", listId);
      
      await loadLists();
    } catch (error: any) {
      logError("updateListItem", error, user?.id);
      throw error;
    }
  };

  const deleteListItem = async (listId: string, itemId: string) => {
    try {
      const result = await supabase.from("list_items").delete().eq("id", itemId);
      const { error } = result;

      if (error) throw error;
      
      // Update the parent list's last edited info
      await supabase
        .from("lists")
        .update({
          updated_at: new Date().toISOString(),
          last_edited_by_user_id: user?.id || null,
          last_edited_by_email: user?.email || null,
          last_edited_at: new Date().toISOString(),
        })
        .eq("id", listId);
      
      await loadLists();
    } catch (error: any) {
      logError("deleteListItem", error, user?.id);
      throw error;
    }
  };

  const bulkDeleteItems = async (listId: string, itemIds: string[]) => {
    try {
      const result = await supabase.from("list_items").delete().in("id", itemIds);
      const { error } = result;

      if (error) throw error;
      
      // Update the parent list's last edited info
      await supabase
        .from("lists")
        .update({
          updated_at: new Date().toISOString(),
          last_edited_by_user_id: user?.id || null,
          last_edited_by_email: user?.email || null,
          last_edited_at: new Date().toISOString(),
        })
        .eq("id", listId);
      
      await loadLists();
    } catch (error: any) {
      logError("bulkDeleteItems", error, user?.id);
      throw error;
    }
  };

  // Restore a single deleted item
  const restoreListItem = async (listId: string, itemData: any) => {
    try {
      const { error } = await supabase.from("list_items").insert({
        id: itemData.id,
        list_id: listId,
        text: itemData.text,
        quantity: itemData.quantity,
        priority: itemData.priority,
        due_date: itemData.due_date,
        notes: itemData.notes,
        assigned_to: itemData.assigned_to,
        completed: itemData.completed,
        links: itemData.links,
        attributes: itemData.attributes,
        item_order: itemData.item_order,
        created_at: itemData.created_at,
        updated_at: new Date().toISOString(),
        last_edited_by_user_id: user?.id || null,
        last_edited_by_email: user?.email || null,
        last_edited_at: new Date().toISOString(),
      });

      if (error) throw error;
      
      // Update the parent list's last edited info
      await supabase
        .from("lists")
        .update({
          updated_at: new Date().toISOString(),
          last_edited_by_user_id: user?.id || null,
          last_edited_by_email: user?.email || null,
          last_edited_at: new Date().toISOString(),
        })
        .eq("id", listId);
      
      await loadLists();
    } catch (error: any) {
      logError("restoreListItem", error, user?.id);
      throw new Error("Couldn't restore item. Try again or contact support.");
    }
  };

  // Restore multiple deleted items
  const restoreBulkItems = async (listId: string, itemsData: any[]) => {
    try {
      const itemsToInsert = itemsData.map((item) => ({
        id: item.id,
        list_id: listId,
        text: item.text,
        quantity: item.quantity,
        priority: item.priority,
        due_date: item.due_date,
        notes: item.notes,
        assigned_to: item.assigned_to,
        completed: item.completed,
        links: item.links,
        attributes: item.attributes,
        item_order: item.item_order,
        created_at: item.created_at,
        updated_at: new Date().toISOString(),
        last_edited_by_user_id: user?.id || null,
        last_edited_by_email: user?.email || null,
        last_edited_at: new Date().toISOString(),
      }));

      const { error } = await supabase.from("list_items").insert(itemsToInsert);

      if (error) throw error;
      
      // Update the parent list's last edited info
      await supabase
        .from("lists")
        .update({
          updated_at: new Date().toISOString(),
          last_edited_by_user_id: user?.id || null,
          last_edited_by_email: user?.email || null,
          last_edited_at: new Date().toISOString(),
        })
        .eq("id", listId);
      
      await loadLists();
    } catch (error: any) {
      logError("restoreBulkItems", error, user?.id);
      throw new Error("Couldn't restore items. Try again or contact support.");
    }
  };

  const bulkUpdateItems = async (
    listId: string,
    itemIds: string[],
    updates: Partial<ListItem>,
  ) => {
    try {
      const result = await supabase
        .from("list_items")
        .update({
          completed: updates.completed,
          priority: updates.priority,
          updated_at: new Date().toISOString(),
          last_edited_by_user_id: user?.id || null,
          last_edited_by_email: user?.email || null,
          last_edited_at: new Date().toISOString(),
        })
        .in("id", itemIds);
      const { error } = result;

      if (error) throw error;
      
      // Update the parent list's last edited info
      await supabase
        .from("lists")
        .update({
          updated_at: new Date().toISOString(),
          last_edited_by_user_id: user?.id || null,
          last_edited_by_email: user?.email || null,
          last_edited_at: new Date().toISOString(),
        })
        .eq("id", listId);
      
      await loadLists();
    } catch (error: any) {
      logError("bulkUpdateItems", error, user?.id);
      throw error;
    }
  };

  const reorderListItems = async (listId: string, items: ListItem[]) => {
    try {
      // Optimistically update local state first for smooth UX
      setLists((prevLists) =>
        prevLists.map((list) =>
          list.id === listId
            ? { ...list, items: items.map((item, index) => ({ ...item, order: index })) }
            : list
        )
      );

      // Then persist to database
      for (const item of items) {
        const index = items.indexOf(item);
        const result = await supabase
          .from("list_items")
          .update({ item_order: index })
          .eq("id", item.id);
        const { error } = result;
        if (error) throw error;
      }
      
      // Update the parent list's last edited info
      await supabase
        .from("lists")
        .update({
          updated_at: new Date().toISOString(),
          last_edited_by_user_id: user?.id || null,
          last_edited_by_email: user?.email || null,
          last_edited_at: new Date().toISOString(),
        })
        .eq("id", listId);
    } catch (error: any) {
      logError("reorderListItems", error, user?.id);
      // Reload lists to restore correct state on error
      await loadLists();
      throw error;
    }
  };

  const toggleFavorite = async (listId: string) => {
    const list = lists.find((l) => l.id === listId);
    if (!list || !user) return;

    const newFavoriteState = !list.isFavorite;

    // Optimistically update local state first for smooth UX
    setLists((prevLists) =>
      prevLists.map((l) =>
        l.id === listId ? { ...l, isFavorite: newFavoriteState } : l
      )
    );

    try {
      // Use the RPC function to toggle user-specific favorite
      const { data, error } = await supabase.rpc("toggle_user_favorite", {
        p_list_id: listId,
      });

      if (error) throw error;
      
      // Verify the result from the RPC
      if (data && typeof data === 'object') {
        const result = data as { success: boolean; is_favorite: boolean; action: string; error?: string };
        if (!result.success) {
          throw new Error(result.error || "Failed to toggle favorite");
        }
        
        // Update state with the actual result from the server
        setLists((prevLists) => {
          const updatedLists = prevLists.map((l) =>
            l.id === listId ? { ...l, isFavorite: result.is_favorite } : l
          );
          return updatedLists;
        });
      }
    } catch (error: any) {
      console.error("[ListMine Error] toggleFavorite failed:", error);
      // Revert optimistic update on error
      setLists((prevLists) =>
        prevLists.map((l) =>
          l.id === listId ? { ...l, isFavorite: list.isFavorite } : l
        )
      );
      logError("toggleFavorite", error, user?.id);
      throw new Error("Couldn't update favorite status. Try again.");
    }
  };

  const importList = async (
    data: string,
    format: "csv" | "txt",
    category: ListCategory,
    listType: ListType = "custom",
    accountId?: string | null,
  ) => {
    if (!user) return;
    
    // For team imports (accountId != null), always use lots_more tier
    const effectiveTier: UserTier = accountId ? 'lots_more' : (user.tier || 'free') as UserTier;
    
    // Check tier permission for import (only applies to personal imports)
    if (!canImportLists(effectiveTier)) {
      toast({
        title: "Plan Changed",
        description: "Your plan changed. Import is no longer available.",
        variant: "destructive",
        duration: 5000,
      });
      throw new Error("Import is not available on your current plan.");
    }

    if (!data.trim()) {
      throw new Error(
        "This file appears to be empty. Add some items and try again.",
      );
    }

    const lines = data.split("\n").filter((line) => line.trim());

    if (lines.length === 0) {
      throw new Error(
        "This file appears to be empty. Add some items and try again.",
      );
    }

    const items: Omit<ListItem, "id" | "order">[] = [];

    try {
      if (format === "csv") {
        if (lines.length < 2) {
          throw new Error(
            "We couldn't read this file. Make sure it's a valid CSV file with headers.",
          );
        }
        
        const headers = lines[0]
          .toLowerCase()
          .split(",")
          .map((h) => h.trim().replace(/^"|"$/g, ""));
        
        for (let i = 1; i < lines.length; i++) {
          // Parse CSV line handling quoted fields
          const values: string[] = [];
          let currentValue = "";
          let insideQuotes = false;
          
          for (let j = 0; j < lines[i].length; j++) {
            const char = lines[i][j];
            if (char === '"') {
              insideQuotes = !insideQuotes;
            } else if (char === ',' && !insideQuotes) {
              values.push(currentValue.trim());
              currentValue = "";
            } else {
              currentValue += char;
            }
          }
          values.push(currentValue.trim());
          
          const getValueByHeader = (headerName: string) => {
            const index = headers.indexOf(headerName);
            return index >= 0 ? values[index]?.replace(/^"|"$/g, "") : "";
          };
          
          const itemText = getValueByHeader("item name") || getValueByHeader("text") || getValueByHeader("name") || values[0] || "";
          
          if (!itemText) continue;
          
          const item: Omit<ListItem, "id" | "order"> = {
            text: itemText,
            completed: getValueByHeader("completed") === "true",
          };

          const quantity = getValueByHeader("quantity");
          if (quantity) item.quantity = parseInt(quantity);

          const priority = getValueByHeader("priority");
          if (priority && ["low", "medium", "high"].includes(priority.toLowerCase())) {
            item.priority = priority.toLowerCase() as "low" | "medium" | "high";
          }

          const dueDate = getValueByHeader("due date");
          if (dueDate) {
            const parsedDate = new Date(dueDate);
            if (!isNaN(parsedDate.getTime())) {
              item.dueDate = parsedDate;
            }
          }

          const notes = getValueByHeader("notes");
          if (notes) item.notes = notes;

          const assignedTo = getValueByHeader("assigned to");
          if (assignedTo) item.assignedTo = assignedTo;

          const link = getValueByHeader("link") || getValueByHeader("links");
          if (link) {
            item.links = link.split(";").map(l => l.trim()).filter(l => l);
          }

          const tags = getValueByHeader("tags");
          if (tags) {
            item.attributes = { 
              ...item.attributes, 
              custom: { tags: tags } 
            };
          }

          items.push(item);
        }
      } else {
        // TXT format - parse formatted text
        let currentItem: Omit<ListItem, "id" | "order"> | null = null;
        
        for (const line of lines) {
          const trimmedLine = line.trim();
          
          // Check if it's a new item (starts with □, ☐, -, *, or bullet)
          if (trimmedLine.match(/^[□☐\-\*•]\s+/)) {
            if (currentItem) items.push(currentItem);
            
            const itemText = trimmedLine.replace(/^[□☐\-\*•]\s+/, "").trim();
            currentItem = {
              text: itemText,
              completed: false,
            };
          } else if (currentItem) {
            // Parse item attributes
            if (trimmedLine.toLowerCase().startsWith("notes:")) {
              currentItem.notes = trimmedLine.substring(6).trim();
            } else if (trimmedLine.toLowerCase().startsWith("link:")) {
              const link = trimmedLine.substring(5).trim();
              currentItem.links = [link];
            } else if (trimmedLine.toLowerCase().startsWith("due:")) {
              const dateStr = trimmedLine.substring(4).trim();
              const parsedDate = new Date(dateStr);
              if (!isNaN(parsedDate.getTime())) {
                currentItem.dueDate = parsedDate;
              }
            } else if (trimmedLine.toLowerCase().startsWith("priority:")) {
              const priority = trimmedLine.substring(9).trim().toLowerCase();
              if (["low", "medium", "high"].includes(priority)) {
                currentItem.priority = priority as "low" | "medium" | "high";
              }
            } else if (trimmedLine.toLowerCase().startsWith("assigned:")) {
              currentItem.assignedTo = trimmedLine.substring(9).trim();
            } else if (trimmedLine.toLowerCase().startsWith("tags:")) {
              const tags = trimmedLine.substring(5).trim();
              currentItem.attributes = { 
                ...currentItem.attributes, 
                custom: { tags } 
              };
            }
          } else if (!trimmedLine.match(/^[□☐\-\*•]/)) {
            // Simple line without formatting
            items.push({
              text: trimmedLine,
              completed: false,
            });
          }
        }
        
        if (currentItem) items.push(currentItem);
      }
    } catch (error) {
      throw new Error(
        "We couldn't read this file. Make sure it's a valid CSV or TXT file.",
      );
    }

    try {
      // Use getUser() to validate the JWT token server-side and get the authenticated user
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !authUser) {
        console.error("[ListContext] Auth error before import:", authError);
        throw new Error("Authentication error. Please log in again.");
      }
      
      const authUserId = authUser.id;
      
      console.log("[ListContext] Import list - using user_id (from getUser):", authUserId, "accountId:", accountId);
      
      // Always use SECURITY DEFINER RPC for list creation (handles both personal and team lists)
      const { data: rpcData, error: rpcError } = await supabase.rpc('create_list_for_user', {
        p_user_id: authUserId,
        p_list_name: `Imported ${category} List`,
        p_category: category,
        p_list_type: listType,
        p_account_id: accountId || null,
      });
      
      if (rpcError) {
        console.error("[ListContext] create_list_for_user RPC failed:", rpcError);
        throw rpcError;
      }
      
      const created = Array.isArray(rpcData) ? rpcData[0] : rpcData;
      const newList = created;

      const itemsToInsert = items.map((item, index) => ({
        list_id: newList.id,
        text: item.text,
        quantity: item.quantity,
        priority: item.priority,
        due_date: item.dueDate?.toISOString(),
        notes: item.notes,
        assigned_to: item.assignedTo,
        completed: item.completed || false,
        item_order: index,
        links: item.links,
        attributes: item.attributes,
      }));

      const itemsResult = (await withTimeout(
        supabase.from("list_items").insert(itemsToInsert),
      )) as any;
      const { error: itemsError } = itemsResult;

      if (itemsError) throw itemsError;
      await loadLists();
    } catch (error: any) {
      logError("importList", error, user?.id);

      if (error.message === "Operation timed out") {
        throw new Error(
          "This is taking longer than expected. Try again in a moment.",
        );
      } else if (
        error.message.includes("network") ||
        error.message.includes("fetch")
      ) {
        throw new Error("Connection lost. Check your internet and try again.");
      } else if (
        !error.message.includes("empty") &&
        !error.message.includes("read this file")
      ) {
        throw new Error("Couldn't import list. Try again or contact support.");
      }
      throw error;
    }
  };

  const exportList = (listId: string, format: "csv" | "txt" | "pdf") => {
    const list = lists.find((l) => l.id === listId);
    if (!list) {
      throw new Error("List not found. Please select a valid list to export.");
    }
    
    // Check tier permission for export
    // Free: print only (no export)
    // Good: csv, txt
    // Even Better+: csv, txt, pdf
    // For team lists (has accountId), use 'lots_more' tier; for personal lists use user's tier
    const effectiveTierForExport: UserTier = list.accountId ? 'lots_more' : (user?.tier || 'free') as UserTier;
    const availableFormats = getAvailableExportFormats(effectiveTierForExport);
    
    console.log('[ListContext] exportList: list.accountId =', list.accountId, ', effectiveTier =', effectiveTierForExport);
    
    if (!availableFormats.includes(format)) {
      toast({
        title: "Plan Changed",
        description: `Your plan changed. ${format.toUpperCase()} export is no longer available.`,
        variant: "destructive",
        duration: 5000,
      });
      throw new Error(`${format.toUpperCase()} export is not available on your current plan.`);
    }

    try {
      let content = "";
      let mimeType = "text/plain";
      let filename = `${list.title}.${format}`;

      if (format === "csv") {
        // CSV with ALL fields
        content = "Item Name,Notes,Link,Due Date,Priority,Tags,Completed,Assigned To,Quantity\n";
        content += list.items
          .map((item) => {
            const tags = item.attributes?.custom?.tags || "";
            const links = item.links?.join(";") || "";
            const dueDate = item.dueDate ? item.dueDate.toISOString().split('T')[0] : "";
            
            return [
              `"${item.text.replace(/"/g, '""')}"`,
              `"${(item.notes || "").replace(/"/g, '""')}"`,
              `"${links}"`,
              `"${dueDate}"`,
              `"${item.priority || ""}"`,
              `"${tags}"`,
              `"${item.completed}"`,
              `"${item.assignedTo || ""}"`,
              `"${item.quantity || ""}"`
            ].join(",");
          })
          .join("\n");
        mimeType = "text/csv";
        
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      } else if (format === "txt") {
        // TXT with formatted details
        content = `${list.title}\n`;
        content += `Category: ${list.category} | Type: ${list.listType}\n`;
        content += `Exported: ${new Date().toLocaleDateString()}\n`;
        content += "=".repeat(50) + "\n\n";
        
        content += list.items
          .map((item) => {
            let itemText = `${item.completed ? "☑" : "□"} ${item.text}`;
            if (item.quantity) itemText = `${item.quantity}x ${itemText}`;
            
            let details = "";
            if (item.notes) details += `\n  Notes: ${item.notes}`;
            if (item.links && item.links.length > 0) details += `\n  Link: ${item.links.join(", ")}`;
            if (item.dueDate) details += `\n  Due: ${item.dueDate.toLocaleDateString()}`;
            if (item.priority) details += `\n  Priority: ${item.priority}`;
            if (item.attributes?.custom?.tags) details += `\n  Tags: ${item.attributes.custom.tags}`;
            if (item.assignedTo) details += `\n  Assigned: ${item.assignedTo}`;
            
            return itemText + details;
          })
          .join("\n\n");
          
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      } else if (format === "pdf") {
        // Generate actual PDF using html2pdf.js
        const htmlContent = `
          <div style="font-family: Arial, sans-serif; padding: 40px; background: white;">
            <h1 style="color: #2563eb; border-bottom: 3px solid #2563eb; padding-bottom: 10px; margin-bottom: 10px;">
              ${list.title}
            </h1>
            <div style="color: #666; margin-bottom: 20px; font-size: 14px;">
              <strong>Category:</strong> ${list.category} | 
              <strong>Type:</strong> ${list.listType} | 
              <strong>Items:</strong> ${list.items.length} | 
              <strong>Exported:</strong> ${new Date().toLocaleDateString()}
            </div>
            
            <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
              <thead>
                <tr>
                  <th style="background: #2563eb; color: white; padding: 12px; text-align: left; font-weight: 600; width: 5%;">✓</th>
                  <th style="background: #2563eb; color: white; padding: 12px; text-align: left; font-weight: 600; width: 25%;">Item</th>
                  <th style="background: #2563eb; color: white; padding: 12px; text-align: left; font-weight: 600; width: 20%;">Notes</th>
                  <th style="background: #2563eb; color: white; padding: 12px; text-align: left; font-weight: 600; width: 10%;">Due Date</th>
                  <th style="background: #2563eb; color: white; padding: 12px; text-align: left; font-weight: 600; width: 10%;">Priority</th>
                  <th style="background: #2563eb; color: white; padding: 12px; text-align: left; font-weight: 600; width: 15%;">Assigned To</th>
                  <th style="background: #2563eb; color: white; padding: 12px; text-align: left; font-weight: 600; width: 15%;">Link</th>
                </tr>
              </thead>
              <tbody>
                ${list.items.map((item, index) => `
                  <tr style="${index % 2 === 0 ? 'background: #f9fafb;' : ''}">
                    <td style="padding: 10px; border-bottom: 1px solid #ddd; vertical-align: top;">${item.completed ? "☑" : "□"}</td>
                    <td style="padding: 10px; border-bottom: 1px solid #ddd; vertical-align: top; ${item.completed ? 'text-decoration: line-through; color: #999;' : ''}">
                      ${item.quantity ? `<strong>${item.quantity}x</strong> ` : ""}${item.text}
                    </td>
                    <td style="padding: 10px; border-bottom: 1px solid #ddd; vertical-align: top;">${item.notes || "-"}</td>
                    <td style="padding: 10px; border-bottom: 1px solid #ddd; vertical-align: top;">${item.dueDate ? item.dueDate.toLocaleDateString() : "-"}</td>
                    <td style="padding: 10px; border-bottom: 1px solid #ddd; vertical-align: top; ${
                      item.priority === 'high' ? 'color: #dc2626; font-weight: 600;' :
                      item.priority === 'medium' ? 'color: #f59e0b; font-weight: 600;' :
                      item.priority === 'low' ? 'color: #10b981;' : ''
                    }">${item.priority || "-"}</td>
                    <td style="padding: 10px; border-bottom: 1px solid #ddd; vertical-align: top;">${item.assignedTo || "-"}</td>
                    <td style="padding: 10px; border-bottom: 1px solid #ddd; vertical-align: top;">${item.links && item.links.length > 0 ? item.links[0].substring(0, 30) + "..." : "-"}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
            
            <div style="margin-top: 30px; text-align: center; color: #999; font-size: 12px;">
              Generated by ListMine • ${new Date().toLocaleString()}
            </div>
          </div>
        `;
        
        // Create temporary element
        const element = document.createElement("div");
        element.innerHTML = htmlContent;
        
        // Configure html2pdf options
        const opt = {
          margin: 10,
          filename: filename,
          image: { type: 'jpeg' as const, quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true },
          jsPDF: { unit: 'mm' as const, format: 'a4' as const, orientation: 'portrait' as const }
        };
        
        // Generate and download PDF
        html2pdf().set(opt).from(element).save();
      }
    } catch (error: any) {
      logError("exportList", error, user?.id);
      throw new Error(
        "Export failed. Try again, or contact support if the problem continues.",
      );
    }
  };

  const generateShareLink = async (listId: string, shareMode: 'view_only' | 'importable' | 'registry_buyer' = 'view_only'): Promise<string> => {
    // Find the list to check if it's a team list
    const list = lists.find(l => l.id === listId);
    if (!list) {
      throw new Error("List not found");
    }
    
    // For team lists (has accountId), check team owner's tier
    // Team lists are always associated with 'lots_more' tier accounts
    let effectiveTierForShare: UserTier;
    
    if (list.accountId) {
      // Team list - teams only exist on 'lots_more' tier
      effectiveTierForShare = 'lots_more';
      console.log('[ListContext] generateShareLink: Team list detected, using lots_more tier');
    } else {
      // Personal list - use user's tier
      effectiveTierForShare = (user?.tier || 'free') as UserTier;
    }
    
    // Check tier permission for sharing
    if (!canShareLists(effectiveTierForShare)) {
      toast({
        title: "Plan Changed",
        description: "Your plan changed. Sharing is no longer available.",
        variant: "destructive",
        duration: 5000,
      });
      throw new Error("Sharing is not available on your current plan.");
    }
    
    const shareId =
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15);
    const shareLink = `${window.location.origin}/shared/${shareId}`;

    try {
      const result = (await withTimeout(
        supabase
          .from("lists")
          .update({
            share_link: shareId,
            is_shared: true,
            share_mode: shareMode,
            updated_at: new Date().toISOString(),
            last_edited_by_user_id: user?.id || null,
            last_edited_by_email: user?.email || null,
            last_edited_at: new Date().toISOString(),
          } as any)
          .eq("id", listId),
      )) as any;
      const { error } = result;

      if (error) throw error;
      await loadLists();
      return shareLink;
    } catch (error: any) {
      logError("generateShareLink", error, user?.id);

      if (error.message === "Operation timed out") {
        throw new Error(
          "This is taking longer than expected. Try again in a moment.",
        );
      } else if (
        error.message.includes("network") ||
        error.message.includes("fetch")
      ) {
        throw new Error("Connection lost. Check your internet and try again.");
      } else if (
        error.message.includes("not available for your tier") ||
        error.message.includes("Please upgrade")
      ) {
        throw new Error(error.message);
      } else {
        throw new Error(
          "Couldn't generate share link. Try again or contact support.",
        );
      }
    }
  };

  const unshareList = async (listId: string): Promise<void> => {
    try {
      const result = (await withTimeout(
        supabase
          .from("lists")
          .update({
            share_link: null,
            is_shared: false,
            share_mode: null,
            updated_at: new Date().toISOString(),
            last_edited_by_user_id: user?.id || null,
            last_edited_by_email: user?.email || null,
            last_edited_at: new Date().toISOString(),
          } as any)
          .eq("id", listId),
      )) as any;
      const { error } = result;

      if (error) throw error;
      await loadLists();
    } catch (error: any) {
      logError("unshareList", error, user?.id);

      if (error.message === "Operation timed out") {
        throw new Error(
          "This is taking longer than expected. Try again in a moment.",
        );
      } else if (
        error.message.includes("network") ||
        error.message.includes("fetch")
      ) {
        throw new Error("Connection lost. Check your internet and try again.");
      } else {
        throw new Error(
          "Couldn't unshare list. Try again or contact support.",
        );
      }
    }
  };

  const updateShareMode = async (listId: string, shareMode: 'view_only' | 'importable' | 'registry_buyer'): Promise<void> => {
    try {
      const result = (await withTimeout(
        supabase
          .from("lists")
          .update({
            share_mode: shareMode,
            updated_at: new Date().toISOString(),
            last_edited_by_user_id: user?.id || null,
            last_edited_by_email: user?.email || null,
            last_edited_at: new Date().toISOString(),
          } as any)
          .eq("id", listId),
      )) as any;
      const { error } = result;

      if (error) throw error;
      await loadLists();
    } catch (error: any) {
      logError("updateShareMode", error, user?.id);
      throw new Error("Couldn't update share settings. Try again or contact support.");
    }
  };

  const addCollaborator = async (listId: string, email: string) => {
    const list = lists.find((l) => l.id === listId);
    if (!list) return;
    
    // Check tier permission for guest invites
    const userTier = (user?.tier || 'free') as UserTier;
    if (!canInviteGuests(userTier)) {
      toast({
        title: "Plan Changed",
        description: "Your plan changed. Guest invites are no longer available.",
        variant: "destructive",
        duration: 5000,
      });
      throw new Error("Guest invites are not available on your current plan.");
    }

    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      throw new Error(emailValidation.error);
    }

    const collaborators = list.collaborators || [];

    if (collaborators.includes(emailValidation.value!)) {
      throw new Error("This person is already a collaborator on this list.");
    }

    try {
      const result = (await withTimeout(
        supabase
          .from("lists")
          .update({
            collaborators: [...collaborators, emailValidation.value],
            updated_at: new Date().toISOString(),
            last_edited_by_user_id: user?.id || null,
            last_edited_by_email: user?.email || null,
            last_edited_at: new Date().toISOString(),
          } as any)
          .eq("id", listId),
      )) as any;
      const { error } = result;

      if (error) {
        if (
          error.message.includes("not found") ||
          error.message.includes("does not exist")
        ) {
          throw new Error(
            "We couldn't find a user with this email. Make sure they've signed up first.",
          );
        }
        throw error;
      }
      await loadLists();
    } catch (error: any) {
      logError("addCollaborator", error, user?.id);

      if (error.message === "Operation timed out") {
        throw new Error(
          "This is taking longer than expected. Try again in a moment.",
        );
      } else if (
        error.message.includes("network") ||
        error.message.includes("fetch")
      ) {
        throw new Error("Connection lost. Check your internet and try again.");
      } else if (
        !error.message.includes("email") &&
        !error.message.includes("already a collaborator")
      ) {
        throw new Error(
          "Couldn't add collaborator. Try again or contact support.",
        );
      }
      throw error;
    }
  };

  const searchLists = (query: string): List[] => {
    const lowerQuery = query.toLowerCase();
    return lists.filter(
      (list) =>
        list.title.toLowerCase().includes(lowerQuery) ||
        list.category.toLowerCase().includes(lowerQuery) ||
        list.items.some((item) =>
          item.text.toLowerCase().includes(lowerQuery),
        ) ||
        list.tags?.some((tag) => tag.toLowerCase().includes(lowerQuery)),
    );
  };

  const searchAllLists = useCallback(async (
    query: string,
    filters?: {
      includeArchived?: boolean;
      favoritesOnly?: boolean;
      category?: ListCategory;
      type?: ListType;
    }
  ): Promise<List[]> => {
    if (!user) return [];
    
    const lowerQuery = query.toLowerCase().trim();
    
    try {
      // Build the query
      let dbQuery = supabase
        .from("lists")
        .select("*")
        .eq("user_id", user.id);
      
      // Apply category filter
      if (filters?.category) {
        dbQuery = dbQuery.eq("category", filters.category);
      }
      
      // Apply type filter
      if (filters?.type) {
        dbQuery = dbQuery.eq("list_type", filters.type);
      }
      
      // Apply favorites filter
      if (filters?.favoritesOnly) {
        dbQuery = dbQuery.eq("is_favorite", true);
      }
      
      // Search by title using ilike for case-insensitive search
      if (lowerQuery) {
        dbQuery = dbQuery.ilike("title", `%${lowerQuery}%`);
      }
      
      dbQuery = dbQuery.order("updated_at", { ascending: false });
      
      const { data: listsData, error: listsError } = await dbQuery;
      
      if (listsError) throw listsError;
      
      if (!listsData || listsData.length === 0) {
        return [];
      }
      
      // Fetch items for all found lists
      const listIds = listsData.map((l) => l.id);
      const { data: itemsData } = await supabase
        .from("list_items")
        .select("*")
        .in("list_id", listIds)
        .order("item_order", { ascending: true });
      
      // Map items to lists
      const itemsByListId: Record<string, any[]> = {};
      (itemsData || []).forEach((item) => {
        if (!itemsByListId[item.list_id]) {
          itemsByListId[item.list_id] = [];
        }
        itemsByListId[item.list_id].push(item);
      });
      
      // Transform to List format
      const transformedLists: List[] = listsData.map((list) => ({
        id: list.id,
        title: list.title,
        category: list.category as ListCategory,
        listType: (list.list_type || "custom") as ListType,
        items: (itemsByListId[list.id] || []).map((item) => ({
          id: item.id,
          text: item.name,
          completed: item.is_completed || false,
          priority: item.priority as "low" | "medium" | "high" | undefined,
          dueDate: item.due_date,
          notes: item.notes,
          link: item.link,
          price: item.price,
          quantity: item.quantity || 1,
          order: item.item_order,
          imageUrl: item.image_url,
        })),
        isPinned: list.is_pinned || false,
        isShared: list.is_shared || false,
        shareLink: list.share_link,
        shareMode: (list.share_mode as 'view_only' | 'importable' | 'registry_buyer') || 'view_only',
        tags: list.tags || [],
        collaborators: [],
        createdAt: new Date(list.created_at),
        updatedAt: new Date(list.updated_at),
        isFavorite: list.is_favorite || false,
        isArchived: list.is_archived || list.title?.startsWith("[Archived]") || false,
        userId: list.user_id,
        guestPermission: undefined,
      }));
      
      // Filter by archived status
      let results = transformedLists;
      if (!filters?.includeArchived) {
        results = results.filter((list) => !list.isArchived && !list.title.startsWith("[Archived]"));
      }
      
      // If query exists, also search in items and tags (already filtered by title in DB)
      if (lowerQuery) {
        // Also include lists where items or tags match (even if title doesn't)
        const additionalMatches = lists.filter((list) => {
          // Skip if already in results
          if (results.some((r) => r.id === list.id)) return false;
          
          // Check items
          const itemMatch = list.items.some((item) =>
            item.text.toLowerCase().includes(lowerQuery)
          );
          
          // Check tags
          const tagMatch = list.tags?.some((tag) =>
            tag.toLowerCase().includes(lowerQuery)
          );
          
          // Check category
          const categoryMatch = list.category.toLowerCase().includes(lowerQuery);
          
          return itemMatch || tagMatch || categoryMatch;
        });
        
        // Apply filters to additional matches
        const filteredAdditional = additionalMatches.filter((list) => {
          if (filters?.category && list.category !== filters.category) return false;
          if (filters?.type && list.listType !== filters.type) return false;
          if (filters?.favoritesOnly && !list.isFavorite) return false;
          if (!filters?.includeArchived && (list.isArchived || list.title.startsWith("[Archived]"))) return false;
          return true;
        });
        
        results = [...results, ...filteredAdditional];
      }
      
      return results;
    } catch (error) {
      console.error("Error searching all lists:", error);
      return [];
    }
  }, [user, lists]);

  const filterLists = (filters: {
    category?: ListCategory;
    type?: ListType;
    tags?: string[];
  }): List[] => {
    return lists.filter((list) => {
      if (filters.category && list.category !== filters.category) return false;
      if (filters.type && list.listType !== filters.type) return false;
      if (filters.tags && filters.tags.length > 0) {
        const listTags = list.tags || [];
        if (!filters.tags.some((tag) => listTags.includes(tag))) return false;
      }
      return true;
    });
  };

  const addTagToList = async (listId: string, tag: string) => {
    const list = lists.find((l) => l.id === listId);
    if (!list) return;

    const tagValidation = validateTag(tag);
    if (!tagValidation.valid) {
      throw new Error(tagValidation.error);
    }

    const tags = list.tags || [];

    if (tags.includes(tagValidation.value!)) {
      throw new Error("This tag already exists on this list.");
    }

    try {
      const result = (await withTimeout(
        supabase
          .from("lists")
          .update({
            tags: [...tags, tagValidation.value],
            updated_at: new Date().toISOString(),
            last_edited_by_user_id: user?.id || null,
            last_edited_by_email: user?.email || null,
            last_edited_at: new Date().toISOString(),
          } as any)
          .eq("id", listId),
      )) as any;
      const { error } = result;

      if (error) throw error;
      await loadLists();
    } catch (error: any) {
      logError("addTagToList", error, user?.id);

      if (error.message === "Operation timed out") {
        throw new Error(
          "This is taking longer than expected. Try again in a moment.",
        );
      } else if (
        error.message.includes("network") ||
        error.message.includes("fetch")
      ) {
        throw new Error("Connection lost. Check your internet and try again.");
      } else if (!error.message.includes("tag")) {
        throw new Error("Couldn't add tag. Try again or contact support.");
      }
      throw error;
    }
  };

  const removeTagFromList = async (listId: string, tag: string) => {
    const list = lists.find((l) => l.id === listId);
    if (!list) return;

    try {
      const result = await supabase
        .from("lists")
        .update({
          tags: (list.tags || []).filter((t) => t !== tag),
          updated_at: new Date().toISOString(),
          last_edited_by_user_id: user?.id || null,
          last_edited_by_email: user?.email || null,
          last_edited_at: new Date().toISOString(),
        } as any)
        .eq("id", listId);
      const { error } = result;

      if (error) throw error;
      await loadLists();
    } catch (error: any) {
      logError("removeTagFromList", error, user?.id);
      throw error;
    }
  };

  const importFromShareLink = async (shareId: string, accountId?: string | null): Promise<string> => {
    if (!user) throw new Error("User not authenticated");

    try {
      // Trim and clean the share ID
      const cleanShareId = shareId.trim();
      console.log("Importing share link:", cleanShareId);
      
      // Fetch the shared list using RPC function (bypasses RLS issues)
      const listResult = (await withTimeout(
        supabase
          .rpc("get_shared_list_by_share_link", { p_share_link: cleanShareId }),
      )) as any;
      const { data: sharedListArray, error: listError } = listResult;

      console.log("RPC result:", { sharedListArray, listError });

      if (listError || !sharedListArray || sharedListArray.length === 0) {
        throw new Error("List not found or not shared. Please check the link and try again.");
      }

      const sharedList = sharedListArray[0];

      // Check if the list allows importing
      const shareMode = sharedList.share_mode || 'view_only';
      if (shareMode === 'view_only') {
        throw new Error("This list is view-only and cannot be imported. Contact the list owner to enable importing.");
      }

      // Fetch the list items using RPC function
      const itemsResult = (await withTimeout(
        supabase
          .rpc("get_shared_list_items", { p_list_id: sharedList.id }),
      )) as any;
      const { data: sharedItems, error: itemsError } = itemsResult;

      if (itemsError) throw itemsError;

      console.log(`[ListContext] Shared list has ${sharedItems?.length || 0} items (before filtering)`);

      // Check list limit - only for personal lists (no accountId)
      // Team lists bypass personal list limits
      if (!accountId && user.listLimit !== -1 && lists.length >= user.listLimit) {
        const tierName =
          user.tier === "free"
            ? "Free"
            : user.tier === "good"
              ? "Good"
              : user.tier === "even_better"
                ? "Even Better"
                : "Lots More";
        throw new Error(
          `You've reached your limit of ${user.listLimit} lists on the ${tierName} tier. Upgrade to import more lists.`,
        );
      }

      // Create a new list with "Copy of" prefix
      const newListTitle = `Copy of ${sharedList.title}`;
      
      // Use getUser() to validate the JWT token server-side and get the authenticated user
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !authUser) {
        console.error("[ListContext] Auth error before copy:", authError);
        throw new Error("Authentication error. Please log in again.");
      }
      
      const authUserId = authUser.id;
      
      console.log("[ListContext] Copy shared list - using user_id (from getUser):", authUserId);
      
      // Use RPC function to bypass RLS issues (supports both personal and team imports)
      const newListIdResult = (await withTimeout(
        supabase
          .rpc("create_list_for_user", {
            p_user_id: authUserId,
            p_list_name: newListTitle,
            p_category: sharedList.category,
            p_list_type: sharedList.list_type,
            p_account_id: accountId || null,
          }),
      )) as any;
      const { data: rpcData, error: newListError } = newListIdResult;

      if (newListError) throw newListError;
      
      const created = Array.isArray(rpcData) ? rpcData[0] : rpcData;
      const newListId = created?.id;
      
      // Fetch the newly created list
      const fetchListResult = (await withTimeout(
        supabase
          .from("lists")
          .select()
          .eq("id", newListId)
          .single(),
      )) as any;
      const { data: newList, error: fetchError } = fetchListResult;
      
      if (fetchError) throw fetchError;

      // Copy all items with completed = false
      if (sharedItems && sharedItems.length > 0) {
        const itemsToInsert = sharedItems
          .filter((item: any) => item.text) // Filter out items with null/empty text
          .map((item: any, index: number) => ({
            list_id: newList.id,
            text: item.text,
            quantity: item.quantity,
            priority: item.priority,
            due_date: item.due_date,
            notes: item.notes,
            assigned_to: item.assigned_to,
            completed: false, // Fresh start
            item_order: index,
            links: item.links,
            attributes: item.attributes,
          }));

        const skippedCount = sharedItems.length - itemsToInsert.length;
        console.log(`[ListContext] Inserting ${itemsToInsert.length} items (after filtering out null text)`);
        
        if (skippedCount > 0) {
          console.warn(`[ListContext] Skipped ${skippedCount} items with empty text`);
        }

        const insertResult = (await withTimeout(
          supabase.from("list_items").insert(itemsToInsert),
        )) as any;
        const { error: insertError } = insertResult;

        if (insertError) throw insertError;
        
        // Return info about skipped items
        if (skippedCount > 0) {
          await loadLists();
          return { listId: newList.id, skippedItems: skippedCount } as any;
        }
      } else {
        console.log(`[ListContext] No items to copy - shared list was empty`);
      }

      await loadLists();
      return { listId: newList.id, skippedItems: 0 } as any;
    } catch (error: any) {
      logError("importFromShareLink", error, user?.id);

      if (error.message === "Operation timed out") {
        throw new Error(
          "This is taking longer than expected. Try again in a moment.",
        );
      } else if (
        error.message.includes("network") ||
        error.message.includes("fetch")
      ) {
        throw new Error("Connection lost. Check your internet and try again.");
      } else if (
        error.message.includes("not found") ||
        error.message.includes("not shared")
      ) {
        throw error;
      } else if (error.message.includes("limit")) {
        throw error;
      } else {
        throw new Error("Couldn't import list. Try again or contact support.");
      }
    }
  };

  const importFromWishlist = async (
    items: Array<{ name: string; price?: string; link?: string; image?: string }>,
    listName: string,
    category: ListCategory = "Shopping",
    importUrl: string,
    retailer: string,
    accountId?: string | null,
  ): Promise<string> => {
    console.log("[IMPORT_FROM_WISHLIST_ARGS]", JSON.stringify({ listName, category, accountId, importUrl, retailer, itemCount: items?.length }));
    
    if (!user) throw new Error("User not authenticated");

    if (!items || items.length === 0) {
      throw new Error("No items to import");
    }

    const nameValidation = validateListName(listName);
    if (!nameValidation.valid) {
      throw new Error(nameValidation.error);
    }

    const categoryValidation = validateCategory(category);
    if (!categoryValidation.valid) {
      throw new Error(categoryValidation.error);
    }

    // Check list limit - only for personal lists (no accountId)
    // Team lists bypass personal list limits
    if (!accountId && user.listLimit !== -1 && lists.length >= user.listLimit) {
      const tierName =
        user.tier === "free"
          ? "Free"
          : user.tier === "good"
            ? "Good"
            : user.tier === "even_better"
              ? "Even Better"
              : "Lots More";
      throw new Error(
        `You've reached your limit of ${user.listLimit} lists on the ${tierName} tier. Upgrade to create more lists.`,
      );
    }

    try {
      // Use getUser() to validate the JWT token server-side and get the authenticated user
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !authUser) {
        console.error("[ListContext] Auth error before creating from scraped items:", authError);
        throw new Error("Authentication error. Please log in again.");
      }
      
      const authUserId = authUser.id;
      
      console.log("[ListContext] Create from scraped items - using user_id (from getUser):", authUserId);
      
      // For registry/wishlist imports, always use 'registry' list type
      const listType = 'registry';
      
      console.log("[ListContext] importFromWishlist - params:", JSON.stringify({
        authUserId,
        listName: nameValidation.value,
        listType,
        accountId,
        importUrl,
        retailer,
      }));
      
      // Use RPC function to ensure user exists and create list (supports both personal and team)
      const { data: rpcData, error: rpcError } = await supabase.rpc('create_list_for_user', {
        p_user_id: authUserId,
        p_list_name: nameValidation.value,
        p_category: categoryValidation.value,
        p_list_type: listType,
        p_account_id: accountId || null,
      });

      if (rpcError) {
        console.error("[ListContext] RPC create_list_for_user error:", rpcError);
        throw rpcError;
      }

      const created = Array.isArray(rpcData) ? rpcData[0] : rpcData;
      const newListId = created?.id;

      // Compute the source value from the importUrl and retailer
      // For The Knot registries, use theknot:<url> prefix
      // For MyRegistry/BB&B, use myregistry:<url> prefix
      // Otherwise default to 'standard'
      const normalizedImportUrl = importUrl.trim().startsWith('https://') || importUrl.trim().startsWith('http://')
        ? importUrl.trim()
        : `https://${importUrl.trim()}`;
      const isTheKnot =
        retailer === "TheKnotRegistry" ||
        /theknot\.com\/us\//i.test(normalizedImportUrl) ||
        /theknot\.com\/.*registry/i.test(normalizedImportUrl);
      const isMyRegistry = /myregistry\.com/i.test(normalizedImportUrl);

      const computedSource = isTheKnot
        ? `theknot:${normalizedImportUrl}`
        : isMyRegistry
        ? `myregistry:${normalizedImportUrl}`
        : "standard";

      // Update the list's source field immediately after creation
      // This ensures the correct source is set before any realtime subscription triggers a reload
      const { error: sourceError } = await supabase
        .from("lists")
        .update({ source: computedSource })
        .eq("id", newListId);
      
      console.log("[IMPORT_SET_SOURCE]", JSON.stringify({ listId: newListId, retailer, importUrl: normalizedImportUrl, computedSource, error: sourceError }));
      
      if (sourceError) {
        console.error("[ListContext] Error updating list source:", sourceError);
        // Don't throw - continue with import even if source update fails
      }

      // Fetch the created list (with updated source)
      const { data: newList, error: fetchError } = await supabase
        .from("lists")
        .select()
        .eq("id", newListId)
        .single();

      if (fetchError) throw fetchError;

      const itemsToInsert = items.map((item, index) => ({
        list_id: newList.id,
        text: item.name,
        notes: null,
        links: item.link ? [item.link] : [],
        completed: false,
        item_order: index,
        attributes: {
          custom: {
            ...(item.image && { image: item.image }),
            ...(item.price && { price: item.price }),
          },
          registry: {
            quantity_requested: 1,
            quantity_purchased: 0,
          },
        },
      }));

      // Debug log for first 3 items (temporary)
      console.log("[IMPORT_ITEM_LINKS_SAMPLE]", JSON.stringify(itemsToInsert.slice(0, 3).map(i => ({ 
        text: i.text, 
        links: i.links, 
        image: i.attributes?.custom?.image 
      }))));

      console.log(
        "[IMPORT_ITEMS_TO_INSERT_RAW]",
        JSON.stringify(itemsToInsert.slice(0, 3).map(i => ({
          text: i.text,
          links: i.links,
          linksType: typeof i.links,
          linksIsArray: Array.isArray(i.links),
        })))
      );

      const itemsResult = (await withTimeout(
        supabase.from("list_items").insert(itemsToInsert),
      )) as any;
      const { error: itemsError } = itemsResult;

      if (itemsError) throw itemsError;

      await loadLists();
      return newList.id;
    } catch (error: any) {
      logError("importFromWishlist", error, user?.id);

      const errorMessage = error?.message || "";
      
      if (errorMessage === "Operation timed out") {
        throw new Error(
          "This is taking longer than expected. Try again in a moment.",
        );
      } else if (
        errorMessage.includes("network") ||
        errorMessage.includes("fetch")
      ) {
        throw new Error("Connection lost. Check your internet and try again.");
      } else if (errorMessage.includes("limit")) {
        throw error;
      } else if (errorMessage.includes("list type") || errorMessage.includes("not available for your tier")) {
        throw new Error("Unable to create this list type with your current plan. The list will be created as a custom list.");
      } else {
        throw new Error("Couldn't import wishlist. Try again or contact support.");
      }
    }
  };

  const contextValue = useMemo(() => ({
    lists,
    hasLoadedOnce,
    addList,
    updateList,
    deleteList,
    restoreList,
    unarchiveList,
    addItemToList,
    updateListItem,
    deleteListItem,
    restoreListItem,
    bulkDeleteItems,
    restoreBulkItems,
    bulkUpdateItems,
    reorderListItems,
    toggleFavorite,
    importList,
    exportList,
    generateShareLink,
    updateShareMode,
    unshareList,
    addCollaborator,
    searchLists,
    searchAllLists,
    filterLists,
    addTagToList,
    removeTagFromList,
    importFromShareLink,
    importFromWishlist,
    loading,
    error,
    retryLoad: () => loadLists(),
    refreshLists: () => loadLists(),
  }), [lists, hasLoadedOnce, loading, error]);

  return (
    <ListContext.Provider value={contextValue}>
      {children}
    </ListContext.Provider>
  );
}

export function useList() {
  const context = useContext(ListContext);
  if (context === undefined) {
    throw new Error("useList must be used within a ListProvider");
  }
  return context;
}