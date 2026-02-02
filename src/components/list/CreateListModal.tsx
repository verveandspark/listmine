import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useLists } from "@/contexts/useListsHook";
import { useAuth } from "@/contexts/useAuthHook";
import { useAccount } from "@/contexts/AccountContext";
import { supabase } from "@/lib/supabase";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ListCategory, ListType } from "@/types";
import { Loader2, Lock, User, Users } from "lucide-react";
import { getListTypesWithAvailability, UserTier } from "@/lib/tierUtils";
import ListTypeUpsellModal from "./ListTypeUpsellModal";

interface CreateListModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface AccountOption {
  id: string;
  name: string;
  type: 'personal' | 'team';
  ownerId?: string;
  ownerTier?: UserTier;
}

// Normalize listType variations for consistent helper text lookup
const normalizeListType = (listType: string | undefined): string => {
  if (!listType) return "custom";
  const normalizations: Record<string, string> = {
    "todo-list": "todo",
    "task-list": "todo",
    "idea-list": "idea",
    "registry-list": "registry",
    "checklist": "todo",
  };
  return normalizations[listType] || listType;
};

export default function CreateListModal({
  open,
  onOpenChange,
}: CreateListModalProps) {
  const [listName, setListName] = useState("");
  const [category, setCategory] = useState<ListCategory>("Tasks");
  const [listType, setListType] = useState<ListType>("custom");
  const [categoryManuallySet, setCategoryManuallySet] = useState(false);
  const [upsellOpen, setUpsellOpen] = useState(false);
  const [upsellListType, setUpsellListType] = useState<{ label: string; tier: UserTier } | null>(null);
  const [ownership, setOwnership] = useState<'personal' | string>('personal'); // 'personal' or account ID
  const [availableAccounts, setAvailableAccounts] = useState<AccountOption[]>([]);
  
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { addList } = useLists();
  const { user } = useAuth();
  const { currentAccount, isTeamContext: globalIsTeamContext } = useAccount();
  const navigate = useNavigate();

  const userTier = (user?.tier || "free") as UserTier;
  
  // Get the effective tier based on ownership selection
  // For team lists, always use 'lots_more' (teams only exist on Lots More tier)
  const getEffectiveTier = (): UserTier => {
    if (ownership === 'personal') {
      return userTier;
    }
    // Team context: always use 'lots_more' tier
    return 'lots_more';
  };
  
  const effectiveTier = getEffectiveTier();
  const listTypesWithAvailability = getListTypesWithAvailability(effectiveTier);
  
  // Default ownership to current account context when modal opens
  useEffect(() => {
    if (open && currentAccount) {
      if (currentAccount.type === 'personal') {
        setOwnership('personal');
      } else {
        // Team context - default to team account ID
        setOwnership(currentAccount.id);
      }
    }
  }, [open, currentAccount]);

  // Fetch available accounts (teams) for the user
  // Always show ownership selector if user owns any team accounts
  useEffect(() => {
    const fetchAccounts = async () => {
      if (!user) {
        console.log('[CreateListModal] No user, skipping account fetch');
        return;
      }

      console.log('[CreateListModal] Fetching accounts for user:', user.id);
      const accounts: AccountOption[] = [];

      // First check if user owns any accounts (team owner)
      const { data: ownedAccounts, error: ownedError } = await supabase
        .from('accounts')
        .select('id, name, owner_id')
        .eq('owner_id', user.id);

      console.log('[CreateListModal] Owned accounts result:', { ownedAccounts, ownedError });

      if (!ownedError && ownedAccounts) {
        for (const account of ownedAccounts) {
          // For owned accounts, teams always use Lots More tier
          accounts.push({
            id: account.id,
            name: account.name || 'My Team',
            type: 'team',
            ownerId: account.owner_id,
            ownerTier: 'lots_more' as UserTier, // Teams only exist on Lots More tier
          });
        }
      }

      // Also check if user is a team member (but not owner)
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

      console.log('[CreateListModal] Team memberships result:', { teamMemberships, memberError });

      // Collect owner IDs to fetch their tiers
      const ownerIdsToFetch: string[] = [];
      
      if (!memberError && teamMemberships) {
        for (const membership of teamMemberships) {
          const account = (membership as any).accounts;
          if (account && !accounts.find(a => a.id === account.id)) {
            ownerIdsToFetch.push(account.owner_id);
          }
        }
      }
      
      // Fetch owner tiers for team accounts where user is a member
      let ownerTiers: Record<string, UserTier> = {};
      let failedOwnerIds: Set<string> = new Set();
      
      if (ownerIdsToFetch.length > 0) {
        const { data: ownersData, error: ownersError } = await supabase
          .from('users')
          .select('id, tier')
          .in('id', ownerIdsToFetch);
        
        if (ownersError) {
          console.error('[CreateListModal] Error fetching owner tiers:', ownersError);
          // Mark all as failed
          ownerIdsToFetch.forEach(id => failedOwnerIds.add(id));
        } else if (ownersData) {
          ownersData.forEach((owner) => {
            ownerTiers[owner.id] = (owner.tier || 'free') as UserTier;
          });
          // Check for any owners we didn't get data for
          ownerIdsToFetch.forEach(id => {
            if (!ownerTiers[id]) {
              failedOwnerIds.add(id);
            }
          });
        }
      }

      if (!memberError && teamMemberships) {
        for (const membership of teamMemberships) {
          const account = (membership as any).accounts;
          if (account) {
            // Avoid duplicates (in case user is both owner and member)
            if (!accounts.find(a => a.id === account.id)) {
              accounts.push({
                id: account.id,
                name: account.name || 'Team Account',
                type: 'team',
                ownerId: account.owner_id,
                ownerTier: 'lots_more' as UserTier, // Teams only exist on Lots More tier
              });
            }
          }
        }
      }

      console.log('[CreateListModal] Final available accounts:', accounts);
      setAvailableAccounts(accounts);
    };

    if (open) {
      fetchAccounts();
    }
  }, [user, open]);

  const categories: ListCategory[] = [
    "Tasks",
    "Shopping",
    "Meals",
    "Household",
    "Planning",
    "Other",
    "School",
    "Work",
  ];
  
  // Map list types to default categories
  const getDefaultCategoryForListType = (type: ListType): ListCategory => {
    switch (type) {
      case 'todo':
      case 'todo-list':
      case 'task-list':
      case 'checklist':
        return 'Tasks';
      case 'registry':
      case 'registry-list':
      case 'wishlist':
      case 'shopping-list':
      case 'grocery':
      case 'grocery-list':
        return 'Shopping';
      case 'idea':
      case 'idea-list':
      case 'custom':
      default:
        return 'Other';
    }
  };

  const handleListTypeClick = (typeInfo: typeof listTypesWithAvailability[0]) => {
    if (typeInfo.available) {
      setListType(typeInfo.value);
      // Auto-set category based on list type only if not manually set by user
      if (!categoryManuallySet) {
        setCategory(getDefaultCategoryForListType(typeInfo.value));
      }
    } else {
      setUpsellListType({ label: typeInfo.label, tier: typeInfo.requiredTier });
      setUpsellOpen(true);
    }
  };

  const handleCreate = async () => {
    if (!listName.trim()) {
      setError("Please enter a list name");
      return;
    }

    if (!user) {
      setError("You must be logged in to create a list. Please refresh the page and try again.");
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      // Determine accountId: null for personal, or the selected account ID for team
      const accountId = ownership === 'personal' ? null : ownership;
      
      console.log('[CreateListModal] Creating list with:', {
        listName: listName.trim(),
        category,
        listType,
        ownership,
        accountId,
      });
      
      // addList now returns the new list ID
      const newListId = await addList(listName.trim(), category, listType, accountId);
      
      // Navigate to the new list immediately
      navigate(`/list/${newListId}`);
      
      // Close modal and reset after navigation
      resetForm();
      onOpenChange(false);
    } catch (err: any) {
      console.error("[CreateListModal] Error creating list:", err);
      setError(err.message || "Failed to create list");
    } finally {
      setIsCreating(false);
    }
  };

  const resetForm = () => {
    setListName("");
    setCategory("Tasks");
    setListType("custom");
    setOwnership("personal");
    setError(null);
    setIsCreating(false);
    setCategoryManuallySet(false);
  };

  const handleCancel = () => {
    resetForm();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl md:max-w-3xl bg-white animate-pop-in px-4 sm:px-6 max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Create New List</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4 overflow-y-auto pb-24">
          {/* List Name */}
          <div className="grid gap-2">
            <Label htmlFor="list-name">List Name *</Label>
            <Input
              id="list-name"
              placeholder="e.g., Weekly Groceries"
              value={listName}
              onChange={(e) => setListName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !isCreating) {
                  handleCreate();
                }
              }}
              autoFocus
            />
          </div>

          {/* Category */}
          <div className="grid gap-2">
            <Label htmlFor="category">Category *</Label>
            <Select
              value={category}
              onValueChange={(value) => {
                setCategory(value as ListCategory);
                setCategoryManuallySet(true);
              }}
            >
              <SelectTrigger id="category">
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* List Type */}
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="list-type">List Type *</Label>
              {ownership !== 'personal' && (
                <span className="text-xs text-muted-foreground">
                  Full access (Team)
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <TooltipProvider>
                {listTypesWithAvailability.map((typeInfo) => {
                  const helperTexts: Record<string, string> = {
                    custom: "Flexible lists for anything (notes, plans, collections).",
                    todo: "Tasks with due dates and status.",
                    "shopping-list": "Track items to buy (links, quantities).",
                    idea: "Capture and organize ideas.",
                    registry: "Shareable gift registry with purchase tracking.",
                    wishlist: "Shareable wish list with purchase tracking.",
                  };
                  const helperKey = normalizeListType(typeInfo.value);
                  return (
                    <Tooltip key={typeInfo.value}>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant={listType === typeInfo.value ? "default" : "outline"}
                          className={`relative flex-col items-start h-auto min-h-[110px] py-3 px-3 overflow-visible ${
                            !typeInfo.available
                              ? "opacity-60 cursor-not-allowed border-dashed"
                              : ""
                          } ${
                            listType === typeInfo.value
                              ? "ring-2 ring-primary ring-offset-2"
                              : ""
                          }`}
                          onClick={() => handleListTypeClick(typeInfo)}
                        >
                          <span className="flex items-center w-full justify-between font-medium">
                            {typeInfo.label}
                            {!typeInfo.available && (
                              <Lock className="w-3 h-3 ml-auto text-muted-foreground" />
                            )}
                          </span>
                          <span className={`text-xs font-normal mt-1.5 text-left leading-snug whitespace-normal line-clamp-2 ${
                            listType === typeInfo.value ? "!text-white/90 !opacity-100" : "!text-slate-700 dark:!text-slate-200 !opacity-100"
                          }`}>
                            {helperTexts[helperKey] || ""}
                          </span>
                        </Button>
                      </TooltipTrigger>
                      {!typeInfo.available && (
                        <TooltipContent>
                          <p>Available on {typeInfo.tierLabel} tier</p>
                        </TooltipContent>
                      )}
                    </Tooltip>
                  );
                })}
              </TooltipProvider>
            </div>
          </div>

          {/* Ownership - show if user has team accounts */}
          {availableAccounts.length > 0 ? (
            <div className="grid gap-2">
              <Label htmlFor="ownership">Create list for</Label>
              <Select
                value={ownership}
                onValueChange={(value) => setOwnership(value)}
              >
                <SelectTrigger id="ownership">
                  <SelectValue placeholder="Select ownership" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="personal">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-primary" />
                      <span>Personal (just me)</span>
                    </div>
                  </SelectItem>
                  {availableAccounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-secondary" />
                        <span>{account.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {ownership === 'personal' 
                  ? "This list will be private to you."
                  : "This list will be visible to team members."}
              </p>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              This list will be created as a personal list.
            </p>
          )}

          {error && (
            <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
              {error}
            </div>
          )}
        </div>
        <DialogFooter className="sticky bottom-0 bg-white border-t pt-4 mt-auto -mx-4 sm:-mx-6 px-4 sm:px-6 pb-4">
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={isCreating}
          >
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={isCreating}>
            {isCreating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              "Create"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* Upsell Modal */}
      {upsellListType && (
        <ListTypeUpsellModal
          open={upsellOpen}
          onOpenChange={setUpsellOpen}
          listTypeLabel={upsellListType.label}
          requiredTier={upsellListType.tier}
        />
      )}
    </Dialog>
  );
}