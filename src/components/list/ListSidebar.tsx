import { useLists } from "@/contexts/useListsHook";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CheckSquare,
  ShoppingCart,
  Lightbulb,
  Plane,
  ListChecks,
  ChevronRight,
  Archive,
  LayoutDashboard,
  Plus,
  Download,
  LogOut,
  MessageSquare,
  Users,
  User,
  Share2,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ListCategory } from "@/types";
import { useState, useEffect } from "react";
import CreateListModal from "./CreateListModal";
import { useAuth } from "@/contexts/useAuthHook";
import { supabase } from "@/lib/supabase";

const categoryIcons: Record<string, any> = {
  Tasks: CheckSquare,
  Groceries: ShoppingCart,
  Ideas: Lightbulb,
  Shopping: ShoppingCart,
  Travel: Plane,
  Work: CheckSquare,
  Home: CheckSquare,
  Other: ListChecks,
};

export function ListSidebar() {
  const { lists } = useLists();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const { signOut, user } = useAuth();

  // Account switcher state
  interface AccountOption {
    id: string;
    name: string;
    type: 'personal' | 'team';
    ownerId?: string;
  }
  const [availableAccounts, setAvailableAccounts] = useState<AccountOption[]>([]);
  const [currentAccountId, setCurrentAccountId] = useState<string | null>(null);

  // Fetch available accounts
  useEffect(() => {
    const fetchAccounts = async () => {
      if (!user?.id) return;
      
      const accounts: AccountOption[] = [];
      
      // Add personal account
      accounts.push({
        id: `personal-${user.id}`,
        name: 'Personal',
        type: 'personal',
      });
      
      // Fetch team memberships first (just account IDs)
      const { data: teamMemberships } = await supabase
        .from('account_team_members')
        .select('account_id')
        .eq('user_id', user.id);
      
      // Then fetch full account records separately by those IDs
      if (teamMemberships && teamMemberships.length > 0) {
        const teamAccountIds = teamMemberships.map(m => m.account_id);
        
        const { data: teamAccountsData } = await supabase
          .from('accounts')
          .select('id, name, owner_id')
          .in('id', teamAccountIds);
        
        if (teamAccountsData) {
          for (const account of teamAccountsData) {
            accounts.push({
              id: account.id,
              name: account.name || 'Team',
              type: 'team',
              ownerId: account.owner_id,
            });
          }
        } else if (teamMemberships.length > 0) {
          // Fallback: add team account options even if account data is missing
          for (const membership of teamMemberships) {
            accounts.push({
              id: membership.account_id,
              name: 'Team',
              type: 'team',
              ownerId: undefined,
            });
          }
        }
      }
      
      // Also check if user owns any accounts
      const { data: ownedAccounts } = await supabase
        .from('accounts')
        .select('id, name, owner_id')
        .eq('owner_id', user.id);
      
      if (ownedAccounts) {
        for (const account of ownedAccounts) {
          if (!accounts.find(a => a.id === account.id)) {
            accounts.push({
              id: account.id,
              name: account.name || 'My Team',
              type: 'team',
              ownerId: account.owner_id,
            });
          }
        }
      }
      
      setAvailableAccounts(accounts);
      
      // Set default to personal if not set
      if (!currentAccountId && accounts.length > 0) {
        setCurrentAccountId(accounts[0].id);
      }
    };
    
    fetchAccounts();
  }, [user?.id]);

  const currentAccount = availableAccounts.find(a => a.id === currentAccountId);

  const handleLogout = async () => {
    await signOut();
    navigate("/", { replace: true });
  };

  // Filter lists based on selected account context
  let accountFilteredLists = lists;
  
  if (currentAccountId && currentAccount) {
    if (currentAccount.type === 'personal') {
      // Personal mode: show personal lists (no accountId) + guest/shared lists
      accountFilteredLists = lists.filter((list) => {
        const isPersonalList = list.userId === user?.id && !list.accountId;
        const isGuestList = list.isGuestAccess;
        return isPersonalList || isGuestList;
      });
    } else if (currentAccount.type === 'team') {
      // Team mode: show ONLY lists that belong to this team (NO shared/guest lists)
      accountFilteredLists = lists.filter(
        (list) => list.accountId === currentAccountId && !list.isGuestAccess
      );
    }
  }

  // Handle account switch navigation - if current list is not visible in new context, navigate away
  useEffect(() => {
    if (id && currentAccountId && currentAccount && accountFilteredLists.length >= 0) {
      const currentListVisible = accountFilteredLists.some(list => list.id === id);
      if (!currentListVisible) {
        // Current list is not visible in this account context
        if (accountFilteredLists.length > 0) {
          // Navigate to first visible list
          navigate(`/list/${accountFilteredLists[0].id}`);
        } else {
          // No lists visible, go to dashboard
          navigate('/dashboard');
        }
      }
    }
  }, [currentAccountId, id, accountFilteredLists, navigate]);

  // Filter out archived lists unless showArchived is true
  const filteredLists = accountFilteredLists.filter((list) => {
    const isArchived = list.isArchived || list.title.startsWith("[Archived]");
    return showArchived || !isArchived;
  });

  // Helper to get ownership badge for a list
  // Using brand colors: blues, greens, grays only
  const getOwnershipBadge = (list: typeof lists[0]) => {
    if (list.isGuestAccess) {
      return (
        <Badge variant="outline" className="text-[10px] px-1 py-0 bg-teal-50 text-teal-700 border-teal-200">
          <Share2 className="w-2.5 h-2.5 mr-0.5" />
          Shared
        </Badge>
      );
    }
    if (list.accountId) {
      return (
        <Badge variant="outline" className="text-[10px] px-1 py-0 bg-blue-50 text-blue-600 border-blue-200">
          <Users className="w-2.5 h-2.5 mr-0.5" />
          Team
        </Badge>
      );
    }
    return null; // Personal lists don't need a badge in personal mode
  };

  // Count archived lists
  const archivedCount = lists.filter(
    (list) => list.isArchived || list.title.startsWith("[Archived]")
  ).length;

  // Group lists by category
  const groupedLists = filteredLists.reduce(
    (acc, list) => {
      if (!acc[list.category]) {
        acc[list.category] = [];
      }
      acc[list.category].push(list);
      return acc;
    },
    {} as Record<ListCategory, typeof lists>,
  );

  return (
    <div className="w-64 bg-white border-r border-gray-200 h-screen sticky top-0 overflow-y-auto">
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Lists</h2>
          <Badge variant="secondary">{filteredLists.length}</Badge>
        </div>

        {/* Account Switcher */}
        {availableAccounts.length > 1 && (
          <div className="mb-4">
            <Select
              value={currentAccountId || ''}
              onValueChange={(value) => setCurrentAccountId(value)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select account">
                  <div className="flex items-center gap-2">
                    {currentAccount?.type === 'team' ? (
                      <Users className="w-4 h-4 text-blue-600" />
                    ) : (
                      <User className="w-4 h-4 text-gray-600" />
                    )}
                    <span className="truncate">{currentAccount?.name || 'Select account'}</span>
                  </div>
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {availableAccounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    <div className="flex items-center gap-2">
                      {account.type === 'team' ? (
                        <Users className="w-4 h-4 text-blue-600" />
                      ) : (
                        <User className="w-4 h-4 text-gray-600" />
                      )}
                      <span>{account.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Dashboard Button */}
        <Button
          onClick={() => {
            localStorage.setItem("dashboardViewMode", "dashboard");
            navigate("/dashboard");
          }}
          variant="outline"
          className="w-full mb-4 min-h-[44px] border-primary/30 text-primary hover:bg-primary/10"
        >
          <LayoutDashboard className="w-4 h-4 mr-2" />
          Dashboard
        </Button>

        <div className="space-y-2 mb-4">
          <Button
            onClick={() => setIsCreateModalOpen(true)}
            className="w-full bg-primary hover:bg-primary/90 text-white min-h-[44px]"
          >
            <Plus className="w-4 h-4 mr-2" />
            New List
          </Button>

          <Button
            onClick={() => navigate("/import-export")}
            variant="outline"
            className="w-full min-h-[44px]"
          >
            <Download className="w-4 h-4 mr-2" />
            Import List
          </Button>
        </div>

        {/* Shared With Me section - only in personal mode */}
        {currentAccount?.type === 'personal' && filteredLists.some(l => l.isGuestAccess) && (
          <div className="mb-4 p-2 bg-teal-50 rounded-lg border border-teal-100">
            <div className="flex items-center gap-2 text-teal-700 text-sm font-medium mb-1">
              <Share2 className="w-4 h-4" />
              Shared With Me
            </div>
            <p className="text-xs text-teal-600">
              {filteredLists.filter(l => l.isGuestAccess).length} shared list(s)
            </p>
          </div>
        )}

        {/* Archived toggle */}
        {archivedCount > 0 && (
          <div className="mb-4">
            <Button
              variant="ghost"
              size="sm"
              className={`w-full justify-start text-sm ${showArchived ? "text-primary" : "text-gray-500"}`}
              onClick={() => setShowArchived(!showArchived)}
            >
              <Archive className="w-4 h-4 mr-2" />
              {showArchived ? "Hide" : "Show"} archived ({archivedCount})
            </Button>
          </div>
        )}

        <div className="space-y-4">
          {Object.entries(groupedLists).map(([category, categoryLists]) => {
            const Icon = categoryIcons[category] || ListChecks;
            return (
              <div key={category}>
                <div className="flex items-center gap-2 mb-2">
                  <Icon className="w-4 h-4 text-gray-600" />
                  <h3 className="text-sm font-semibold text-gray-700">
                    {category}
                  </h3>
                  <Badge variant="outline" className="text-xs">
                    {categoryLists.length}
                  </Badge>
                </div>
                <div className="space-y-1 ml-6">
                  {categoryLists.map((list) => {
                    const isArchived = list.isArchived || list.title.startsWith("[Archived]");
                    const ownershipBadge = getOwnershipBadge(list);
                    return (
                      <Button
                        key={list.id}
                        variant={list.id === id ? "secondary" : "ghost"}
                        className={`w-full justify-between text-left h-auto py-2 ${
                          list.id === id ? "bg-primary/20 text-primary font-semibold" : ""
                        } ${isArchived ? "opacity-60" : ""}`}
                        onClick={() => {
                          // Store the current list ID before navigating
                          localStorage.setItem("last_list_id", list.id);
                          navigate(`/list/${list.id}`);
                        }}
                      >
                        <div className="flex flex-col items-start gap-0.5 min-w-0 flex-1">
                          <span className={`truncate text-sm w-full ${isArchived ? "italic" : ""}`}>
                            {list.title}
                          </span>
                          {ownershipBadge && (
                            <div className="flex items-center">
                              {ownershipBadge}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {isArchived && <Archive className="w-3 h-3 text-gray-400" />}
                          <Badge variant="outline" className="text-xs">
                            {list.items.length}
                          </Badge>
                          {list.id === id && <ChevronRight className="w-4 h-4" />}
                        </div>
                      </Button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Logout and Feedback Buttons */}
      <div className="p-4 border-t border-gray-200 mt-auto space-y-2">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={handleLogout}
                variant="outline"
                className="w-full border-gray-300 text-gray-700 hover:bg-gray-100 min-h-[44px]"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Sign out of your account</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={() => window.open('https://forms.gle/9uQRYmrC8qC38Raj9', '_blank')}
                variant="outline"
                className="w-full border-primary text-primary hover:bg-primary/10 min-h-[44px]"
              >
                <MessageSquare className="w-4 h-4 mr-2" />
                Beta Feedback
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Help us improve! Share your feedback or report bugs here.</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <CreateListModal
        open={isCreateModalOpen}
        onOpenChange={setIsCreateModalOpen}
      />
    </div>
  );
}