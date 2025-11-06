import { FirebaseTest } from "@/components/FirebaseTest";
import {
  CheckSquare,
  Plus,
  Trash2,
  Share2,
  Settings,
  FileText,
  Search,
  X,
  Pin,
  Download,
  Users,
  Tag,
  MoreVertical,
  Edit,
  ListChecks,
  AlertCircle,
  Loader2,
  ClipboardList,
  Crown,
  HelpCircle,
  Menu,
  Filter,
  Clock,
  Package,
  Upload,
  User,
  LogOut,
  ShoppingCart,
  Lightbulb,
  Plane,
} from "lucide-react";

import { useState } from "react";
import { useLists } from "@/contexts/useListsHook";
import { useAuth } from "@/contexts/useAuthHook";
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
import { useNavigate } from "react-router-dom";
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
import {
  validateListName,
  validateCategory,
  checkListLimit,
} from "@/lib/validation";
import CreateListModal from "@/components/list/CreateListModal";

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

const categoryColors: Record<string, string> = {
  Tasks: "bg-blue-100 text-blue-700 border-blue-200",
  Groceries: "bg-green-100 text-green-700 border-green-200",
  Ideas: "bg-yellow-100 text-yellow-700 border-yellow-200",
  Shopping: "bg-purple-100 text-purple-700 border-purple-200",
  Travel: "bg-orange-100 text-orange-700 border-orange-200",
  Work: "bg-indigo-100 text-indigo-700 border-indigo-200",
  Home: "bg-pink-100 text-pink-700 border-pink-200",
  Other: "bg-gray-100 text-gray-700 border-gray-200",
};

const listTypes: { value: ListType; label: string }[] = [
  { value: "task-list", label: "Task List" },
  { value: "todo-list", label: "To-Do List" },
  { value: "registry-list", label: "Registry List" },
  { value: "checklist", label: "Checklist" },
  { value: "grocery-list", label: "Grocery List" },
  { value: "shopping-list", label: "Wishlist" },
  { value: "idea-list", label: "Idea List" },
  { value: "multi-topic", label: "Multi-Topic" },
  { value: "compare-contrast", label: "Compare & Contrast" },
  { value: "pro-con", label: "Pro/Con List" },
  { value: "multi-option", label: "Multi-Option" },
  { value: "custom", label: "Custom" },
];

export default function Dashboard() {
  const {
    lists,
    addList,
    togglePin,
    searchLists,
    filterLists,
    deleteList,
    exportList,
    generateShareLink,
    loading,
    error,
    retryLoad,
  } = useLists();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [newListTitle, setNewListTitle] = useState("");
  const [newListCategory, setNewListCategory] = useState<ListCategory>("Tasks");
  const [newListType, setNewListType] = useState<ListType>("custom");
  const [selectedCategory, setSelectedCategory] = useState<
    ListCategory | "All"
  >("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<ListType | "all">("all");
  const [isLoading, setIsLoading] = useState(true);
  const [listSortBy, setListSortBy] = useState<
    "recent" | "name" | "items" | "completion"
  >(() => {
    return (localStorage.getItem("listSortBy") as any) || "recent";
  });
  const [showCompleted, setShowCompleted] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [dueDateFilter, setDueDateFilter] = useState<
    "all" | "today" | "week" | "overdue"
  >("all");
  const [priorityFilter, setPriorityFilter] = useState<
    "all" | "high" | "medium" | "low"
  >("all");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Simulate loading on mount
  useState(() => {
    setTimeout(() => setIsLoading(false), 500);
  });

  // Keyboard shortcuts
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

    // Check list limit
    if (user) {
      const limitCheck = checkListLimit(lists.length, user.listLimit);
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
        title: "✅ List created successfully!",
        description: `${nameValidation.value} has been added to your lists`,
        className: "bg-green-50 border-green-200",
      });
    } catch (error: any) {
      toast({
        title: "❌ Failed to create list",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleListSortChange = (value: string) => {
    setListSortBy(value as any);
    localStorage.setItem("listSortBy", value);
  };

  const getActiveFilterCount = () => {
    let count = 0;
    if (!showCompleted) count++;
    if (showArchived) count++;
    if (dueDateFilter !== "all") count++;
    if (priorityFilter !== "all") count++;
    return count;
  };

  const getTimeAgo = (date: Date) => {
    return formatDistanceToNow(date, { addSuffix: true });
  };

  const getDueToday = (list: any) => {
    return list.items.filter(
      (item: any) =>
        item.dueDate && isToday(new Date(item.dueDate)) && !item.completed,
    ).length;
  };

  const handleQuickShare = async (e: React.MouseEvent, listId: string) => {
    e.stopPropagation();
    try {
      const link = await generateShareLink(listId);
      navigator.clipboard.writeText(link);
      toast({
        title: "✅ Share link copied!",
        description: "Link copied to clipboard",
        className: "bg-blue-50 border-blue-200",
      });
    } catch (error: any) {
      toast({
        title: "❌ Failed to generate share link",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleQuickExport = (e: React.MouseEvent, listId: string) => {
    e.stopPropagation();
    try {
      exportList(listId, "csv");
      toast({
        title: "✅ List exported!",
        description: "CSV file downloaded successfully",
        className: "bg-green-50 border-green-200",
      });
    } catch (error: any) {
      toast({
        title: "❌ Export failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleQuickDelete = (e: React.MouseEvent, listId: string) => {
    e.stopPropagation();
  };

  const getUsagePercentage = () => {
    if (!user || user.listLimit === -1) return 0;
    return (lists.length / user.listLimit) * 100;
  };

  const getRemainingLists = () => {
    if (!user || user.listLimit === -1) return "Unlimited";
    return user.listLimit - lists.length;
  };

  const getTierName = (tier: string) => {
    switch (tier) {
      case "free":
        return "Free";
      case "good":
        return "Good";
      case "even-better":
        return "Even Better";
      case "lots-more":
        return "Lots More";
      default:
        return "Free";
    }
  };

  const categories: (ListCategory | "All")[] = [
    "All",
    "Tasks",
    "Groceries",
    "Ideas",
    "Shopping",
    "Travel",
    "Work",
    "Home",
    "Other",
  ];

  let displayLists = lists;

  // Apply search
  if (searchQuery.trim()) {
    displayLists = searchLists(searchQuery);
  }

  // Apply category filter
  if (selectedCategory !== "All") {
    displayLists = displayLists.filter(
      (list) => list.category === selectedCategory,
    );
  }

  // Apply type filter
  if (filterType !== "all") {
    displayLists = displayLists.filter((list) => list.listType === filterType);
  }

  // Apply sorting
  displayLists = [...displayLists].sort((a, b) => {
    switch (listSortBy) {
      case "name":
        return a.title.localeCompare(b.title);
      case "items":
        return b.items.length - a.items.length;
      case "completion":
        const aCompletion =
          a.items.length > 0
            ? a.items.filter((i) => i.completed).length / a.items.length
            : 0;
        const bCompletion =
          b.items.length > 0
            ? b.items.filter((i) => i.completed).length / b.items.length
            : 0;
        return bCompletion - aCompletion;
      case "recent":
      default:
        return b.updatedAt.getTime() - a.updatedAt.getTime();
    }
  });

  const pinnedLists = displayLists.filter((list) => list.isPinned);
  const unpinnedLists = displayLists.filter((list) => !list.isPinned);

  const getCategoryStats = (category: ListCategory) => {
    const categoryLists = lists.filter((list) => list.category === category);
    const totalItems = categoryLists.reduce(
      (sum, list) => sum + list.items.length,
      0,
    );
    return { count: categoryLists.length, items: totalItems };
  };

  // Show error state if loading failed
  if (error && !loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Couldn't Load Lists
          </h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <Button onClick={retryLoad} className="w-full">
            <Loader2 className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-4" />
          <p className="text-gray-600 text-lg">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Limit Reached Modal */}
      <AlertDialog open={showLimitModal} onOpenChange={setShowLimitModal}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>List Limit Reached</AlertDialogTitle>
            <AlertDialogDescription>
              You've reached your list limit of {user?.listLimit} lists on the{" "}
              {getTierName(user?.tier || "free")} tier. Upgrade to create more
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
              className="bg-yellow-500 hover:bg-yellow-600"
            >
              Upgrade Now
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
                <ListChecks className="w-6 h-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
                  ListMine
                </h1>
                <p className="text-xs sm:text-sm text-gray-600 hidden sm:block">
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
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700"
                    >
                      <HelpCircle className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent
                    side="bottom"
                    className="bg-white text-gray-900 shadow-lg border border-gray-200 p-3"
                    sideOffset={8}
                  >
                    <div className="space-y-2 text-sm">
                      <p className="font-semibold mb-2">Keyboard Shortcuts</p>
                      <div className="space-y-1.5">
                        <p className="flex items-center gap-2">
                          <kbd className="px-2 py-1 bg-gray-100 rounded text-xs font-mono border border-gray-300">
                            N
                          </kbd>
                          <span>Create new list</span>
                        </p>
                        <p className="flex items-center gap-2">
                          <kbd className="px-2 py-1 bg-gray-100 rounded text-xs font-mono border border-gray-300">
                            /
                          </kbd>
                          <span>Search lists</span>
                        </p>
                        <p className="flex items-center gap-2">
                          <kbd className="px-2 py-1 bg-gray-100 rounded text-xs font-mono border border-gray-300">
                            ESC
                          </kbd>
                          <span>Close modal</span>
                        </p>
                      </div>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              {user?.tier === "free" && (
                <Button
                  onClick={() => navigate("/upgrade")}
                  variant="outline"
                  size="sm"
                  className="border-yellow-400 text-yellow-700 min-h-[44px]"
                >
                  <Crown className="w-4 h-4 mr-2" />
                  Upgrade
                </Button>
              )}
              <Button
                onClick={() => navigate("/import-export")}
                variant="outline"
                size="sm"
                className="min-h-[44px]"
              >
                <Upload className="w-4 h-4 mr-2" />
                Import/Export
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="min-h-[44px] min-w-[44px]"
                  >
                    <User className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => navigate("/profile")}>
                    <User className="w-4 h-4 mr-2" />
                    Profile
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={logout}>
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
                    <p className="text-sm text-gray-600 mb-1">Signed in as</p>
                    <p className="font-semibold">{user?.name}</p>
                    {user?.tier === "premium" && (
                      <Badge variant="secondary" className="mt-2">
                        <Crown className="w-3 h-3 mr-1" />
                        Premium
                      </Badge>
                    )}
                  </div>
                  {user?.tier === "free" && (
                    <Button
                      onClick={() => {
                        navigate("/upgrade");
                        setIsMobileMenuOpen(false);
                      }}
                      variant="outline"
                      className="w-full justify-start border-yellow-400 text-yellow-700 min-h-[44px]"
                    >
                      <Crown className="w-4 h-4 mr-2" />
                      Upgrade to Premium
                    </Button>
                  )}
                  <Button
                    onClick={() => {
                      navigate("/import-export");
                      setIsMobileMenuOpen(false);
                    }}
                    variant="outline"
                    className="w-full justify-start min-h-[44px]"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Import/Export
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
                  <Button
                    onClick={() => {
                      logout();
                      setIsMobileMenuOpen(false);
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
        {/* Usage Stats */}
        <div className="mb-4 sm:mb-6 bg-white rounded-lg border border-gray-200 p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-8 w-full sm:w-auto">
              <div className="w-full sm:w-auto">
                <div className="flex items-center gap-2 mb-1">
                  <FileText className="w-5 h-5 text-blue-600" />
                  <p className="text-sm text-gray-600">Lists</p>
                  {user?.listLimit !== -1 && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="w-4 h-4 text-gray-400 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="max-w-xs">
                            You're using {lists.length} of your{" "}
                            {user?.listLimit} lists on the{" "}
                            {getTierName(user?.tier || "free")} tier. Upgrade
                            for more lists.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>
                <p className="text-2xl sm:text-3xl font-bold text-blue-600">
                  {lists.length}{" "}
                  {user?.listLimit !== -1 && (
                    <span className="text-lg sm:text-xl text-gray-400">
                      / {user?.listLimit}
                    </span>
                  )}
                  {user?.listLimit === -1 && (
                    <span className="text-lg sm:text-xl text-gray-400">
                      Unlimited
                    </span>
                  )}
                </p>
                {user?.listLimit !== -1 && (
                  <>
                    <div className="w-full sm:w-48 bg-gray-200 rounded-full h-2 mt-2">
                      <div
                        className={`h-2 rounded-full transition-all ${
                          getUsagePercentage() >= 80
                            ? "bg-orange-500"
                            : "bg-blue-600"
                        }`}
                        style={{ width: `${getUsagePercentage()}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {getRemainingLists()} lists remaining
                    </p>
                  </>
                )}
              </div>
              <div className="hidden sm:block h-16 w-px bg-gray-200" />
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Package className="w-5 h-5 text-green-600" />
                  <p className="text-sm text-gray-600">Total Items</p>
                </div>
                <p className="text-2xl sm:text-3xl font-bold text-green-600">
                  {lists.reduce((sum, list) => sum + list.items.length, 0)}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {user?.itemsPerListLimit === -1
                    ? "Unlimited"
                    : `${user?.itemsPerListLimit} per list`}
                </p>
              </div>
            </div>
            {user?.listLimit !== -1 && getUsagePercentage() >= 80 && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge
                      variant="outline"
                      className="bg-orange-50 text-orange-700 border-orange-300"
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
        </div>

        {/* Search and Filters */}
        <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input
              ref={searchInputRef}
              placeholder="Search lists and items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-12 pr-10 h-12 text-base"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 transform -translate-y-1/2 h-10 w-10"
                onClick={() => setSearchQuery("")}
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
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
                        Show archived lists
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
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Action Bar with Category Pills */}
        <div className="flex flex-col gap-4 mb-6">
          {/* Top Row: Sort and Create Button */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Select value={listSortBy} onValueChange={handleListSortChange}>
                <SelectTrigger className="w-[180px] h-[44px]">
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
            <Button 
              className="w-full sm:w-auto min-h-[44px]"
              onClick={() => setIsCreateDialogOpen(true)}
            >
              <Plus className="w-4 h-4 mr-2" />
              New List
            </Button>
          </div>

          {/* Category Pills - Horizontal Row */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
            <Button
              variant={selectedCategory === "All" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory("All")}
              className="min-h-[36px] whitespace-nowrap"
            >
              All
            </Button>
            {(categories.filter((c) => c !== "All") as ListCategory[]).map(
              (category) => {
                const Icon = categoryIcons[category] || ListChecks;
                const stats = getCategoryStats(category);
                return (
                  <Button
                    key={category}
                    variant={selectedCategory === category ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedCategory(category)}
                    className={`min-h-[36px] whitespace-nowrap ${
                      selectedCategory === category 
                        ? "" 
                        : categoryColors[category]
                    }`}
                  >
                    <Icon className="w-4 h-4 mr-1.5" />
                    {category}
                    {stats.count > 0 && (
                      <span className="ml-1.5 h-5 px-1.5 text-xs bg-secondary text-secondary-foreground rounded-md inline-flex items-center">
                        {stats.count}
                      </span>
                    )}
                  </Button>
                );
              }
            )}
          </div>
        </div>

        {/* Pinned Lists */}
        {pinnedLists.length > 0 && (
          <div className="mb-6 sm:mb-8">
            <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Pin className="w-5 h-5" />
              Pinned Lists
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {pinnedLists.map((list) => {
                const Icon = categoryIcons[list.category] || ListChecks;
                const completedItems = list.items.filter(
                  (item) => item.completed,
                ).length;
                const dueToday = getDueToday(list);
                return (
                  <Card
                    key={list.id}
                    className="hover:shadow-lg hover:bg-gray-50 transition-all cursor-pointer group relative"
                    onClick={() => navigate(`/list/${list.id}`)}
                  >
                    {/* Quick Actions */}
                    <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 z-10">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 rounded-full bg-gray-100 hover:bg-gray-200"
                              onClick={(e) => handleQuickShare(e, list.id)}
                            >
                              <Share2 className="w-4 h-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Share</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 rounded-full bg-gray-100 hover:bg-gray-200"
                              onClick={(e) => handleQuickExport(e, list.id)}
                            >
                              <Download className="w-4 h-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Export</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <AlertDialog>
                        <TooltipProvider>
                          <Tooltip>
                            <AlertDialogTrigger asChild>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 rounded-full bg-gray-100 hover:bg-red-100"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Trash2 className="w-4 h-4 text-red-600" />
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
                              This will permanently delete "{list.title}" and
                              all its items.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => {
                                deleteList(list.id);
                                toast({
                                  title: "List deleted",
                                  description: "The list has been removed",
                                });
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
                            <CardTitle className="text-lg">
                              {list.title}
                            </CardTitle>
                            <CardDescription>
                              {list.category} ·{" "}
                              {
                                listTypes.find((t) => t.value === list.listType)
                                  ?.label
                              }
                            </CardDescription>
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">
                            {list.items.length} items
                          </span>
                          <span className="text-gray-600">
                            {completedItems} completed
                          </span>
                        </div>
                        {list.items.length > 0 && (
                          <div className="w-full bg-gray-200 rounded-full h-1.5">
                            <div
                              className="bg-primary h-1.5 rounded-full transition-all"
                              style={{
                                width: `${(completedItems / list.items.length) * 100}%`,
                              }}
                            />
                          </div>
                        )}
                        <div className="flex items-center justify-between pt-2">
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <Clock className="w-3 h-3" />
                            <span>Updated {getTimeAgo(list.updatedAt)}</span>
                          </div>
                          <div className="flex gap-1">
                            {dueToday > 0 && (
                              <Badge
                                variant="outline"
                                className="bg-orange-50 text-orange-700 border-orange-200 text-xs"
                              >
                                <AlertCircle className="w-3 h-3 mr-1" />
                                {dueToday} due today
                              </Badge>
                            )}
                            {list.isShared && (
                              <Badge
                                variant="outline"
                                className="bg-blue-50 text-blue-700 border-blue-200 text-xs"
                              >
                                <Share2 className="w-3 h-3 mr-1" />
                                Shared
                              </Badge>
                            )}
                          </div>
                        </div>
                        {list.tags && list.tags.length > 0 && (
                          <div className="flex gap-1 flex-wrap mt-2">
                            {list.tags.map((tag) => (
                              <Badge
                                key={tag}
                                variant="outline"
                                className="text-xs"
                              >
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* All Lists */}
        <div>
          <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-4">
            {selectedCategory === "All"
              ? "All Lists"
              : `${selectedCategory} Lists`}
          </h2>
          {unpinnedLists.length === 0 ? (
            <Card className="p-8 sm:p-16 text-center bg-gradient-to-br from-gray-50 to-white">
              <div className="max-w-md mx-auto">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <ListChecks className="w-8 h-8 text-blue-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  {searchQuery
                    ? "No results found"
                    : selectedCategory === "All"
                      ? "No lists yet"
                      : `No ${selectedCategory} lists`}
                </h3>
                <p className="text-gray-600 mb-6">
                  {searchQuery
                    ? "No results found. Try a different search term or create a new list."
                    : "You don't have any lists yet. Click 'New List' to create your first one!"}
                </p>
                {!searchQuery && (
                  <Button
                    onClick={() => setIsCreateDialogOpen(true)}
                    size="lg"
                    className="min-h-[44px]"
                  >
                    <Plus className="w-5 h-5 mr-2" />
                    Create Your First List
                  </Button>
                )}
              </div>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {unpinnedLists.map((list) => {
                const Icon = categoryIcons[list.category] || ListChecks;
                const completedItems = list.items.filter(
                  (item) => item.completed,
                ).length;
                const dueToday = getDueToday(list);
                return (
                  <Card
                    key={list.id}
                    className="hover:shadow-lg hover:bg-gray-50 transition-all cursor-pointer group relative"
                    onClick={() => navigate(`/list/${list.id}`)}
                  >
                    {/* Quick Actions - same as pinned lists */}
                    <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 z-10">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 rounded-full bg-gray-100 hover:bg-gray-200"
                              onClick={(e) => handleQuickShare(e, list.id)}
                            >
                              <Share2 className="w-4 h-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Share</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 rounded-full bg-gray-100 hover:bg-gray-200"
                              onClick={(e) => handleQuickExport(e, list.id)}
                            >
                              <Download className="w-4 h-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Export</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <AlertDialog>
                        <TooltipProvider>
                          <Tooltip>
                            <AlertDialogTrigger asChild>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 rounded-full bg-gray-100 hover:bg-red-100"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Trash2 className="w-4 h-4 text-red-600" />
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
                              This will permanently delete "{list.title}" and
                              all its items.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => {
                                deleteList(list.id);
                                toast({
                                  title: "List deleted",
                                  description: "The list has been removed",
                                });
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
                            <CardTitle className="text-lg">
                              {list.title}
                            </CardTitle>
                            <CardDescription>
                              {list.category} ·{" "}
                              {
                                listTypes.find((t) => t.value === list.listType)
                                  ?.label
                              }
                            </CardDescription>
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">
                            {list.items.length} items
                          </span>
                          <span className="text-gray-600">
                            {completedItems} completed
                          </span>
                        </div>
                        {list.items.length > 0 && (
                          <div className="w-full bg-gray-200 rounded-full h-1.5">
                            <div
                              className="bg-primary h-1.5 rounded-full transition-all"
                              style={{
                                width: `${(completedItems / list.items.length) * 100}%`,
                              }}
                            />
                          </div>
                        )}
                        <div className="flex items-center justify-between pt-2">
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <Clock className="w-3 h-3" />
                            <span>Updated {getTimeAgo(list.updatedAt)}</span>
                          </div>
                          <div className="flex gap-1">
                            {dueToday > 0 && (
                              <Badge
                                variant="outline"
                                className="bg-orange-50 text-orange-700 border-orange-200 text-xs"
                              >
                                <AlertCircle className="w-3 h-3 mr-1" />
                                {dueToday} due today
                              </Badge>
                            )}
                            {list.isShared && (
                              <Badge
                                variant="outline"
                                className="bg-blue-50 text-blue-700 border-blue-200 text-xs"
                              >
                                <Share2 className="w-3 h-3 mr-1" />
                                Shared
                              </Badge>
                            )}
                          </div>
                        </div>
                        {list.tags && list.tags.length > 0 && (
                          <div className="flex gap-1 flex-wrap mt-2">
                            {list.tags.map((tag) => (
                              <Badge
                                key={tag}
                                variant="outline"
                                className="text-xs"
                              >
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Create List Modal */}
      <CreateListModal 
        open={isCreateDialogOpen} 
        onOpenChange={setIsCreateDialogOpen} 
      />
    </div>
  );
}