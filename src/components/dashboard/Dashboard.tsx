import { DashboardSkeleton } from "@/components/ui/DashboardSkeleton";
import { OnboardingTooltips } from "@/components/onboarding/OnboardingTooltips";
import { NotificationBell } from "@/components/ui/NotificationBell";
import { useUndoAction } from "@/hooks/useUndoAction";
import TeamManagement from "@/components/team/TeamManagement";
import GuestManagement from "@/components/list/GuestManagement";
import {
  Plus,
  Search,
  Filter,
  SortAsc,
  Calendar,
  CheckCircle,
  Clock,
  AlertCircle,
  TrendingUp,
  Package,
  Loader2,
  Share2,
  Download,
  Trash2,
  X,
  ChevronDown,
  Menu,
  Edit,
  CheckSquare,
  ShoppingCart,
  Lightbulb,
  Plane,
  ListChecks,
  Crown,
  HelpCircle,
  FileText,
  Upload,
  User,
  Users,
  LogOut,
  MessageSquare,
  Link2Off,
  Star,
  LayoutDashboard,
  List,
  Archive,
  ArchiveRestore,
  Layers,
  ChevronRight,
  Merge,
} from "lucide-react";

import { useState, useMemo } from "react";
import { useAuth } from "@/contexts/useAuthHook";
import { useLists } from "@/contexts/useListsHook";
import { useAccount } from "@/contexts/AccountContext";
import { ListCategory, ListType } from "@/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useToast } from "@/components/ui/use-toast";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useEffect, useRef } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { formatDistanceToNow, isToday } from "date-fns";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { isPaidTier, canShareLists, canExportLists, canImportLists, canInviteGuests, canHaveTeamMembers, getAvailableExportFormats, formatLimitCompact, type UserTier } from "@/lib/tierUtils";
import {
  validateListName,
  validateCategory,
  checkListLimit,
} from "@/lib/validation";
import CreateListModal from "@/components/list/CreateListModal";
import MergeListsModal from "@/components/list/MergeListsModal";
import ShareSettingsModal from "@/components/list/ShareSettingsModal";

const categoryIcons: Record<string, any> = {
  Tasks: CheckSquare,
  Shopping: ShoppingCart,
  Meals: ShoppingCart,
  Household: CheckSquare,
  Planning: ListChecks,
  Other: ListChecks,
  School: CheckSquare,
  Work: CheckSquare,
  // Legacy categories (for backward compatibility)
  Groceries: ShoppingCart,
  Ideas: Lightbulb,
  Travel: Plane,
  Home: CheckSquare,
};

const categoryColors: Record<string, string> = {
  Tasks: "bg-[#2ba8a8]/10 text-[#2ba8a8] border-[#2ba8a8]/20",
  Shopping: "bg-[#2ba8a8]/10 text-[#2ba8a8] border-[#2ba8a8]/20",
  Meals: "bg-[#5789aa]/10 text-[#5789aa] border-[#5789aa]/20",
  Household: "bg-[#1f628e]/10 text-[#1f628e] border-[#1f628e]/20",
  Planning: "bg-[#80d4d4]/10 text-[#80d4d4] border-[#80d4d4]/20",
  Other: "bg-[#cbd5e1]/10 text-[#cbd5e1] border-[#cbd5e1]/20",
  School: "bg-[#80d4d4]/10 text-[#80d4d4] border-[#80d4d4]/20",
  Work: "bg-[#1f628e]/10 text-[#1f628e] border-[#1f628e]/20",
  // Legacy categories (for backward compatibility)
  Groceries: "bg-[#2ba8a8]/10 text-[#2ba8a8] border-[#2ba8a8]/20",
  Ideas: "bg-[#5789aa]/10 text-[#5789aa] border-[#5789aa]/20",
  Travel: "bg-[#80d4d4]/10 text-[#80d4d4] border-[#80d4d4]/20",
  Home: "bg-[#5789aa]/10 text-[#5789aa] border-[#5789aa]/20",
};

// Filter dropdown list types (simplified, no duplicates)
const listTypes = [
  "Custom",
  "To-Do",
  "Shopping List",
  "Idea",
  "Registry",
  "Wishlist"
];

// Normalize legacy list types for filtering
const normalizeListType = (listType: string | undefined): string => {
  if (!listType) return "custom";
  const normalizations: Record<string, string> = {
    "todo-list": "todo",
    "task-list": "todo",
    "idea-list": "idea",
    "registry-list": "registry",
    "checklist": "todo",
    "grocery-list": "shopping-list",
    "multi-topic": "custom",
    "compare-contrast": "custom",
    "pro-con": "custom",
    "multi-option": "custom",
  };
  return normalizations[listType] || listType;
};

export default function Dashboard() {
  const { user, logout } = useAuth();
  const {
    lists,
    hasLoadedOnce,
    addList,
    updateList,
    deleteList,
    toggleFavorite,
    searchLists,
    searchAllLists,
    filterLists,
    loading,
    error,
    retryLoad,
    generateShareLink,
    updateShareMode,
    unshareList,
    exportList,
    restoreList,
    unarchiveList,
  } = useLists();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const importShareId = searchParams.get('importShareId');

  const handleLogout = async () => {
    await logout();
    navigate("/", { replace: true });
  };
  const { toast } = useToast();
  const { executeWithUndo } = useUndoAction();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
  const [mergeSourceListId, setMergeSourceListId] = useState<string | undefined>(undefined);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [newListTitle, setNewListTitle] = useState("");
  const [newListCategory, setNewListCategory] = useState<ListCategory>("Tasks");
  const [newListType, setNewListType] = useState<ListType>("custom");
  const [selectedCategory, setSelectedCategory] = useState<
    ListCategory | "All"
  >("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<ListType | "all">("all");
  const [listSortBy, setListSortBy] = useState<
    "recent" | "name" | "items" | "completion"
  >(() => {
    return (localStorage.getItem("listSortBy") as any) || "recent";
  });
  const [showCompleted, setShowCompleted] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [viewMode, setViewMode] = useState<"dashboard" | "list">(() => {
    return (localStorage.getItem("dashboardViewMode") as "dashboard" | "list") || "dashboard";
  });
  const [dueDateFilter, setDueDateFilter] = useState<
    "all" | "today" | "week" | "overdue"
  >("all");
  const [priorityFilter, setPriorityFilter] = useState<
    "all" | "high" | "medium" | "low"
  >("all");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [selectedList, setSelectedList] = useState<any>(null);
  
  // Search state for querying all lists
  const [searchResults, setSearchResults] = useState<any[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);
  
  // Edit list state
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingList, setEditingList] = useState<any>(null);
  const [editListTitle, setEditListTitle] = useState("");
  const [editListCategory, setEditListCategory] = useState<ListCategory>("Tasks");
  const [editListType, setEditListType] = useState<ListType>("custom");
  
  // Category modal state
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [selectedCategoryForModal, setSelectedCategoryForModal] = useState<ListCategory | null>(null);
  
  // Help modal state
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  
  // Share dialog state
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [shareListId, setShareListId] = useState<string | null>(null);
  
  // Export dropdown state
  const [exportDropdownOpen, setExportDropdownOpen] = useState<string | null>(null);

  // Team management modal state
  const [isTeamManagementOpen, setIsTeamManagementOpen] = useState(false);
  
  // Guest management modal state
  const [isGuestManagementOpen, setIsGuestManagementOpen] = useState(false);
  const [selectedListForGuests, setSelectedListForGuests] = useState<string | null>(null);

  // Use global account context
  const { 
    availableAccounts, 
    currentAccountId, 
    setCurrentAccountId, 
    currentAccount, 
    isTeamContext, 
    effectiveTier,
    loadingAccounts 
  } = useAccount();

  // Check if user can manage team (owner + Lots More tier)
  const canManageTeam = currentAccount?.type === 'team' && 
                        currentAccount?.ownerId === user?.id && 
                        effectiveTier === 'lots_more';

  // Use the actual loading state from the lists context
  // Only show loading skeleton if we haven't loaded once yet AND there are no lists
  // This prevents flashing when navigating back to dashboard with cached data
  const isLoading = !hasLoadedOnce && lists.length === 0;

  // Reset view mode to dashboard when landing on dashboard page
  // This ensures back button navigation works correctly
  useEffect(() => {
    localStorage.setItem("dashboardViewMode", "dashboard");
    setViewMode("dashboard");
  }, []);

  // Handle import from share link (when redirected from SharedListView)
  useEffect(() => {
    if (importShareId && hasLoadedOnce) {
      // Clear the URL parameter
      setSearchParams({});
      
      // Navigate to import/export with the share ID pre-filled
      navigate(`/import-export?shareId=${importShareId}`);
    }
  }, [importShareId, hasLoadedOnce, setSearchParams, navigate]);
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Press 'N' to open create dialog
      if (e.key === "n" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const target = e.target as HTMLElement;
        if (target.tagName !== "INPUT" && target.tagName !== "TEXTAREA") {
          e.preventDefault();
          setIsCreateDialogOpen(true);
        }
      }
      // Press '/' to focus search
      if (e.key === "/" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const target = e.target as HTMLElement;
        if (target.tagName !== "INPUT" && target.tagName !== "TEXTAREA") {
          e.preventDefault();
          searchInputRef.current?.focus();
        }
      }
      // Press 'Escape' to close dialog
      if (e.key === "Escape") {
        setIsCreateDialogOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Debounced search effect - searches all lists in database
  useEffect(() => {
    // Clear previous timeout
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }

    // If search is empty, clear results
    if (!searchQuery.trim()) {
      setSearchResults(null);
      setIsSearching(false);
      return;
    }

    // Set searching state
    setIsSearching(true);

    // Debounce the search
    searchDebounceRef.current = setTimeout(async () => {
      try {
        const results = await searchAllLists(searchQuery, {
          includeArchived: showArchived,
          favoritesOnly: showFavoritesOnly,
          category: selectedCategory !== "All" ? selectedCategory as any : undefined,
        });
        setSearchResults(results);
      } catch (error) {
        // Silently handle search errors - user may not be authenticated yet
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
    };
  }, [searchQuery, showArchived, showFavoritesOnly, selectedCategory, searchAllLists]);

  const handleCreateList = () => {
    // Validate list name
    const nameValidation = validateListName(newListTitle);
    if (!nameValidation.valid) {
      toast({
        title: "⚠️ Invalid list name",
        description: nameValidation.error,
        variant: "destructive",
      });
      return;
    }

    // Validate category
    const categoryValidation = validateCategory(newListCategory);
    if (!categoryValidation.valid) {
      toast({
        title: "⚠️ Invalid category",
        description: categoryValidation.error,
        variant: "destructive",
      });
      return;
    }

    // Check for duplicate list name
    const existingList = lists.find(
      (l) => l.title.toLowerCase() === nameValidation.value!.toLowerCase(),
    );
    if (existingList) {
      toast({
        title: "⚠️ This list name already exists",
        description: `Try another name like "${nameValidation.value} 2" or "${nameValidation.value} - New".`,
        variant: "destructive",
      });
      return;
    }

    // Check list limit - count only owned active personal lists (exclude guest access, archived, and team lists)
    if (user) {
      const ownedActiveListsCount = lists.filter(
        (l) => l.userId === user.id && !l.isGuestAccess && !l.isArchived && !l.title.startsWith("[Archived]") && !l.accountId
      ).length;
      const limitCheck = checkListLimit(ownedActiveListsCount, user.listLimit);
      if (!limitCheck.valid) {
        setShowLimitModal(true);
        return;
      }
    }

    try {
      addList(nameValidation.value!, newListCategory, newListType);
      setNewListTitle("");
      setIsCreateDialogOpen(false);
      toast({
        title: "List created successfully!",
        description: `${nameValidation.value} has been added to your lists`,
      });
    } catch (error: any) {
      toast({
        title: "❌ Failed to create list",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleEditList = () => {
    if (!editingList) return;

    // Validate list name
    const nameValidation = validateListName(editListTitle);
    if (!nameValidation.valid) {
      toast({
        title: "⚠️ Invalid list name",
        description: nameValidation.error,
        variant: "destructive",
      });
      return;
    }

    // Validate category
    const categoryValidation = validateCategory(editListCategory);
    if (!categoryValidation.valid) {
      toast({
        title: "⚠️ Invalid category",
        description: categoryValidation.error,
        variant: "destructive",
      });
      return;
    }

    // Check for duplicate list name (excluding current list)
    const existingList = lists.find(
      (l) => l.id !== editingList.id && l.title.toLowerCase() === nameValidation.value!.toLowerCase(),
    );
    if (existingList) {
      toast({
        title: "⚠️ This list name already exists",
        description: `Try another name like "${nameValidation.value} 2" or "${nameValidation.value} - New".`,
        variant: "destructive",
      });
      return;
    }

    try {
      updateList(editingList.id, {
        title: nameValidation.value!,
        category: editListCategory,
        listType: editListType,
      });
      setIsEditDialogOpen(false);
      setEditingList(null);
      toast({
        title: "List updated successfully!",
        description: `${nameValidation.value} has been updated`,
      });
    } catch (error: any) {
      toast({
        title: "❌ Failed to update list",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const openEditDialog = (list: any, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingList(list);
    setEditListTitle(list.title);
    setEditListCategory(list.category);
    setEditListType(list.listType);
    setIsEditDialogOpen(true);
  };

  const handleListSortChange = (value: string) => {
    setListSortBy(value as any);
    localStorage.setItem("listSortBy", value);
  };

  const handleViewModeChange = (mode: "dashboard" | "list") => {
    setViewMode(mode);
    localStorage.setItem("dashboardViewMode", mode);
    
    if (mode === "list") {
      const lastListId = localStorage.getItem("last_list_id");
      if (lastListId) {
        const listExists = lists.find(l => l.id === lastListId);
        if (listExists) {
          navigate(`/list/${lastListId}`);
        } else if (lists.length > 0) {
          // Last list not found, open first list
          const firstList = lists[0];
          localStorage.setItem("last_list_id", firstList.id);
          navigate(`/list/${firstList.id}`);
        } else {
          toast({
            title: "No lists available",
            description: "Create a new list to get started.",
          });
        }
      } else if (lists.length > 0) {
        // No last_list_id exists, open first list
        const firstList = lists[0];
        localStorage.setItem("last_list_id", firstList.id);
        navigate(`/list/${firstList.id}`);
      } else {
        toast({
          title: "No lists available",
          description: "Create a new list to get started.",
        });
      }
    }
  };

  const handleToggleFavorite = async (e: React.MouseEvent, listId: string) => {
    e.stopPropagation();
    try {
      await toggleFavorite(listId);
    } catch (error: any) {
      toast({
        title: "❌ Failed to update favorite",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleUnarchive = async (e: React.MouseEvent, listId: string) => {
    e.stopPropagation();
    try {
      await unarchiveList(listId);
      toast({
        title: "List restored",
        description: "The list has been restored from archive.",
      });
    } catch (error: any) {
      toast({
        title: "❌ Failed to restore list",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getActiveFilterCount = () => {
    let count = 0;
    if (!showCompleted) count++;
    if (showArchived) count++;
    if (showFavoritesOnly) count++;
    if (dueDateFilter !== "all") count++;
    if (priorityFilter !== "all") count++;
    return count;
  };

  const getTimeAgo = (date: string | Date | null | undefined) => {
    if (!date) return 'Never';
    try {
      return formatDistanceToNow(new Date(date), { addSuffix: true });
    } catch (error) {
      console.error('[ListMine] Invalid date in getTimeAgo:', date, error);
      return 'Unknown';
    }
  };

  const getDueToday = (list: any) => {
    return Math.max(0, (list.items || []).filter(
      (item: any) =>
        item.dueDate && isToday(new Date(item.dueDate)) && !item.completed,
    ).length);
  };

  const handleQuickShare = async (e: React.MouseEvent, listId: string, isAlreadyShared: boolean) => {
    e.stopPropagation();
    
    // Check if user can share (use effectiveTier for team context)
    if (!canShareLists(effectiveTier)) {
      toast({
        title: "⭐ Upgrade Required",
        description: "Sharing is available on paid plans. Upgrade to share your lists!",
        variant: "default",
      });
      navigate("/upgrade");
      return;
    }
    
    // Always open share settings modal - for both new and existing shares
    setShareListId(listId);
    setIsShareDialogOpen(true);
  };

  const handleQuickExport = (e: React.MouseEvent, listId: string, format: string) => {
    e.stopPropagation();
    
    // Check if user can export (use effectiveTier for team context)
    if (!canExportLists(effectiveTier)) {
      toast({
        title: "⭐ Upgrade Required",
        description: "Export is available on paid plans. Upgrade to export your lists!",
        variant: "default",
      });
      navigate("/upgrade");
      return;
    }
    
    try {
      exportList(listId, format as "csv" | "txt" | "pdf");
      toast({
        title: "List exported!",
        description: `${format.toUpperCase()} file downloaded successfully`,
      });
      setExportDropdownOpen(null);
    } catch (error: any) {
      toast({
        title: "❌ Export failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleQuickUnshare = async (e: React.MouseEvent, listId: string) => {
    e.stopPropagation();
    
    try {
      await unshareList(listId);
      toast({
        title: "List unshared",
        description: "This list is no longer shared. Previous share links will no longer work.",
      });
    } catch (error: any) {
      toast({
        title: "❌ Failed to unshare list",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleQuickDelete = (e: React.MouseEvent, listId: string) => {
    e.stopPropagation();
  };

  // Count only owned active personal lists for limit calculations
  // Excludes: guest/shared-with-me lists, archived lists, team lists (with accountId)
  const ownedActiveListsCount = lists.filter(
    (l) => l.userId === user?.id && !l.isGuestAccess && !l.isArchived && !l.title.startsWith("[Archived]") && !l.accountId
  ).length;

  const getUsagePercentage = () => {
    if (!user || user.listLimit === -1) return 0;
    const percentage = (ownedActiveListsCount / user.listLimit) * 100;
    return Math.min(100, Math.max(0, percentage));
  };

  const getRemainingLists = () => {
    if (!user || user.listLimit === -1) return "Unlimited";
    const remaining = user.listLimit - ownedActiveListsCount;
    return Math.max(0, remaining);
  };

  const getTierName = (tier: string) => {
    switch (tier) {
      case "free":
        return "Free";
      case "good":
        return "Good";
      case "even_better":
        return "Even Better";
      case "lots_more":
        return "Lots More";
      default:
        return "Free";
    }
  };

  // Static fallback categories
  const staticCategories: ListCategory[] = [
    "Household",
    "Shopping",
    "Work",
    "School",
    "Tasks",
    "Other",
  ];

  // Use search results if available, otherwise use loaded lists
  let displayLists = searchQuery.trim() && searchResults !== null 
    ? searchResults 
    : lists;

  // Apply local search filter only if not using database search results
  if (searchQuery.trim() && searchResults === null) {
    displayLists = searchLists(searchQuery);
  }

  // Apply account filter based on selected account
  if (currentAccountId && currentAccount) {
    if (currentAccount.type === 'personal') {
      // Personal account: show user's own lists that are NOT team lists (accountId is null)
      // ALSO show guest/shared lists in personal mode
      displayLists = displayLists.filter(
        (list) => {
          // Show personal lists (owned by user, no accountId)
          const isPersonalList = list.userId === user?.id && !list.accountId;
          // Show guest/shared lists in personal mode
          const isGuestList = list.isGuestAccess;
          return isPersonalList || isGuestList;
        }
      );
    } else if (currentAccount.type === 'team') {
      // Team account: show ONLY lists that belong to this team (by accountId)
      // Do NOT show guest/shared lists in team mode
      displayLists = displayLists.filter(
        (list) => list.accountId === currentAccountId && !list.isGuestAccess
      );
    }
  }

  // Apply category filter
  if (selectedCategory !== "All") {
    displayLists = displayLists.filter(
      (list) => list.category === selectedCategory,
    );
  }

  // Apply type filter (using normalizeListType for legacy value support)
  if (filterType !== "all") {
    displayLists = displayLists.filter((list) => normalizeListType(list.listType) === filterType);
  }

  // Apply favorites filter
  if (showFavoritesOnly) {
    displayLists = displayLists.filter((list) => list.isFavorite);
  }

  // Apply archived filter
  if (!showArchived) {
    displayLists = displayLists.filter((list) => !list.isArchived && !list.title.startsWith("[Archived]"));
  }

  // Apply sorting
  displayLists = [...displayLists].sort((a, b) => {
    switch (listSortBy) {
      case "name":
        return a.title.localeCompare(b.title);
      case "items":
        return (b.items?.length || 0) - (a.items?.length || 0);
      case "completion":
        const aItemCount = a.items?.length || 0;
        const bItemCount = b.items?.length || 0;
        const aCompletion =
          aItemCount > 0
            ? (a.items?.filter((i) => i.completed).length || 0) / aItemCount
            : 0;
        const bCompletion =
          bItemCount > 0
            ? (b.items?.filter((i) => i.completed).length || 0) / bItemCount
            : 0;
        return bCompletion - aCompletion;
      case "recent":
      default:
        const dateA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const dateB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        return dateB - dateA;
    }
  });

  // Get account-filtered lists for favorites and stats
  const accountFilteredLists = (() => {
    if (!currentAccountId || !currentAccount) return lists;
    if (currentAccount.type === 'personal') {
      // Personal: show user's own lists that are NOT team lists (accountId is null)
      return lists.filter((list) => list.userId === user?.id && !list.isGuestAccess && !list.accountId);
    } else if (currentAccount.type === 'team') {
      // Team: show lists that belong to this team (by accountId), NO shared lists
      return lists.filter((list) => list.accountId === currentAccountId && !list.isGuestAccess);
    }
    return lists;
  })();

  // Filter favorites from account-filtered lists, excluding archived
  const favoriteLists = accountFilteredLists.filter(
    (list) => list.isFavorite && !list.isArchived && !list.title.startsWith("[Archived]")
  );
  // Shared lists should ONLY show in personal mode, never in team mode
  const sharedLists = currentAccount?.type === 'personal' 
    ? lists.filter((list) => list.isGuestAccess)
    : [];

  // Count archived lists (from account-filtered lists)
  const archivedCount = accountFilteredLists.filter(
    (list) => list.isArchived || list.title.startsWith("[Archived]")
  ).length;

  const getCategoryStats = (category: ListCategory) => {
    const categoryLists = accountFilteredLists.filter((list) => list.category === category);
    const totalItems = categoryLists.reduce(
      (sum, list) => sum + Math.max(0, list.items?.length || 0),
      0,
    );
    return { count: Math.max(0, categoryLists.length), items: Math.max(0, totalItems) };
  };

  // Get dynamic categories from user's lists (declared after accountFilteredLists)
  const dynamicCategories = useMemo(() => {
    const categoriesFromLists = new Set<string>();
    accountFilteredLists.forEach((list) => {
      if (list.category) {
        categoriesFromLists.add(list.category);
      }
    });
    // Combine static and dynamic, maintaining order (static first, then dynamic new ones)
    const allCategories = [...staticCategories];
    categoriesFromLists.forEach((cat) => {
      if (!allCategories.includes(cat as ListCategory)) {
        allCategories.push(cat as ListCategory);
      }
    });
    return allCategories;
  }, [accountFilteredLists]);
  
  const categories: (ListCategory | "All")[] = ["All", ...dynamicCategories];

  // Show error state if loading failed
  if (error && !loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#F5F8FA] via-white to-[#E6F4F4] flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-2">
            Couldn't Load Lists
          </h2>
          <p className="text-muted-foreground mb-6">{error}</p>
          <Button onClick={retryLoad} className="w-full">
            <Loader2 className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-white to-secondary/10 animate-in fade-in duration-200">
      {/* Onboarding Tooltips for New Users */}
      <OnboardingTooltips />

      {/* Limit Reached Modal */}
      <AlertDialog open={showLimitModal} onOpenChange={setShowLimitModal}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>List Limit Reached</AlertDialogTitle>
            <AlertDialogDescription>
              You've reached your list limit of {user?.listLimit === -1 ? "unlimited" : user?.listLimit} lists on the{" "}
              {getTierName(effectiveTier)} tier. Upgrade to create more
              lists.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowLimitModal(false);
                navigate("/upgrade");
              }}
              className="bg-warning hover:bg-warning/90"
            >
              Upgrade Now
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Header */}
      <header className="bg-white border-b border-border sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Full Logo */}
              <img 
                src="/assets/listmine-logo-full.png" 
                alt="ListMine" 
                className="h-10 sm:h-12"
              />
              <div className="hidden sm:block">
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Welcome back, {user?.name}
                  {user?.tier === "premium" && (
                    <Badge variant="secondary" className="ml-2">
                      <Crown className="w-3 h-3 mr-1" />
                      Premium
                    </Badge>
                  )}
                </p>
              </div>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-2">
              {/* Account Switcher - only show if user has team accounts */}
              {availableAccounts.length > 1 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 px-3 gap-2"
                    >
                      {currentAccount?.type === 'team' ? (
                        <Users className="w-4 h-4 text-secondary" />
                      ) : (
                        <User className="w-4 h-4 text-primary" />
                      )}
                      <span className="max-w-[120px] truncate">
                        {currentAccount?.name || 'Select Account'}
                      </span>
                      <ChevronDown className="w-3 h-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-56">
                    {availableAccounts.map((account) => (
                      <DropdownMenuItem
                        key={account.id}
                        onClick={() => setCurrentAccountId(account.id)}
                        className={currentAccountId === account.id ? 'bg-accent/10' : ''}
                      >
                        {account.type === 'team' ? (
                          <Users className="w-4 h-4 mr-2 text-secondary" />
                        ) : (
                          <User className="w-4 h-4 mr-2 text-primary" />
                        )}
                        <span className="flex-1 truncate">{account.name}</span>
                        {currentAccountId === account.id && (
                          <Badge variant="outline" className="text-xs bg-accent/10 text-accent border-accent/30 ml-2">Active</Badge>
                        )}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              
              {/* View Mode Toggle */}
              <div className="flex items-center bg-muted rounded-lg p-1">
                <Button
                  variant={viewMode === "dashboard" ? "default" : "ghost"}
                  size="sm"
                  className="h-8 px-3"
                  onClick={() => handleViewModeChange("dashboard")}
                >
                  <LayoutDashboard className="w-4 h-4 mr-1" />
                  Dashboard
                </Button>
                <Button
                  variant={viewMode === "list" ? "default" : "ghost"}
                  size="sm"
                  className="h-8 px-3"
                  onClick={() => handleViewModeChange("list")}
                >
                  <List className="w-4 h-4 mr-1" />
                  List
                </Button>
              </div>
              <NotificationBell />
              <Button
                variant="ghost"
                size="icon"
                className="w-8 h-8 rounded-full bg-muted hover:bg-primary/10 text-foreground"
                onClick={() => setIsHelpModalOpen(true)}
              >
                <HelpCircle className="w-4 h-4" />
              </Button>
              {effectiveTier === "free" && (
                <Button
                  onClick={() => navigate("/upgrade", { state: { from: location.pathname } })}
                  variant="outline"
                  size="sm"
                  className="border-warning text-warning min-h-[44px]"
                >
                  <Crown className="w-4 h-4 mr-2" />
                  Upgrade
                </Button>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="min-h-[44px] min-w-[44px] rounded-full overflow-hidden p-0"
                  >
                    {user?.avatarUrl ? (
                      <img 
                        src={user.avatarUrl} 
                        alt={user.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <User className="w-4 h-4" />
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => navigate("/profile")}>
                    <User className="w-4 h-4 mr-2" />
                    Profile
                  </DropdownMenuItem>
                  {canManageTeam && (
                    <DropdownMenuItem onClick={() => setIsTeamManagementOpen(true)}>
                      <Users className="w-4 h-4 mr-2" />
                      Manage Team
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={handleLogout}>
                    <LogOut className="w-4 h-4 mr-2" />
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Mobile Hamburger Menu */}
            <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="md:hidden min-h-[44px] min-w-[44px]"
                >
                  <Menu className="w-6 h-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[280px]">
                <div className="flex flex-col gap-4 mt-8">
                  <div className="pb-4 border-b">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0">
                        {user?.avatarUrl ? (
                          <img 
                            src={user.avatarUrl} 
                            alt={user.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-primary flex items-center justify-center">
                            <User className="w-6 h-6 text-primary-foreground" />
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Signed in as</p>
                        <p className="font-semibold">{user?.name}</p>
                      </div>
                    </div>
                    {user?.tier === "premium" && (
                      <Badge variant="secondary" className="mt-2">
                        <Crown className="w-3 h-3 mr-1" />
                        Premium
                      </Badge>
                    )}
                  </div>
                  
                  {/* Mobile Account Switcher - only show if user has team accounts */}
                  {availableAccounts.length > 1 && (
                    <div className="pb-4 border-b">
                      <p className="text-xs text-muted-foreground mb-2">Switch Account</p>
                      <div className="space-y-1">
                        {availableAccounts.map((account) => (
                          <Button
                            key={account.id}
                            variant={currentAccountId === account.id ? "default" : "ghost"}
                            size="sm"
                            className={`w-full justify-start h-10 ${currentAccountId === account.id ? 'bg-accent hover:bg-accent/90' : ''}`}
                            onClick={() => {
                              setCurrentAccountId(account.id);
                              setIsMobileMenuOpen(false);
                            }}
                          >
                            {account.type === 'team' ? (
                              <Users className="w-4 h-4 mr-2 text-secondary" />
                            ) : (
                              <User className="w-4 h-4 mr-2 text-primary" />
                            )}
                            <span className="truncate">{account.name}</span>
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Mobile View Mode Toggle */}
                  <div className="flex items-center bg-muted rounded-lg p-1 mb-2">
                    <Button
                      variant={viewMode === "dashboard" ? "default" : "ghost"}
                      size="sm"
                      className="flex-1 h-10"
                      onClick={() => {
                        handleViewModeChange("dashboard");
                        setIsMobileMenuOpen(false);
                      }}
                    >
                      <LayoutDashboard className="w-4 h-4 mr-1" />
                      Dashboard
                    </Button>
                    <Button
                      variant={viewMode === "list" ? "default" : "ghost"}
                      size="sm"
                      className="flex-1 h-10"
                      onClick={() => {
                        handleViewModeChange("list");
                        setIsMobileMenuOpen(false);
                      }}
                    >
                      <List className="w-4 h-4 mr-1" />
                      List
                    </Button>
                  </div>
                  {effectiveTier === "free" && (
                    <Button
                      onClick={() => {
                        navigate("/upgrade");
                        setIsMobileMenuOpen(false);
                      }}
                      variant="outline"
                      className="w-full justify-start border-accent text-accent min-h-[44px]"
                    >
                      <Crown className="w-4 h-4 mr-2" />
                      Upgrade to Premium
                    </Button>
                  )}
                  <Button
                    onClick={() => {
                      setIsMergeModalOpen(true);
                      setIsMobileMenuOpen(false);
                    }}
                    variant="outline"
                    className="w-full justify-start min-h-[44px]"
                    disabled={lists.length < 2}
                  >
                    <Merge className="w-4 h-4 mr-2" />
                    Merge Lists
                  </Button>
                  <Button
                    onClick={() => {
                      navigate("/profile");
                      setIsMobileMenuOpen(false);
                    }}
                    variant="outline"
                    className="w-full justify-start min-h-[44px]"
                  >
                    <User className="w-4 h-4 mr-2" />
                    Profile
                  </Button>
                  {canManageTeam && (
                    <Button
                      onClick={() => {
                        setIsMobileMenuOpen(false);
                        setIsTeamManagementOpen(true);
                      }}
                      variant="outline"
                      className="w-full justify-start min-h-[44px]"
                    >
                      <Users className="w-4 h-4 mr-2" />
                      Manage Team
                    </Button>
                  )}
                  <Button
                    onClick={async () => {
                      setIsMobileMenuOpen(false);
                      await handleLogout();
                    }}
                    variant="outline"
                    className="w-full justify-start min-h-[44px]"
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Logout
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        {/* Welcome Banner for New Users */}
        {lists.length === 0 && (
          <div className="mb-6 bg-gradient-to-r from-primary/10 to-secondary/10 rounded-lg border border-primary/20 p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center flex-shrink-0">
                <ListChecks className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold text-foreground mb-2">
                  Welcome to ListMine! 🎉
                </h2>
                <p className="text-foreground mb-3">
                  You're all set with a <span className="font-semibold">Free account</span>. 
                  Start organizing your life with up to 5 lists and 20 items per list!
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() => setIsCreateDialogOpen(true)}
                    size="sm"
                    className="min-h-[36px]"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Create Your First List
                  </Button>
                  <Button
                    onClick={() => window.open('https://listmine.com/how-it-works', '_blank')}
                    variant="outline"
                    size="sm"
                    className="min-h-[36px]"
                  >
                    <HelpCircle className="w-4 h-4 mr-2" />
                    How It Works
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Usage Stats */}
        <div className="mb-4 sm:mb-6 bg-white rounded-lg border border-border p-4 sm:p-6">
          <div className="flex flex-wrap items-center gap-3 sm:gap-6">
            {/* Tier */}
            <div className="flex items-center gap-2">
              <img 
                src="/assets/listmine-icon.png" 
                alt="ListMine" 
                className="h-5 w-5"
              />
              <span className="text-sm font-semibold text-foreground">
                {getTierName(effectiveTier)} Tier{isTeamContext && " (Team)"}
              </span>
            </div>

            {/* Divider */}
            <div className="hidden sm:block h-6 w-px bg-border" />

            {/* Total Lists */}
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              <span className="text-sm text-muted-foreground">
                Your Lists:{" "}
                <span className="font-semibold text-foreground">
                  {ownedActiveListsCount}
                  {user?.listLimit !== -1 && (
                    <span className="text-muted-foreground"> / {user?.listLimit}</span>
                  )}
                  {user?.listLimit === -1 && (
                    <span className="text-muted-foreground"> / Unlimited</span>
                  )}
                </span>
              </span>
              {user?.listLimit !== -1 && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="w-4 h-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">
                        You're using {ownedActiveListsCount} of your{" "}
                        {user?.listLimit} lists on the{" "}
                        {getTierName(effectiveTier)} tier{isTeamContext && " (Team)"}. Shared lists
                        and archived lists don't count toward your limit.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>

            {/* Divider */}
            <div className="hidden sm:block h-6 w-px bg-border" />

            {/* Total Items */}
            <div className="flex items-center gap-2">
              <Package className="w-5 h-5 text-primary" />
              <span className="text-sm text-muted-foreground">
                Total Items:{" "}
                <span className="font-semibold text-foreground">
                  {Math.max(0, lists.reduce((sum, list) => sum + (list.items?.length || 0), 0))}
                </span>
                <span className="text-muted-foreground">
                  {" "}/ {user?.itemsPerListLimit === -1 ? "Unlimited" : `${user?.itemsPerListLimit} per list`}
                </span>
              </span>
            </div>

            {/* Capacity Warning Badge */}
            {user?.listLimit !== -1 && getUsagePercentage() >= 80 && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge
                      variant="outline"
                      className="bg-warning/10 text-warning border-warning/30 ml-auto"
                    >
                      <AlertCircle className="w-3 h-3 mr-1" />
                      {Math.round(getUsagePercentage())}% capacity
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    You're using {Math.round(getUsagePercentage())}% of your
                    list limit. Consider upgrading to create more lists.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          {effectiveTier === "free" && (
            <div className="mt-3 pt-3 border-t border-border">
              <p className="text-sm text-muted-foreground">
                Need more lists?{' '}
                <button
                  onClick={() => navigate('/upgrade', { state: { from: location.pathname } })}
                  className="text-primary hover:underline font-medium"
                >
                  Upgrade
                </button>
              </p>
            </div>
          )}
        </div>

        {/* Search and Filters */}
        <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            {isSearching ? (
              <Loader2 className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground animate-spin" />
            ) : (
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            )}
            <Input
              ref={searchInputRef}
              placeholder="Search all lists..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-12 pr-10 h-12 text-base"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 transform -translate-y-1/2 h-10 w-10"
                onClick={() => {
                  setSearchQuery("");
                  setSearchResults(null);
                }}
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
          {/* Search results indicator */}
          {searchQuery.trim() && searchResults !== null && (
            <div className="text-sm text-muted-foreground flex items-center gap-2">
              <span>
                Found {searchResults.length} list{searchResults.length !== 1 ? "s" : ""}
                {showArchived ? " (including archived)" : ""}
              </span>
            </div>
          )}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="h-12 w-full sm:w-auto min-h-[44px]"
              >
                <Filter className="w-4 h-4 mr-2" />
                Filters
                {getActiveFilterCount() > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {getActiveFilterCount()}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80">
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-semibold mb-3 block">
                    Display Options
                  </Label>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="showCompleted"
                        checked={showCompleted}
                        onCheckedChange={(checked) =>
                          setShowCompleted(checked as boolean)
                        }
                      />
                      <label htmlFor="showCompleted" className="text-sm">
                        Show completed items
                      </label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="showArchived"
                        checked={showArchived}
                        onCheckedChange={(checked) =>
                          setShowArchived(checked as boolean)
                        }
                      />
                      <label htmlFor="showArchived" className="text-sm">
                        Show archived lists {archivedCount > 0 && `(${archivedCount})`}
                      </label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="showFavoritesOnly"
                        checked={showFavoritesOnly}
                        onCheckedChange={(checked) =>
                          setShowFavoritesOnly(checked as boolean)
                        }
                      />
                      <label htmlFor="showFavoritesOnly" className="text-sm">
                        <Star className="w-3 h-3 inline mr-1" />
                        Favorites only
                      </label>
                    </div>
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-semibold mb-3 block">
                    Due Date
                  </Label>
                  <RadioGroup
                    value={dueDateFilter}
                    onValueChange={(value: any) => setDueDateFilter(value)}
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="all" id="due-all" />
                      <label htmlFor="due-all" className="text-sm">
                        All
                      </label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="today" id="due-today" />
                      <label htmlFor="due-today" className="text-sm">
                        Today
                      </label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="week" id="due-week" />
                      <label htmlFor="due-week" className="text-sm">
                        This Week
                      </label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="overdue" id="due-overdue" />
                      <label htmlFor="due-overdue" className="text-sm">
                        Overdue
                      </label>
                    </div>
                  </RadioGroup>
                </div>

                <div>
                  <Label className="text-sm font-semibold mb-3 block">
                    Priority
                  </Label>
                  <RadioGroup
                    value={priorityFilter}
                    onValueChange={(value: any) => setPriorityFilter(value)}
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="all" id="priority-all" />
                      <label htmlFor="priority-all" className="text-sm">
                        All
                      </label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="high" id="priority-high" />
                      <label htmlFor="priority-high" className="text-sm">
                        High
                      </label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="medium" id="priority-medium" />
                      <label htmlFor="priority-medium" className="text-sm">
                        Medium
                      </label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="low" id="priority-low" />
                      <label htmlFor="priority-low" className="text-sm">
                        Low
                      </label>
                    </div>
                  </RadioGroup>
                </div>

                <div>
                  <Label>List Type</Label>
                  <Select
                    value={filterType}
                    onValueChange={(value) =>
                      setFilterType(value as ListType | "all")
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      {listTypes.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </PopoverContent>
          </Popover>
          <Select value={listSortBy} onValueChange={handleListSortChange}>
            <SelectTrigger className="w-[140px] h-12 min-h-[44px]">
              <SortAsc className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">Recent</SelectItem>
              <SelectItem value="name">Name (A-Z)</SelectItem>
              <SelectItem value="items">Most Items</SelectItem>
              <SelectItem value="completion">Completion %</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Action Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-end justify-end gap-3 mb-6">
          <div className="flex items-center gap-2 flex-wrap sm:justify-end">
{canImportLists(effectiveTier) && (
              <Button 
                variant="outline"
                className="min-h-[44px]"
                onClick={() => navigate("/import-export", { state: { from: location.pathname } })}
              >
                <Upload className="w-4 h-4 mr-2" />
                Import/Export
              </Button>
            )}
            {effectiveTier !== "free" && (
              <Button 
                variant="outline"
                className="min-h-[44px] border-primary/30 text-primary hover:bg-primary/10"
                onClick={() => navigate(currentAccount?.type === "team" ? "/templates?ctx=team" : "/templates", { state: { from: location.pathname, isTeamContext: currentAccount?.type === "team", teamAccountId: currentAccount?.type === "team" ? currentAccount.id : null } })}
              >
                <FileText className="w-4 h-4 mr-2" />
                Templates
              </Button>
            )}
            <Select 
              value="" 
              onValueChange={(listId) => {
                if (listId) {
                  localStorage.setItem("last_list_id", listId);
                  navigate(`/list/${listId}`);
                }
              }}
            >
              <SelectTrigger className="w-[180px] h-[44px]">
                <SelectValue placeholder="Jump to list..." />
              </SelectTrigger>
              <SelectContent>
                {lists.map((list) => (
                  <SelectItem key={list.id} value={list.id}>
                    {list.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button 
              variant="outline"
              className="min-h-[44px]"
              onClick={() => setIsMergeModalOpen(true)}
              disabled={lists.length < 2}
              title={lists.length < 2 ? "Need at least 2 lists to merge" : "Merge two lists together"}
            >
              <Merge className="w-4 h-4 mr-2" />
              Merge Lists
            </Button>
            <Button 
              className="min-h-[44px]"
              onClick={() => setIsCreateDialogOpen(true)}
            >
              <Plus className="w-4 h-4 mr-2" />
              New List
            </Button>
          </div>
        </div>

        {/* Search Results Section - Only visible when searching */}
        {searchQuery.trim() && (
          <div className="mb-6 sm:mb-8">
            <h2 className="text-base sm:text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <Search className="w-5 h-5 text-primary" />
              Search Results
              {displayLists.length > 0 && (
                <span className="text-sm font-normal text-muted-foreground">
                  ({displayLists.length} list{displayLists.length !== 1 ? "s" : ""})
                </span>
              )}
            </h2>
            {displayLists.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 pb-2">
                {displayLists.map((list, index) => {
                  const Icon = categoryIcons[list.category] || ListChecks;
                  const itemCount = Math.max(0, list.items?.length || 0);
                  const completedItems = Math.max(0, list.items?.filter(
                    (item) => item.completed,
                  ).length || 0);
                  return (
                    <Card
                      key={list.id}
                      className="hover:shadow-lg hover:bg-primary/5 transition-all cursor-pointer group relative animate-slide-up"
                      style={{ animationDelay: `${index * 50}ms` }}
                      onClick={() => {
                        localStorage.setItem("last_list_id", list.id);
                        navigate(`/list/${list.id}`);
                      }}
                    >
                      {/* Quick Actions - shown on hover */}
                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-all duration-200 flex flex-wrap gap-1.5 z-10 bg-white/95 backdrop-blur-sm rounded-lg p-1.5 shadow-lg border border-gray-100 max-w-[140px] justify-end">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className={`h-7 w-7 rounded-full ${list.isFavorite ? 'bg-muted hover:bg-primary/10' : 'bg-muted hover:bg-primary/10'} transition-colors`}
                                onClick={(e) => handleToggleFavorite(e, list.id)}
                              >
                                <Star className={`w-3.5 h-3.5 ${list.isFavorite ? 'text-amber-500 fill-amber-500' : 'text-muted-foreground'}`} />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>{list.isFavorite ? 'Remove from Favorites' : 'Add to Favorites'}</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        {list.isArchived && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 rounded-full bg-accent/10 hover:bg-accent/20 transition-colors"
                                  onClick={(e) => handleUnarchive(e, list.id)}
                                >
                                  <ArchiveRestore className="w-3.5 h-3.5 text-accent" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Restore from Archive</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-10 h-10 rounded-lg ${categoryColors[list.category]} flex items-center justify-center`}
                            >
                              <Icon className="w-5 h-5" />
                            </div>
                            <div>
                              <CardTitle className="text-lg flex items-center gap-2 flex-wrap">
                                {list.title}
                                {list.isGuestAccess && (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Badge variant="outline" className="text-xs bg-teal-100 text-teal-700 border-teal-300">
                                          <Users className="w-3 h-3 mr-1" />
                                          Guest (can edit)
                                        </Badge>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>You have guest access to edit this list</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                )}
                                {list.accountId && (
                                  <Badge variant="outline" className="text-xs bg-secondary/10 text-secondary border-secondary/30">
                                    <Users className="w-3 h-3 mr-1" />
                                    Team
                                  </Badge>
                                )}
                                {!list.accountId && !list.isGuestAccess && (
                                  <Badge variant="outline" className="text-xs bg-muted text-muted-foreground border-border">
                                    <User className="w-3 h-3 mr-1" />
                                    Personal
                                  </Badge>
                                )}
                                {list.isArchived && (
                                  <Badge variant="secondary" className="text-xs">Archived</Badge>
                                )}
                              </CardTitle>
                              <CardDescription>
                                {list.category} ·{" "}
                                {list.listType}
                              </CardDescription>
                            </div>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">
                              {itemCount} items
                            </span>
                            <span className="text-muted-foreground">
                              {completedItems} completed
                            </span>
                          </div>
                          {itemCount > 0 && (
                            <div className="w-full bg-muted rounded-full h-1.5">
                              <div
                                className="bg-primary h-1.5 rounded-full transition-all"
                                style={{
                                  width: `${(completedItems / itemCount) * 100}%`,
                                }}
                              />
                            </div>
                          )}
                          <div className="flex items-center justify-between pt-2">
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Clock className="w-3 h-3" />
                              <span>Updated {getTimeAgo(list.updatedAt)}{list.lastEditedByEmail && ` by ${list.lastEditedByEmail.split('@')[0]}`}</span>
                            </div>
                            <div className="flex gap-1">
                              {list.isShared && canShareLists(effectiveTier) && (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Badge
                                        variant="outline"
                                        className="bg-primary/10 border-primary/20 text-xs"
                                      >
                                        <Share2 className="w-3 h-3 mr-1 text-primary" />
                                        <span className="text-primary">Shared</span>
                                      </Badge>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>
                                        {list.shareMode === 'view_only' 
                                          ? "Shared link active: View only"
                                          : "Shared link active: Importable (copy)"}
                                      </p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Search className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
                <p>No lists found matching "{searchQuery}"</p>
                <p className="text-sm mt-1">Try a different search term</p>
              </div>
            )}
          </div>
        )}

        {/* Favorites Row - Hidden when searching */}
        {!searchQuery.trim() && (
        <div className="mb-6 sm:mb-8">
          <h2 className="text-base sm:text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
            Favorites
          </h2>
          {favoriteLists.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 pb-2">
              {favoriteLists.map((list, index) => {
                const Icon = categoryIcons[list.category] || ListChecks;
                const itemCount = Math.max(0, list.items?.length || 0);
                const completedItems = Math.max(0, list.items?.filter(
                  (item) => item.completed,
                ).length || 0);
                return (
                  <Card
                    key={list.id}
                    className="hover:shadow-lg hover:bg-primary/5 transition-all cursor-pointer group relative animate-slide-up"
                    style={{ animationDelay: `${index * 50}ms` }}
                    onClick={() => {
                      localStorage.setItem("last_list_id", list.id);
                      navigate(`/list/${list.id}`);
                    }}
                  >
                    {/* Quick Actions - shown on hover */}
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-all duration-200 flex flex-wrap gap-1.5 z-10 bg-white/95 backdrop-blur-sm rounded-lg p-1.5 shadow-lg border border-gray-100 max-w-[140px] justify-end">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 rounded-full bg-muted hover:bg-primary/10 transition-colors"
                              onClick={(e) => handleToggleFavorite(e, list.id)}
                            >
                              <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Remove from Favorites</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 rounded-full bg-muted hover:bg-primary/10 transition-colors"
                              onClick={(e) => openEditDialog(list, e)}
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Edit</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      {/* Share dropdown menu - only show for paid tiers */}
                      {canShareLists(effectiveTier) && (
                        <DropdownMenu>
                          <TooltipProvider>
                            <Tooltip>
                              <DropdownMenuTrigger asChild>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className={`h-7 w-7 rounded-full transition-colors ${list.isShared ? "bg-primary/10 hover:bg-primary/20" : "bg-muted hover:bg-primary/10"}`}
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <Share2 className={`w-3.5 h-3.5 ${list.isShared ? "text-primary" : ""}`} />
                                  </Button>
                                </TooltipTrigger>
                              </DropdownMenuTrigger>
                              <TooltipContent>{list.isShared ? "Share Options" : "Share"}</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <DropdownMenuContent onClick={(e) => e.stopPropagation()}>
                            <DropdownMenuItem onClick={(e) => { handleQuickShare(e as any, list.id, list.isShared || false); }}>
                              <Share2 className="w-4 h-4 mr-2" />
                              {list.isShared ? "Share Settings" : "Share options"}
                            </DropdownMenuItem>
                            {canInviteGuests(effectiveTier) && (
                              <DropdownMenuItem onClick={() => { setSelectedListForGuests(list.id); setIsGuestManagementOpen(true); }}>
                                <Users className="w-4 h-4 mr-2" />
                                Manage Guests
                              </DropdownMenuItem>
                            )}
                            {canHaveTeamMembers(effectiveTier) && (
                              <DropdownMenuItem onClick={() => setIsTeamManagementOpen(true)}>
                                <Users className="w-4 h-4 mr-2" />
                                Manage Team
                              </DropdownMenuItem>
                            )}
                            {list.isShared && canShareLists(effectiveTier) && (
                              <DropdownMenuItem onClick={(e) => handleQuickUnshare(e as any, list.id)} className="text-red-600">
                                <Link2Off className="w-4 h-4 mr-2" />
                                Unshare List
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                      <DropdownMenu open={exportDropdownOpen === `fav-${list.id}`} onOpenChange={(open) => setExportDropdownOpen(open ? `fav-${list.id}` : null)}>
                        <TooltipProvider>
                          <Tooltip>
                            <DropdownMenuTrigger asChild>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 rounded-full bg-muted hover:bg-primary/10 transition-colors"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Download className="w-3.5 h-3.5" />
                                </Button>
                              </TooltipTrigger>
                            </DropdownMenuTrigger>
                            <TooltipContent>Export</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <DropdownMenuContent onClick={(e) => e.stopPropagation()}>
                          {canExportLists(effectiveTier) ? (
                            <>
                              {getAvailableExportFormats(effectiveTier).map((format) => (
                                <DropdownMenuItem
                                  key={format}
                                  onClick={(e) => handleQuickExport(e as any, list.id, format)}
                                >
                                  Export as {format.toUpperCase()}
                                </DropdownMenuItem>
                              ))}
                            </>
                          ) : (
                            <DropdownMenuItem onClick={() => navigate("/upgrade")}>
                              <Crown className="w-4 h-4 mr-2" />
                              Upgrade to Export
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 rounded-full bg-muted hover:bg-accent/20 transition-colors"
                              onClick={async (e) => {
                                e.stopPropagation();
                                const archivedTitle = list.title.startsWith("[Archived]") 
                                  ? list.title 
                                  : `[Archived] ${list.title}`;
                                
                                try {
                                  await updateList(list.id, { title: archivedTitle });
                                  toast({
                                    title: "List archived",
                                    description: `"${list.title}" has been archived and hidden from your dashboard`,
                                  });
                                } catch (error) {
                                  console.error("Error archiving list:", error);
                                  toast({
                                    title: "Error",
                                    description: "Failed to archive list",
                                    variant: "destructive",
                                  });
                                }
                              }}
                            >
                              <Archive className="w-3.5 h-3.5 text-accent" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Archive list (hide from dashboard)</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      {list.isArchived && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 rounded-full bg-accent/10 hover:bg-accent/20 transition-colors"
                                onClick={(e) => handleUnarchive(e, list.id)}
                              >
                                <ArchiveRestore className="w-3.5 h-3.5 text-accent" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Restore from Archive</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                      {lists.length >= 2 && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 rounded-full bg-muted hover:bg-accent/20 transition-colors"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setMergeSourceListId(list.id);
                                  setIsMergeModalOpen(true);
                                }}
                              >
                                <Merge className="w-3.5 h-3.5 text-accent" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Merge with another list</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                      <AlertDialog>
                        <TooltipProvider>
                          <Tooltip>
                            <AlertDialogTrigger asChild>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 rounded-full bg-muted hover:bg-destructive/20 transition-colors"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Trash2 className="w-3.5 h-3.5 text-red-600" />
                                </Button>
                              </TooltipTrigger>
                            </AlertDialogTrigger>
                            <TooltipContent>Delete</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <AlertDialogContent
                          onClick={(e) => e.stopPropagation()}
                        >
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete list?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will delete "{list.title}" and all its items.
                              You can undo this action for a few seconds.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={async () => {
                                const listData = {
                                  ...list,
                                  items: list.items.map(item => ({ ...item })),
                                };
                                
                                await executeWithUndo(
                                  `delete-list-${list.id}`,
                                  listData,
                                  async () => {
                                    await deleteList(list.id);
                                  },
                                  async (data) => {
                                    await restoreList(data);
                                  },
                                  {
                                    title: "List deleted",
                                    description: `"${list.title}" has been removed`,
                                    undoDescription: `"${list.title}" has been restored`,
                                  }
                                );
                              }}
                              className="bg-red-600 hover:bg-red-700"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>

                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-10 h-10 rounded-lg ${categoryColors[list.category]} flex items-center justify-center`}
                          >
                            <Icon className="w-5 h-5" />
                          </div>
                          <div>
                            <CardTitle className="text-lg flex items-center gap-2">
                              {list.title}
                              {list.isGuestAccess && (
                                <Badge variant="outline" className="text-xs bg-teal-100 text-teal-700 border-teal-300">Guest (can edit)</Badge>
                              )}
                            </CardTitle>
                            <CardDescription>
                              {list.category} ·{" "}
                              {list.listType}
                            </CardDescription>
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">
                            {itemCount} items
                          </span>
                          <span className="text-muted-foreground">
                            {completedItems} completed
                          </span>
                        </div>
                        {itemCount > 0 && (
                          <div className="w-full bg-muted rounded-full h-1.5">
                            <div
                              className="bg-primary h-1.5 rounded-full transition-all"
                              style={{
                                width: `${(completedItems / itemCount) * 100}%`,
                              }}
                            />
                          </div>
                        )}
                        <div className="flex items-center justify-between pt-2">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Clock className="w-3 h-3" />
                            <span>Updated {getTimeAgo(list.updatedAt)}{list.lastEditedByEmail && ` by ${list.lastEditedByEmail.split('@')[0]}`}</span>
                          </div>
                          <div className="flex gap-1">
                            {list.isShared && canShareLists(effectiveTier) && (
                              <div className="flex items-center gap-1">
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Badge
                                        variant="outline"
                                        className="bg-primary/10 border-primary/20 text-xs cursor-pointer hover:bg-primary/20"
                                        onClick={(e) => handleQuickShare(e, list.id, true)}
                                      >
                                        <Share2 className="w-3 h-3 mr-1 text-primary" />
                                        <span className="text-primary underline">Shared</span>
                                      </Badge>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>
                                        {list.shareMode === 'view_only' 
                                          ? "Shared link active: View only"
                                          : "Shared link active: Importable (copy)"}
                                      </p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                                <Badge
                                  variant="outline"
                                  className="bg-red-50 border-red-200 text-xs cursor-pointer hover:bg-red-100"
                                  onClick={(e) => handleQuickUnshare(e, list.id)}
                                >
                                  <Link2Off className="w-3 h-3 text-red-600" />
                                </Badge>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <p className="text-muted-foreground text-base">
              No favorite lists selected yet. Favorite a list to see yours here.
            </p>
          )}
        </div>
        )}

        {/* My Guest Access Lists Section - Lists where user has guest edit access */}
        {!searchQuery.trim() && sharedLists.length > 0 && (
        <div className="mb-6 sm:mb-8">
          <h2 className="text-base sm:text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-secondary" />
            My Guest Access Lists
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 pb-2">
            {sharedLists.map((list, index) => {
              const Icon = categoryIcons[list.category] || ListChecks;
              const itemCount = Math.max(0, list.items?.length || 0);
              const completedItems = Math.max(0, list.items?.filter(
                (item) => item.completed,
              ).length || 0);
              return (
                <Card
                  key={list.id}
                  className="hover:shadow-lg hover:bg-primary/5 transition-all cursor-pointer group relative animate-slide-up border-accent/30"
                  style={{ animationDelay: `${index * 50}ms` }}
                  onClick={() => {
                    localStorage.setItem("last_list_id", list.id);
                    navigate(`/list/${list.id}`);
                  }}
                >
                  {/* Quick Actions - shown on hover */}
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-all duration-200 flex flex-wrap gap-1.5 z-10 bg-white/95 backdrop-blur-sm rounded-lg p-1.5 shadow-lg border border-gray-100 max-w-[140px] justify-end">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 rounded-full bg-muted hover:bg-primary/10 transition-colors"
                            onClick={(e) => openEditDialog(list, e)}
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Edit</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>

                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-10 h-10 rounded-lg ${categoryColors[list.category]} flex items-center justify-center`}
                        >
                          <Icon className="w-5 h-5" />
                        </div>
                        <div>
                          <CardTitle className="text-lg flex items-center gap-2">
                            {list.title}
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Badge variant="outline" className="text-xs bg-teal-100 text-teal-700 border-teal-300">Guest (can edit)</Badge>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>You have guest access to edit this list</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </CardTitle>
                          <CardDescription>
                            {list.category} ·{" "}
                            {list.listType}
                          </CardDescription>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          {itemCount} items
                        </span>
                        <span className="text-muted-foreground">
                          {completedItems} completed
                        </span>
                      </div>
                      {itemCount > 0 && (
                        <div className="w-full bg-muted rounded-full h-1.5">
                          <div
                            className="bg-accent/100 h-1.5 rounded-full transition-all"
                            style={{
                              width: `${(completedItems / itemCount) * 100}%`,
                            }}
                          />
                        </div>
                      )}
                      <div className="flex items-center justify-between pt-2">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          <span>Updated {getTimeAgo(list.updatedAt)}{list.lastEditedByEmail && ` by ${list.lastEditedByEmail.split('@')[0]}`}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
        )}

        {/* Categories Section - Only visible in Dashboard view and not when searching */}
        {viewMode === "dashboard" && !searchQuery.trim() && (
        <div className="mb-6 sm:mb-8 mt-8">{/* Added mt-8 for vertical spacing */}
          <h2 className="text-base sm:text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <Layers className="w-5 h-5 text-primary" />
            Categories
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {dynamicCategories.filter((category) => {
              // Only show categories that have at least one list
              const stats = getCategoryStats(category);
              return stats.count > 0;
            }).map((category) => {
              const Icon = categoryIcons[category] || ListChecks;
              const stats = getCategoryStats(category);
              const descriptions: Record<string, string> = {
                Tasks: "Track your to-dos",
                Groceries: "Shopping essentials",
                Ideas: "Capture inspiration",
                Shopping: "Wishlist & purchases",
                Travel: "Trip planning",
                Work: "Professional tasks",
                Home: "Household items",
                School: "Academic & learning",
                Other: "Miscellaneous lists",
                travel: "Trip planning",
                recipes: "Recipe collection",
                shopping: "Shopping lists",
              };
              return (
                <Card
                  key={category}
                  className="hover:shadow-md transition-all cursor-pointer"
                  onClick={() => {
                    setSelectedCategoryForModal(category);
                    setCategoryModalOpen(true);
                  }}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg ${categoryColors[category] || "bg-gray-100 text-gray-600"} flex items-center justify-center`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-foreground text-sm truncate capitalize">
                          {category}
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          {stats.count} {stats.count === 1 ? "list" : "lists"}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {descriptions[category] || `${category} lists`}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
        )}
      </div>

      {/* Category Lists Modal */}
      <Dialog open={categoryModalOpen} onOpenChange={setCategoryModalOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedCategoryForModal && (
                <>
                  {(() => {
                    const Icon = categoryIcons[selectedCategoryForModal] || ListChecks;
                    return (
                      <div className={`w-8 h-8 rounded-lg ${categoryColors[selectedCategoryForModal]} flex items-center justify-center`}>
                        <Icon className="w-4 h-4" />
                      </div>
                    );
                  })()}
                  {selectedCategoryForModal} Lists
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              Click on a list to view its details
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 mt-4">
            {selectedCategoryForModal && accountFilteredLists.filter(l => l.category === selectedCategoryForModal).length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <ListChecks className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
                <p>No lists in this category yet.</p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => {
                    setCategoryModalOpen(false);
                    setIsCreateDialogOpen(true);
                  }}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create a List
                </Button>
              </div>
            ) : (
              selectedCategoryForModal && accountFilteredLists.filter(l => l.category === selectedCategoryForModal).map((list) => {
                const Icon = categoryIcons[list.category] || ListChecks;
                const itemCount = list.items?.length || 0;
                const completedItems = list.items?.filter(item => item.completed).length || 0;
                return (
                  <Card
                    key={list.id}
                    className="hover:shadow-md transition-all cursor-pointer"
                    onClick={() => {
                      setCategoryModalOpen(false);
                      localStorage.setItem("last_list_id", list.id);
                      navigate(`/list/${list.id}`);
                    }}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg ${categoryColors[list.category]} flex items-center justify-center`}>
                            <Icon className="w-5 h-5" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-foreground">{list.title}</h3>
                            <p className="text-sm text-muted-foreground">
                              {itemCount} items · {completedItems} completed
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {list.isFavorite && (
                            <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                          )}
                          {list.isGuestAccess && (
                            <Badge variant="outline" className="text-xs bg-teal-100 text-teal-700 border-teal-300">Guest (can edit)</Badge>
                          )}
                          {list.isShared && canShareLists(effectiveTier) && (
                            <Share2 className="w-4 h-4 text-primary" />
                          )}
                          <ChevronRight className="w-5 h-5 text-muted-foreground" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Create List Modal */}
      <CreateListModal 
        open={isCreateDialogOpen} 
        onOpenChange={setIsCreateDialogOpen} 
      />

      {/* Merge Lists Modal */}
      <MergeListsModal
        open={isMergeModalOpen}
        onOpenChange={(open) => {
          setIsMergeModalOpen(open);
          if (!open) setMergeSourceListId(undefined);
        }}
        initialSourceListId={mergeSourceListId}
      />

      {/* Edit List Modal */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit List</DialogTitle>
            <DialogDescription>
              Update list name, category, and type
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label>List Name</Label>
              <Input
                placeholder="e.g., Grocery Shopping"
                value={editListTitle}
                onChange={(e) => setEditListTitle(e.target.value)}
                className="mt-2"
              />
            </div>
            <div>
              <Label>Category</Label>
              <Select
                value={editListCategory}
                onValueChange={(value) => setEditListCategory(value as ListCategory)}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Tasks">Tasks</SelectItem>
                  <SelectItem value="Shopping">Shopping</SelectItem>
                  <SelectItem value="Meals">Meals</SelectItem>
                  <SelectItem value="Household">Household</SelectItem>
                  <SelectItem value="Planning">Planning</SelectItem>
                  <SelectItem value="School">School</SelectItem>
                  <SelectItem value="Work">Work</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>List Type</Label>
              <Select
                value={editListType}
                onValueChange={(value) => setEditListType(value as ListType)}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {listTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => setIsEditDialogOpen(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button onClick={handleEditList} className="flex-1">
                Save Changes
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Help Modal */}
      <Dialog open={isHelpModalOpen} onOpenChange={setIsHelpModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-primary" />
              Help & Support
            </DialogTitle>
            <DialogDescription>
              Get help with ListMine or contact our support team.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* Keyboard Shortcuts */}
            <div>
              <h4 className="font-semibold text-sm mb-3">Keyboard Shortcuts</h4>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-3">
                  <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono border border-border min-w-[32px] text-center">
                    N
                  </kbd>
                  <span className="text-muted-foreground">Create new list</span>
                </div>
                <div className="flex items-center gap-3">
                  <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono border border-border min-w-[32px] text-center">
                    /
                  </kbd>
                  <span className="text-muted-foreground">Search lists</span>
                </div>
                <div className="flex items-center gap-3">
                  <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono border border-border min-w-[32px] text-center">
                    ESC
                  </kbd>
                  <span className="text-muted-foreground">Close modal</span>
                </div>
              </div>
            </div>

            {/* Quick FAQ */}
            <div>
              <h4 className="font-semibold text-sm mb-3">Quick FAQ</h4>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="font-medium text-foreground">How do I share a list?</p>
                  <p className="text-muted-foreground">Open any list and click the Share button to generate a shareable link or invite collaborators.</p>
                </div>
                <div>
                  <p className="font-medium text-foreground">How do I upgrade my plan?</p>
                  <p className="text-muted-foreground">Click the "Upgrade" button in the header or visit the Pricing page to see available plans.</p>
                </div>
                <div>
                  <p className="font-medium text-foreground">Can I import existing lists?</p>
                  <p className="text-muted-foreground">Yes! Use the Import/Export feature to import lists from CSV or TXT files.</p>
                </div>
              </div>
            </div>

            {/* Contact Support */}
            <div className="border-t pt-4">
              <h4 className="font-semibold text-sm mb-3">Need More Help?</h4>
              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => window.open('https://listmine.com/how-it-works', '_blank')}
                >
                  <FileText className="w-4 h-4 mr-2" />
                  How It Works
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => window.location.href = 'mailto:support@listmine.com'}
                >
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Contact Support
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Footer */}
      <footer className="bg-white border-t border-border mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <img 
                src="/assets/listmine-icon.png" 
                alt="ListMine" 
                className="h-6 w-6"
              />
              <p className="text-sm text-muted-foreground">
                © 2025 ListMine. Organize your life, one list at a time.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-4 text-sm">
              <a
                href="https://listmine.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-primary underline"
              >
                About ListMine
              </a>
              <button
                onClick={() => navigate('/upgrade', { state: { from: location.pathname } })}
                className="text-muted-foreground hover:text-primary underline"
              >
                Pricing
              </button>
              <a
                href="https://listmine.com/how-it-works"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-primary underline"
              >
                How It Works
              </a>
              <a
                href="mailto:support@listmine.com"
                className="text-muted-foreground hover:text-primary underline"
              >
                Contact Support
              </a>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <a
                      href="https://forms.gle/9uQRYmrC8qC38Raj9"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 bg-primary text-white px-3 py-1.5 rounded-full text-sm font-medium hover:bg-primary/90 transition-colors"
                    >
                      <MessageSquare className="w-4 h-4" />
                      Beta Feedback
                    </a>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Help us improve! Share your feedback or report bugs here.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        </div>
      </footer>

      {/* Share Settings Modal */}
      {shareListId && (() => {
        const shareList = lists.find(l => l.id === shareListId);
        if (!shareList) return null;
        return (
          <ShareSettingsModal
            open={isShareDialogOpen}
            onOpenChange={(open) => {
              setIsShareDialogOpen(open);
              if (!open) setShareListId(null);
            }}
            list={{
              id: shareList.id,
              title: shareList.title,
              isShared: shareList.isShared,
              shareLink: shareList.shareLink,
              shareMode: shareList.shareMode,
              listType: shareList.listType,
            }}
            onGenerateLink={(shareMode) => generateShareLink(shareList.id, shareMode)}
            onUpdateShareMode={(shareMode) => updateShareMode(shareList.id, shareMode)}
            onUnshare={() => unshareList(shareList.id)}
          />
        );
      })()}

      {/* Team Management Modal */}
      {isTeamManagementOpen && currentAccount?.type === 'team' && (
        <Dialog open={isTeamManagementOpen} onOpenChange={setIsTeamManagementOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <TeamManagement onClose={() => setIsTeamManagementOpen(false)} />
          </DialogContent>
        </Dialog>
      )}
      
      {/* Guest Management Modal */}
      {isGuestManagementOpen && selectedListForGuests && (
        <Dialog open={isGuestManagementOpen} onOpenChange={(open) => {
          setIsGuestManagementOpen(open);
          if (!open) setSelectedListForGuests(null);
        }}>
          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                Manage Guests
              </DialogTitle>
            </DialogHeader>
            <GuestManagement
              listId={selectedListForGuests}
              listOwnerId={user?.id || ''}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}