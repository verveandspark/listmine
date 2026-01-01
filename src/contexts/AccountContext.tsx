import { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/useAuthHook";
import { UserTier } from "@/lib/tierUtils";

export interface AccountOption {
  id: string;
  name: string;
  type: 'personal' | 'team';
  ownerId?: string;
  ownerTier?: UserTier;
}

interface AccountContextType {
  availableAccounts: AccountOption[];
  currentAccountId: string | null;
  currentAccount: AccountOption | undefined;
  setCurrentAccountId: (id: string | null) => void;
  isTeamContext: boolean;
  effectiveTier: UserTier;
  loadingAccounts: boolean;
  refreshAccounts: () => Promise<void>;
}

const AccountContext = createContext<AccountContextType | undefined>(undefined);

const STORAGE_KEY = 'listmine_current_account_id';

// Helper to get initial account ID from URL or localStorage
const getInitialAccountId = (): string | null => {
  // Check URL params first
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const ctxParam = urlParams.get('ctx');
    if (ctxParam === 'team') {
      // Will need to be resolved to actual team ID after accounts load
      return null;
    }
  } catch (e) {
    // URL parsing failed
  }
  
  // Then check localStorage
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch (e) {
    return null;
  }
};

export function AccountProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [availableAccounts, setAvailableAccounts] = useState<AccountOption[]>([]);
  const [currentAccountId, setCurrentAccountIdState] = useState<string | null>(getInitialAccountId());
  const [loadingAccounts, setLoadingAccounts] = useState(true);

  const userTier = (user?.tier || 'free') as UserTier;

  // Persist account selection
  const setCurrentAccountId = useCallback((id: string | null) => {
    setCurrentAccountIdState(id);
    try {
      if (id) {
        localStorage.setItem(STORAGE_KEY, id);
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch (e) {
      // localStorage not available
    }
  }, []);

  // Fetch available accounts
  const fetchAccounts = useCallback(async () => {
    if (!user) {
      setAvailableAccounts([]);
      setLoadingAccounts(false);
      return;
    }

    setLoadingAccounts(true);
    console.log('[AccountContext] Fetching accounts for user:', user.id);

    try {
      const accounts: AccountOption[] = [];

      // Personal account (always available)
      accounts.push({
        id: `personal-${user.id}`,
        name: 'Personal',
        type: 'personal',
        ownerId: user.id,
        ownerTier: userTier,
      });

      // Fetch owned team accounts
      const { data: ownedAccounts, error: ownedError } = await supabase
        .from('accounts')
        .select('id, name, owner_id')
        .eq('owner_id', user.id);

      if (!ownedError && ownedAccounts) {
        for (const account of ownedAccounts) {
          accounts.push({
            id: account.id,
            name: account.name || 'My Team',
            type: 'team',
            ownerId: account.owner_id,
            ownerTier: 'lots_more' as UserTier, // Teams only exist on Lots More tier
          });
        }
      }

      // Fetch team memberships
      const { data: teamMemberships, error: memberError } = await supabase
        .from('account_team_members')
        .select(`
          account_id,
          accounts:account_id (
            id,
            name,
            owner_id
          )
        `)
        .eq('user_id', user.id);

      if (!memberError && teamMemberships) {
        for (const membership of teamMemberships) {
          const account = (membership as any).accounts;
          if (account && !accounts.find(a => a.id === account.id)) {
            accounts.push({
              id: account.id,
              name: account.name || 'Team Account',
              type: 'team',
              ownerId: account.owner_id,
              ownerTier: 'lots_more' as UserTier,
            });
          }
        }
      }

      console.log('[AccountContext] Final available accounts:', accounts);
      setAvailableAccounts(accounts);

      // Set default account if not set or if current account is invalid
      const savedAccountId = currentAccountId;
      const validAccount = accounts.find(a => a.id === savedAccountId);
      
      if (!validAccount && accounts.length > 0) {
        // Check URL for team context
        try {
          const urlParams = new URLSearchParams(window.location.search);
          const ctxParam = urlParams.get('ctx');
          if (ctxParam === 'team') {
            // Find first team account
            const teamAccount = accounts.find(a => a.type === 'team');
            if (teamAccount) {
              setCurrentAccountId(teamAccount.id);
            } else {
              setCurrentAccountId(accounts[0].id);
            }
          } else {
            setCurrentAccountId(accounts[0].id);
          }
        } catch (e) {
          setCurrentAccountId(accounts[0].id);
        }
      }
    } catch (error) {
      console.error('[AccountContext] Error fetching accounts:', error);
    } finally {
      setLoadingAccounts(false);
    }
  }, [user, userTier, currentAccountId, setCurrentAccountId]);

  useEffect(() => {
    fetchAccounts();
  }, [user?.id]);

  const currentAccount = useMemo(
    () => availableAccounts.find(a => a.id === currentAccountId),
    [availableAccounts, currentAccountId]
  );

  const isTeamContext = currentAccount?.type === 'team';
  
  // Effective tier: team context always uses 'lots_more', personal uses user's tier
  const effectiveTier: UserTier = isTeamContext ? 'lots_more' : userTier;

  const refreshAccounts = useCallback(async () => {
    await fetchAccounts();
  }, [fetchAccounts]);

  const contextValue = useMemo(() => ({
    availableAccounts,
    currentAccountId,
    currentAccount,
    setCurrentAccountId,
    isTeamContext,
    effectiveTier,
    loadingAccounts,
    refreshAccounts,
  }), [
    availableAccounts,
    currentAccountId,
    currentAccount,
    setCurrentAccountId,
    isTeamContext,
    effectiveTier,
    loadingAccounts,
    refreshAccounts,
  ]);

  return (
    <AccountContext.Provider value={contextValue}>
      {children}
    </AccountContext.Provider>
  );
}

export function useAccount() {
  const context = useContext(AccountContext);
  if (context === undefined) {
    throw new Error("useAccount must be used within an AccountProvider");
  }
  return context;
}

// Helper hook to get the account ID to use for list creation
// Returns null for personal lists, or the team account ID for team lists
export function useListAccountId(): string | null {
  const { currentAccount } = useAccount();
  if (!currentAccount || currentAccount.type === 'personal') {
    return null;
  }
  return currentAccount.id;
}
