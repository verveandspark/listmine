import { ListDetailSkeleton } from "@/components/ui/DashboardSkeleton";
import { useOpenGraphPreview } from "@/hooks/useOpenGraphPreview";
import { LinkPreviewCard } from "@/components/list/LinkPreviewCard";
import { ListSidebar } from "./ListSidebar";
import PurchaseHistoryModal from "./PurchaseHistoryModal";
import GuestManagement from "./GuestManagement";
import TeamManagement from "@/components/team/TeamManagement";
import UpdateFromRetailerModal from "./UpdateFromRetailerModal";
import MergeListsModal from "./MergeListsModal";
import { useState, useMemo, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useLists } from "@/contexts/useListsHook";
import { useAuth } from "@/contexts/useAuthHook";
import { useAccount } from "@/contexts/AccountContext";
import { useUndoAction } from "@/hooks/useUndoAction";
import { ListItem as ListItemType, ListCategory, ListType, canEditListMeta, canEditItems, canManageSharing } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
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
  ChevronRight,
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
  MessageSquare,
  User as UserIcon,
  GripVertical,
  Tag,
  ExternalLink,
  Flag,
  Link as LinkIcon,
  Link2Off,
  Printer,
  Users,
  Star,
  LayoutDashboard,
  List as ListIcon,
  RefreshCw,
  Merge,
  Archive,
  ArchiveRestore,
  Copy,
  Info,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { format } from "date-fns";
import { isToday, isPast, isFuture } from "date-fns";
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
import { useToast } from "@/components/ui/use-toast";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  validateItemName,
  validateQuantity,
  validateNotes,
  validateAssignedTo,
  validateDueDate,
  checkItemLimit,
  validateEmail,
  validateTag,
  validateListName,
  validateCategory,
} from "@/lib/validation";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/lib/supabase";
import { canInviteGuests, canHaveTeamMembers, canShareLists, canExportLists, getAvailableExportFormats, type UserTier } from "@/lib/tierUtils";
import ShareSettingsModal from "./ShareSettingsModal";

import { normalizeListType } from "@/lib/normalizeListType";

// Check if listType is a registry or wishlist (for purchaser UI)
// Uses normalizeListType output values (lowercase keys)
const isRegistryOrWishlist = (listType: string | undefined): boolean => {
  const normalized = normalizeListType(listType);
  return normalized === "registry" || normalized === "wishlist";
};

// Helper function to check if an item is unavailable
const isItemUnavailable = (item: ListItemType): boolean => {
  // Check for new is_unavailable column (boolean)
  if ((item as any).is_unavailable === true) return true;
  
  // Check Target format: attributes.custom.is_unavailable (boolean)
  if (item.attributes?.custom?.is_unavailable === true) return true;
  
  // Check MyRegistry/BB&B format: attributes.custom.availability (string)
  if (item.attributes?.custom?.availability === 'unavailable') return true;
  
  return false;
};

export default function ListDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    lists,
    addItemToList,
    updateListItem,
    deleteListItem,
    bulkDeleteItems,
    bulkUpdateItems,
    reorderListItems,
    deleteList,
    exportList,
    generateShareLink,
    updateShareMode,
    unshareList,
    addCollaborator,
    addTagToList,
    removeTagFromList,
    updateList,
    hasLoadedOnce,
    restoreList,
    restoreListItem,
    restoreBulkItems,
    refreshLists,
    unarchiveList,
    toggleFavorite,
  } = useLists();
  const { toast } = useToast();
  const { executeWithUndo } = useUndoAction();

  // Log list load attempt
  console.log("[LIST_LOAD_START]", { listId: id });
  
  const list = lists.find((l) => l.id === id);
  
  // Compute effective list type from DB field (list_type) with fallback to listType
  // Use lowercase comparison for registry/wishlist checks
  const effectiveListType = normalizeListType((list as any)?.list_type ?? list?.listType);
  
  // Log list load result (avoid referencing variables declared later)
  console.log("[LIST_LOAD_RESULT]", { 
    listId: id, 
    hasData: !!list, 
    listsCount: lists.length,
    effectiveListType 
  });
  
  // Use global account context
  const { effectiveTier: accountEffectiveTier, isTeamContext: globalIsTeamContext } = useAccount();
  
  // Determine effective tier for gating: team lists always use 'lots_more'
  // Check multiple indicators that this is a team list
  const isTeamContext = globalIsTeamContext || !!list?.accountId || !!list?.isTeamMember || !!list?.isTeamOwner;
  const effectiveTier = (isTeamContext ? 'lots_more' : accountEffectiveTier) as UserTier;
  
  // Track attempts independent of hasLoadedOnce
  const [attempts, setAttempts] = useState(0);
  const [retrying, setRetrying] = useState(false);
  const maxAttempts = 3;
  const retryDelay = 250;
  
  // Retry fetching the list if not found (handles race condition with newly created lists)
  useEffect(() => {
    if (!list && id && attempts < maxAttempts && !retrying) {
      setRetrying(true);
      const timer = setTimeout(async () => {
        setAttempts(prev => prev + 1);
        await refreshLists();
        setRetrying(false);
      }, retryDelay);
      return () => clearTimeout(timer);
    }
  }, [list, id, attempts, retrying, refreshLists]);
  
  // Reset attempts when id changes
  useEffect(() => {
    setAttempts(0);
    setRetrying(false);
  }, [id]);
  
  // Permission checks for guest access (only compute if list exists)
  const isOwner = list ? canEditListMeta(list, user?.id) : false;
  const canEditListItems = list ? canEditItems(list, user?.id) : false;
  const canShare = list ? canManageSharing(list, user?.id) : false;
  
  // Check if list is sectioned (has items with section attribute)
  const isSectioned = useMemo(() => {
    if (!list?.items) return false;
    return list.items.some(item => item.attributes?.section && item.attributes.section.trim() !== '');
  }, [list?.items]);
  
  // Check if list is categorized (grocery lists use category attribute)
  const isCategorized = useMemo(() => {
    if (!list?.items) return false;
    return list.items.some(item => {
      const cat = item.attributes?.category || item.attributes?.section;
      return cat && cat.trim() !== '';
    });
  }, [list?.items]);
  
  // Get available sections for sectioned lists
  const availableSections = useMemo(() => {
    if (!list?.items) return ['OTHER'];
    const sectionsSet = new Set<string>();
    list.items.forEach(item => {
      if (item.attributes?.section && item.attributes.section.trim() !== '') {
        sectionsSet.add(item.attributes.section.trim());
      }
    });
    // Keep 'Extras' only if it already exists (backward compatibility), otherwise use 'OTHER'
    if (!sectionsSet.has('Extras')) {
      sectionsSet.add('OTHER');
    }
    return Array.from(sectionsSet).sort();
  }, [list?.items]);
  
  // Get available categories for grocery lists (use category, fallback to section for older rows)
  const availableCategories = useMemo(() => {
    if (!list?.items) return ['Other'];
    const categoriesSet = new Set<string>();
    list.items.forEach(item => {
      const cat = item.attributes?.category || item.attributes?.section;
      if (cat && cat.trim() !== '') {
        categoriesSet.add(cat.trim());
      }
    });
    // Always ensure 'Other' is available
    categoriesSet.add('Other');
    return Array.from(categoriesSet).sort();
  }, [list?.items]);
  
  // Save last opened list ID for "List View" toggle
  if (id) {
    localStorage.setItem("last_list_id", id);
  }
  
  // Safe list type checks using effectiveListType (lowercase keys)
  const isTodo = effectiveListType === 'todo';
  const isIdea = effectiveListType === 'idea';
  const isRegistry = effectiveListType === 'registry';
  const isWishlist = effectiveListType === 'wishlist';
  const isRegistryOrWishlistType = isRegistry || isWishlist;
  const isGrocery = effectiveListType === 'grocery';
  const isShoppingList = effectiveListType === 'shopping';
  
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [newItemText, setNewItemText] = useState("");
  const [newItemQuantity, setNewItemQuantity] = useState<number | undefined>();
  const [newItemPriority, setNewItemPriority] = useState<
    "low" | "medium" | "high" | undefined
  >();
  const [newItemDueDate, setNewItemDueDate] = useState<Date | undefined>();
  const [newItemNotes, setNewItemNotes] = useState("");
  const [newItemAssignedTo, setNewItemAssignedTo] = useState("");
  const [newItemLinks, setNewItemLinks] = useState<string[]>([]);
  const [newLinkInput, setNewLinkInput] = useState("");
  
  // Type-specific fields
  const [newItemCategory, setNewItemCategory] = useState<string | undefined>();
  const [newItemUnit, setNewItemUnit] = useState<string | undefined>();
  const [newItemPrice, setNewItemPrice] = useState<number | undefined>();
  const [newItemStatus, setNewItemStatus] = useState<string | undefined>();
  const [newItemQuantityNeeded, setNewItemQuantityNeeded] = useState<number | undefined>();
  const [newItemQuantityPurchased, setNewItemQuantityPurchased] = useState<number | undefined>();
  const [newItemProductLink, setNewItemProductLink] = useState<string>("");
  
  // Manual link preview fields
  const [newItemLinkTitle, setNewItemLinkTitle] = useState<string>("");
  const [newItemLinkDescription, setNewItemLinkDescription] = useState<string>("");
  const [newItemLinkImage, setNewItemLinkImage] = useState<string>("");
  
  const [isDetailedMode, setIsDetailedMode] = useState(() => {
    const savedMode = localStorage.getItem("itemEntryMode");
    return savedMode === "detailed";
  });

  const [editingItem, setEditingItem] = useState<ListItemType | null>(null);
  // Track the original links when edit modal opens (to detect if links field was touched)
  const [originalItemLinks, setOriginalItemLinks] = useState<string[] | null>(null);
  // Track if the Product Link field was explicitly edited
  const [linkFieldTouched, setLinkFieldTouched] = useState(false);
  // Separate boolean to persist modal open state across item refreshes
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  // Separate state for due date input string (to avoid type mismatch with Date)
  const [dueDateInput, setDueDateInput] = useState<string>('');

  // Link preview for new items
  const { previewData, loading: previewLoading, error: previewError, fetchPreview } = useOpenGraphPreview();
  const [showNewItemPreview, setShowNewItemPreview] = useState(false);

  const [draggedItem, setDraggedItem] = useState<ListItemType | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [dropPosition, setDropPosition] = useState<"before" | "after" | null>(null);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [collaboratorEmail, setCollaboratorEmail] = useState("");
  const [newTag, setNewTag] = useState("");
  const [newLink, setNewLink] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [itemSortBy, setItemSortBy] = useState<
    "manual" | "priority" | "dueDate" | "alphabetical"
  >(() => {
    return (localStorage.getItem("itemSortBy") as any) || "manual";
  });
  const [showItemLimitError, setShowItemLimitError] = useState(false);
  const [detailedMode, setDetailedMode] = useState(false);
  const [itemLimitReached, setItemLimitReached] = useState(false);
  
  // Edit list state
  const [isEditListDialogOpen, setIsEditListDialogOpen] = useState(false);
  const [editListTitle, setEditListTitle] = useState("");
  const [editListCategory, setEditListCategory] = useState<string>("");
  const [editListType, setEditListType] = useState<string>("");
  const [isPurchaseHistoryOpen, setIsPurchaseHistoryOpen] = useState(false);
  const [isGuestManagementOpen, setIsGuestManagementOpen] = useState(false);
  const [isTeamManagementOpen, setIsTeamManagementOpen] = useState(false);
  const [isShareSettingsOpen, setIsShareSettingsOpen] = useState(false);
  const [isUpdateFromRetailerOpen, setIsUpdateFromRetailerOpen] = useState(false);
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
  
  // Tags section collapsed state
  const [isTagsSectionOpen, setIsTagsSectionOpen] = useState(false);
  
  // Help modal state
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  
  // Section state for sectioned lists (todo/idea)
  const [newItemSection, setNewItemSection] = useState<string>("");
  
  // Category state for grocery lists
  const [newItemGroceryCategory, setNewItemGroceryCategory] = useState<string>("");
  
  // Initialize section from localStorage when list changes (or default to first section)
  useEffect(() => {
    if (list?.id && isSectioned) {
      const savedSection = localStorage.getItem(`listmine:lastSection:${list.id}`);
      // Use saved section if it exists in available sections, otherwise use first available
      if (savedSection && availableSections.includes(savedSection)) {
        setNewItemSection(savedSection);
      } else {
        setNewItemSection(availableSections[0] || 'OTHER');
      }
    }
  }, [list?.id, isSectioned, availableSections]);
  
  // Initialize category from localStorage for grocery lists
  useEffect(() => {
    if (list?.id && isGrocery && isCategorized) {
      const savedCategory = localStorage.getItem(`listmine:lastCategory:${list.id}`);
      setNewItemGroceryCategory(savedCategory || 'Other');
    }
  }, [list?.id, isGrocery, isCategorized]);
  
  // Save section selection to localStorage
  const handleSectionChange = (section: string) => {
    setNewItemSection(section);
    if (list?.id) {
      localStorage.setItem(`listmine:lastSection:${list.id}`, section);
    }
  };
  
  // Save category selection to localStorage for grocery lists
  const handleGroceryCategoryChange = (category: string) => {
    setNewItemGroceryCategory(category);
    if (list?.id) {
      localStorage.setItem(`listmine:lastCategory:${list.id}`, category);
    }
  };
  
  // View mode state for toggle
  const [viewMode, setViewMode] = useState<"dashboard" | "list">(() => {
    return (localStorage.getItem("dashboardViewMode") as "dashboard" | "list") || "dashboard";
  });

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Press 'Escape' to close dialogs
      if (e.key === "Escape") {
        setIsShareDialogOpen(false);
        setIsEditModalOpen(false);
        setEditingItem(null);
        setItemToDelete(null);
        setLinkFieldTouched(false);
        setOriginalItemLinks(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // DEV-only debug logging for editingItem changes
  useEffect(() => {
    if (import.meta.env.DEV) {
      console.log('[DEV] editingItem changed:', editingItem ? { id: editingItem.id, text: editingItem.text } : null, 'isEditModalOpen:', isEditModalOpen);
    }
  }, [editingItem, isEditModalOpen]);

  // DEV-only debug logging for list/items changes
  useEffect(() => {
    if (import.meta.env.DEV && list) {
      console.log('[DEV] list.items changed, count:', list.items?.length, 'editingItem:', editingItem?.id, 'isEditModalOpen:', isEditModalOpen);
    }
  }, [list?.items]);

  const priorityColors = {
    low: "bg-success/10 text-success border-success/20",
    medium: "bg-warning/10 text-warning border-warning/20",
    high: "bg-destructive/10 text-destructive border-destructive/20",
  };

  // Only show skeleton if we haven't loaded once yet AND the list isn't found
  // This prevents flashing when navigating between lists with cached data
  const isLoading = !hasLoadedOnce && !list;
  
  // Also show skeleton while retrying to find a newly created list
  const isRetrying = !list && attempts < maxAttempts && retrying;
  
  // Detect "not found" state: list doesn't exist after attempts exhausted (no hasLoadedOnce requirement)
  const isNotFound = !!id && !list && attempts >= maxAttempts;
  
  // Log state after variables are declared
  console.log("[LIST_LOAD_STATE]", { listId: id, hasLoadedOnce, isLoading, attempts, retrying: isRetrying, isNotFound });

  // Debug log to verify source is fetched and stored
  if (list) {
    console.log("[LIST_SOURCE]", list?.id, list?.source);
  }

  // Only show skeleton when loading and NOT in notFound state
  if ((isLoading || isRetrying) && !isNotFound) {
    return <ListDetailSkeleton />;
  }

  if (isNotFound) {
    // Log not found
    console.log("[LIST_NOT_FOUND]", { listId: id, attempts });
    
    // Clear localStorage entries related to this missing list
    const clearDeletedListFromStorage = () => {
      if (!id) return;
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key) continue;
        const value = localStorage.getItem(key);
        // Remove any key whose value equals the missing listId
        if (value === id) {
          keysToRemove.push(key);
        }
        // Remove any key matching /last|active|selected|current/i AND /list/i
        if (/last|active|selected|current/i.test(key) && /list/i.test(key)) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
    };
    
    // Immediately clear and redirect (no delay)
    clearDeletedListFromStorage();
    navigate("/dashboard");
    
    // Show brief message while redirecting
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/10 via-white to-secondary/10 flex items-center justify-center">
        <Card className="p-8 text-center">
          <h2 className="text-xl font-semibold mb-4">List not found</h2>
          <p className="text-sm text-muted-foreground mb-4">This list may have been deleted.</p>
          <p className="text-xs text-muted-foreground">Redirecting to dashboard...</p>
        </Card>
      </div>
    );
  }

  const handleAddItem = async () => {
    // Validate item name
    const nameValidation = validateItemName(newItemText);
    if (!nameValidation.valid) {
      toast({
        title: "⚠️ Invalid item name",
        description: nameValidation.error,
        variant: "destructive",
      });
      return;
    }

    // Validate quantity
    if (newItemQuantity !== undefined) {
      const quantityValidation = validateQuantity(newItemQuantity);
      if (!quantityValidation.valid) {
        toast({
          title: "⚠️ Invalid quantity",
          description: quantityValidation.error,
          variant: "destructive",
        });
        return;
      }
    }

    // Validate notes
    if (newItemNotes) {
      const notesValidation = validateNotes(newItemNotes);
      if (!notesValidation.valid) {
        toast({
          title: "⚠️ Invalid notes",
          description: notesValidation.error,
          variant: "destructive",
        });
        return;
      }
    }

    // Validate assigned to
    if (newItemAssignedTo) {
      const assignedToValidation = validateAssignedTo(newItemAssignedTo);
      if (!assignedToValidation.valid) {
        toast({
          title: "⚠️ Invalid assigned to",
          description: assignedToValidation.error,
          variant: "destructive",
        });
        return;
      }
    }

    // Validate due date
    if (newItemDueDate) {
      const dueDateValidation = validateDueDate(newItemDueDate);
      if (!dueDateValidation.valid) {
        toast({
          title: "⚠️ Invalid due date",
          description: dueDateValidation.error,
          variant: "destructive",
        });
        return;
      }
    }

    // Check item limit
    if (user) {
      const limitCheck = checkItemLimit(
        list.items.length,
        user.itemsPerListLimit,
      );
      if (!limitCheck.valid) {
        setShowItemLimitError(true);
        const tierName =
          effectiveTier === "free"
            ? "Free"
            : effectiveTier === "good"
              ? "Good"
              : effectiveTier === "even_better"
                ? "Even Better"
                : "Lots More";
        toast({
          title: "⚠️ Item limit reached",
          description: `This list has reached the ${user.itemsPerListLimit === -1 ? "unlimited" : user.itemsPerListLimit} item limit for your ${tierName} tier.`,
          variant: "destructive",
        });
        return;
      }
    }

    try {
      // Build attributes object based on list type
      const attributes: any = {};
      
      if (isGrocery) {
        // Always use category for grocery lists (not section)
        if (newItemCategory) {
          attributes.category = newItemCategory;
        } else if (isCategorized && newItemGroceryCategory) {
          // Use selected category from dropdown for categorized grocery lists
          attributes.category = newItemGroceryCategory;
        }
        if (newItemUnit) attributes.unit = newItemUnit;
        if (newItemPrice) attributes.price = newItemPrice;
      } else if (isRegistryOrWishlistType) {
        if (newItemPrice) attributes.price = newItemPrice;
        if (newItemQuantityNeeded) attributes.quantityNeeded = newItemQuantityNeeded;
        if (newItemQuantityPurchased) attributes.quantityPurchased = newItemQuantityPurchased;
        if (newItemStatus) attributes.purchaseStatus = newItemStatus;
        // Add section for sectioned registry lists (Baby Registry, Wedding Registry)
        if (isSectioned && newItemSection) {
          attributes.section = newItemSection;
        }
        if (newItemProductLink) {
          attributes.productLink = newItemProductLink;
          // Save manual link preview data
          if (newItemLinkTitle) attributes.customLinkTitle = newItemLinkTitle;
          if (newItemLinkDescription) attributes.customLinkDescription = newItemLinkDescription;
          if (newItemLinkImage) attributes.customLinkImage = newItemLinkImage;
        }
      } else if (isShoppingList && !isGrocery) {
        if (newItemPrice) attributes.price = newItemPrice;
        if (newItemStatus) attributes.purchaseStatus = newItemStatus;
        if (newItemProductLink) {
          attributes.productLink = newItemProductLink;
          // Save manual link preview data
          if (newItemLinkTitle) attributes.customLinkTitle = newItemLinkTitle;
          if (newItemLinkDescription) attributes.customLinkDescription = newItemLinkDescription;
          if (newItemLinkImage) attributes.customLinkImage = newItemLinkImage;
        }
      } else if (isTodo) {
        if (newItemStatus) attributes.status = newItemStatus;
        // Add section for sectioned todo lists
        if (isSectioned && newItemSection) {
          attributes.section = newItemSection;
        }
      } else if (isIdea) {
        if (newItemStatus) attributes.status = newItemStatus;
        // Add section for sectioned idea lists
        if (isSectioned && newItemSection) {
          attributes.section = newItemSection;
        }
        if (newItemProductLink) {
          attributes.inspirationLink = newItemProductLink;
          // Save manual link preview data
          if (newItemLinkTitle) attributes.customLinkTitle = newItemLinkTitle;
          if (newItemLinkDescription) attributes.customLinkDescription = newItemLinkDescription;
          if (newItemLinkImage) attributes.customLinkImage = newItemLinkImage;
        }
      } else if (effectiveListType === "custom") {
        // Add section for sectioned custom lists (Recipe, Vacation Packing, Home Maintenance, Moving Checklist)
        if (isSectioned && newItemSection) {
          attributes.section = newItemSection;
        }
      }

      await addItemToList(list.id, {
        text: nameValidation.value!,
        quantity: newItemQuantity,
        priority: newItemPriority,
        dueDate: newItemDueDate,
        notes: newItemNotes,
        assignedTo: newItemAssignedTo || undefined,
        links: newItemLinks.length > 0 ? newItemLinks : undefined,
        attributes: Object.keys(attributes).length > 0 ? attributes : undefined,
        completed: false,
      });

      // Reset all fields
      setNewItemText("");
      setNewItemQuantity(undefined);
      setNewItemPriority(undefined);
      setNewItemDueDate(undefined);
      setNewItemNotes("");
      setNewItemAssignedTo("");
      setNewItemLinks([]);
      setNewLinkInput("");
      setNewItemCategory(undefined);
      setNewItemUnit(undefined);
      setNewItemPrice(undefined);
      setNewItemStatus(undefined);
      setNewItemQuantityNeeded(undefined);
      setNewItemQuantityPurchased(undefined);
      setNewItemProductLink("");
      setNewItemLinkTitle("");
      setNewItemLinkDescription("");
      setNewItemLinkImage("");
      setShowNewItemPreview(false);
      setShowItemLimitError(false);
      
      toast({
        title: "Item added!",
        description: `${nameValidation.value} has been added to the list`,
      });

      // Focus back on the text input
      setTimeout(() => {
        const textInput = document.querySelector(
          'input[placeholder*="name"], input[placeholder*="title"], input[placeholder*="Task"]',
        ) as HTMLInputElement;
        if (textInput) textInput.focus();
      }, 0);
    } catch (error: any) {
      toast({
        title: "❌ Failed to add item",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleModeToggle = (mode: "quick" | "detailed") => {
    const isDetailed = mode === "detailed";
    setIsDetailedMode(isDetailed);
    localStorage.setItem("itemEntryMode", mode);
  };

  const handleDragStart = (e: React.DragEvent, item: ListItemType) => {
    setDraggedItem(item);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", item.id);
    // Add visual feedback
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = "0.5";
    }
  };

  const handleDragOver = (e: React.DragEvent, targetItem: ListItemType) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    
    if (!draggedItem || draggedItem.id === targetItem.id) {
      setDropTargetId(null);
      setDropPosition(null);
      return;
    }
    
    // Calculate if dropping before or after based on mouse position
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const midpoint = rect.top + rect.height / 2;
    const position = e.clientY < midpoint ? "before" : "after";
    
    setDropTargetId(targetItem.id);
    setDropPosition(position);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    // Only clear if leaving the card entirely (not entering a child)
    const relatedTarget = e.relatedTarget as HTMLElement;
    if (!e.currentTarget.contains(relatedTarget)) {
      setDropTargetId(null);
      setDropPosition(null);
    }
  };

  const handleDrop = (e: React.DragEvent, targetItem: ListItemType) => {
    e.preventDefault();
    if (!draggedItem || draggedItem.id === targetItem.id) {
      setDraggedItem(null);
      setDropTargetId(null);
      setDropPosition(null);
      return;
    }

    const items = [...list.items];
    const draggedIndex = items.findIndex((i) => i.id === draggedItem.id);
    const targetIndex = items.findIndex((i) => i.id === targetItem.id);

    if (draggedIndex === -1 || targetIndex === -1) {
      setDraggedItem(null);
      setDropTargetId(null);
      setDropPosition(null);
      return;
    }

    // Remove dragged item
    items.splice(draggedIndex, 1);
    
    // Calculate new index based on drop position
    let newIndex = targetIndex;
    if (draggedIndex < targetIndex) {
      // If dragging down, account for the removed item
      newIndex = dropPosition === "after" ? targetIndex : targetIndex - 1;
    } else {
      // If dragging up
      newIndex = dropPosition === "after" ? targetIndex + 1 : targetIndex;
    }
    
    items.splice(newIndex, 0, draggedItem);

    reorderListItems(list.id, items);
    setDraggedItem(null);
    setDropTargetId(null);
    setDropPosition(null);
  };

  const handleDragEnd = (e: React.DragEvent) => {
    // Reset visual feedback
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = "1";
    }
    setDraggedItem(null);
    setDropTargetId(null);
    setDropPosition(null);
  };

  const handleDeleteList = async () => {
    // Store the list data for potential undo
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
    
    // Navigate based on user's view preference
    const viewPreference = localStorage.getItem("dashboardViewMode");
    if (viewPreference === "list") {
      // Find another list to navigate to, or fallback to dashboard
      const remainingLists = lists.filter(l => l.id !== list.id && !l.isArchived);
      if (remainingLists.length > 0) {
        const nextList = remainingLists[0];
        localStorage.setItem("last_list_id", nextList.id);
        navigate(`/list/${nextList.id}`);
      } else {
        localStorage.setItem("dashboardViewMode", "dashboard");
        navigate("/dashboard");
      }
    } else {
      navigate("/dashboard");
    }
  };

  const handleArchiveList = async () => {
    if (!list) return;
    
    const archivedTitle = list.title.startsWith("[Archived]") 
      ? list.title 
      : `[Archived] ${list.title}`;
    
    try {
      const { error } = await supabase
        .from("lists")
        .update({ title: archivedTitle })
        .eq("id", list.id);
      
      if (error) throw error;
      
      // Refresh lists context
      await refreshLists();
      
      // Show toast
      toast({
        title: "List archived",
        description: `"${list.title}" has been archived and hidden from your dashboard`,
      });
      
      navigate("/dashboard");
    } catch (error) {
      console.error("Error archiving list:", error);
      toast({
        title: "Error",
        description: "Failed to archive list",
        variant: "destructive",
      });
    }
  };

  const handleUnarchiveList = async () => {
    if (!list) return;
    
    try {
      await unarchiveList(list.id);
      toast({
        title: "List restored",
        description: "The list has been restored from archive.",
      });
    } catch (error) {
      console.error("Error restoring list:", error);
      toast({
        title: "Error",
        description: "Failed to restore list",
        variant: "destructive",
      });
    }
  };

  const toggleItemSelection = (itemId: string) => {
    const newSelection = new Set(selectedItems);
    if (newSelection.has(itemId)) {
      newSelection.delete(itemId);
    } else {
      newSelection.add(itemId);
    }
    setSelectedItems(newSelection);
  };

  const handleSelectAll = () => {
    if (selectedItems.size === list.items.length) {
      // Deselect all
      setSelectedItems(new Set());
    } else {
      // Select all
      setSelectedItems(new Set(list.items.map((item) => item.id)));
    }
  };

  const handleBulkDelete = async () => {
    // Store the items data for potential undo
    const itemsToDelete = list.items.filter(item => selectedItems.has(item.id));
    const itemsData = itemsToDelete.map(item => ({ ...item }));
    const itemCount = selectedItems.size;
    
    await executeWithUndo(
      `bulk-delete-${list.id}-${Date.now()}`,
      itemsData,
      async () => {
        await bulkDeleteItems(list.id, Array.from(selectedItems));
      },
      async (data) => {
        await restoreBulkItems(list.id, data);
      },
      {
        title: "Items deleted",
        description: `${itemCount} items removed`,
        undoDescription: `${itemCount} items have been restored`,
      }
    );
    setSelectedItems(new Set());
  };

  const handleBulkComplete = () => {
    bulkUpdateItems(list.id, Array.from(selectedItems), { completed: true });
    setSelectedItems(new Set());
    toast({
      title: "Items completed",
      description: `${selectedItems.size} items marked as complete`,
    });
  };

  const handleGenerateShareLink = async () => {
    try {
      const link = await generateShareLink(list.id);
      setShareLink(link);
      
      // Check if we're on mobile and Web Share API is available
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      
      if (isMobile && navigator.share) {
        // Use Web Share API on mobile - more reliable than clipboard
        try {
          await navigator.share({
            title: list.title,
            text: `Check out my list: ${list.title}`,
            url: link,
          });
          toast({
            title: "Share link ready!",
            description: "Link shared successfully",
          });
          return;
        } catch (shareErr: any) {
          // User cancelled or share failed, fall through to clipboard
          if (shareErr.name === 'AbortError') {
            // User cancelled, still show the link
            showLinkToast(link);
            return;
          }
        }
      }
      
      // Try clipboard copy
      const copied = await copyToClipboard(link);
      if (copied) {
        toast({
          title: "Share link copied!",
          description: link,
        });
      } else {
        showLinkToast(link);
      }
    } catch (error: any) {
      toast({
        title: "❌ Failed to generate share link",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Show toast with copyable link
  const showLinkToast = (link: string) => {
    toast({
      title: "📋 Share link generated",
      description: (
        <div className="flex flex-col gap-2">
          <span>Tap and hold to copy:</span>
          <input 
            type="text" 
            readOnly 
            value={link} 
            className="bg-muted p-2 rounded text-xs break-all w-full border-0"
            onClick={(e) => {
              (e.target as HTMLInputElement).select();
            }}
          />
        </div>
      ),
      className: "bg-accent/10 border-accent/30",
      duration: 15000,
    });
  };

  // Fallback clipboard function for environments where Clipboard API is blocked
  const copyToClipboard = async (text: string): Promise<boolean> => {
    // First try the modern Clipboard API
    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (err) {
        console.warn("Clipboard API failed:", err);
      }
    }
    
    // Fallback to execCommand - works better on some mobile browsers
    try {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.setAttribute("readonly", ""); // Prevent keyboard on mobile
      textArea.style.position = "fixed";
      textArea.style.left = "0";
      textArea.style.top = "0";
      textArea.style.width = "2em";
      textArea.style.height = "2em";
      textArea.style.padding = "0";
      textArea.style.border = "none";
      textArea.style.outline = "none";
      textArea.style.boxShadow = "none";
      textArea.style.background = "transparent";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      
      // For iOS
      textArea.setSelectionRange(0, text.length);
      
      const success = document.execCommand("copy");
      document.body.removeChild(textArea);
      return success;
    } catch (err) {
      console.warn("execCommand fallback failed:", err);
      return false;
    }
  };

  const handleUnshareList = async () => {
    try {
      await unshareList(list.id);
      setShareLink(null);
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

  const handleAddCollaborator = () => {
    if (effectiveTier !== "lots_more") {
      toast({
        title: "⚠️ Premium feature",
        description: "Upgrade to premium to add collaborators",
        variant: "destructive",
      });
      return;
    }

    // Validate email
    const emailValidation = validateEmail(collaboratorEmail);
    if (!emailValidation.valid) {
      toast({
        title: "⚠️ Invalid email",
        description: emailValidation.error,
        variant: "destructive",
      });
      return;
    }

    try {
      addCollaborator(list.id, emailValidation.value!);
      setCollaboratorEmail("");
      toast({
        title: "Collaborator added",
        description: `${emailValidation.value} can now edit this list`,
      });
    } catch (error: any) {
      toast({
        title: "❌ Failed to add collaborator",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleAddTag = () => {
    if (!newTag.trim()) return;

    // Validate tag
    const tagValidation = validateTag(newTag);
    if (!tagValidation.valid) {
      toast({
        title: "⚠️ Invalid tag",
        description: tagValidation.error,
        variant: "destructive",
      });
      return;
    }

    // Check if tag already exists
    if (list.tags?.includes(tagValidation.value!)) {
      toast({
        title: "⚠️ Tag already exists",
        description: "This tag is already added to the list",
        variant: "destructive",
      });
      return;
    }

    try {
      addTagToList(list.id, tagValidation.value!);
      setNewTag("");
      toast({
        title: "Tag added",
        description: `Tag "${tagValidation.value}" has been added`,
      });
    } catch (error: any) {
      toast({
        title: "❌ Failed to add tag",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleEditList = () => {
    if (!list) return;

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

    try {
      updateList(list.id, {
        title: nameValidation.value!,
        category: editListCategory as any,
        listType: editListType as any,
      });
      setIsEditListDialogOpen(false);
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

  const handleTogglePurchaserInfo = async (value: boolean) => {
    try {
      const { error } = await supabase
        .from("lists")
        .update({ show_purchaser_info: value })
        .eq("id", list.id);

      if (error) throw error;

      // Update local list state
      updateList(list.id, { showPurchaserInfo: value });

      toast({
        title: value ? "Purchaser names visible" : "Purchaser names hidden",
        description: value 
          ? "You can now see who purchased each item" 
          : "All purchases will show as Anonymous",
      });
    } catch (error: any) {
      console.error("Error updating purchaser info setting:", error);
      toast({
        title: "Error",
        description: "Failed to update privacy setting",
        variant: "destructive",
      });
    }
  };

  const openEditListDialog = () => {
    if (!list) return;
    setEditListTitle(list.title);
    setEditListCategory(list.category);
    setEditListType(list.listType);
    setIsEditListDialogOpen(true);
  };

  const handleAddLink = () => {
    if (editingItem && newLink.trim()) {
      const links = editingItem.links || [];
      updateListItem(list.id, editingItem.id, { links: [...links, newLink] });
      setEditingItem({ ...editingItem, links: [...links, newLink] });
      setNewLink("");
    }
  };

  const handleRemoveLink = (linkToRemove: string) => {
    if (editingItem) {
      const links = (editingItem.links || []).filter((l) => l !== linkToRemove);
      updateListItem(list.id, editingItem.id, { links });
      setEditingItem({ ...editingItem, links });
    }
  };

  const handleExport = async (format: "csv" | "txt" | "pdf") => {
    setIsExporting(true);
    // Simulate export processing
    await new Promise((resolve) => setTimeout(resolve, 800));
    try {
      exportList(list.id, format);
      setIsExporting(false);
      toast({
        title: "List exported!",
        description: `${format.toUpperCase()} file downloaded successfully`,
      });
    } catch (error: any) {
      setIsExporting(false);
      toast({
        title: "❌ Export failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handlePrint = () => {
    toast({
      title: "🖨️ Opening print dialog",
      description: "Preparing your list for printing...",
    });
    
    // Small delay to show toast before print dialog
    setTimeout(() => {
      window.print();
    }, 300);
  };

  const getDueDateColor = (dueDate: Date | undefined) => {
    if (!dueDate) return "";
    const date = new Date(dueDate);
    if (isToday(date)) return "text-accent bg-accent/10 border-accent/20";
    if (isPast(date)) return "text-red-600 bg-red-50 border-red-200";
    return "text-muted-foreground bg-muted border-border";
  };

  const handleItemSortChange = (value: string) => {
    setItemSortBy(value as any);
    localStorage.setItem("itemSortBy", value);
  };

  const getSortedItems = () => {
    if (!list) return [];
    let items = [...list.items];

    // For registry/wishlist, group by purchase status first
    if (isRegistryOrWishlistType) {
      const unpurchased = items.filter(item => item.attributes?.purchaseStatus !== "purchased");
      const purchased = items.filter(item => item.attributes?.purchaseStatus === "purchased");
      
      // Sort each group according to the selected sort method
      const sortGroup = (group: typeof items) => {
        switch (itemSortBy) {
          case "priority":
            const priorityOrder = { high: 0, medium: 1, low: 2 };
            return group.sort((a, b) => {
              const aPriority = a.priority ? priorityOrder[a.priority] : 999;
              const bPriority = b.priority ? priorityOrder[b.priority] : 999;
              return aPriority - bPriority;
            });
          case "dueDate":
            return group.sort((a, b) => {
              if (!a.dueDate) return 1;
              if (!b.dueDate) return -1;
              return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
            });
          case "alphabetical":
            return group.sort((a, b) => a.text.localeCompare(b.text));
          case "manual":
          default:
            return group.sort((a, b) => a.order - b.order);
        }
      };
      
      return [...sortGroup(unpurchased), ...sortGroup(purchased)];
    }

    // For other list types, use normal sorting
    switch (itemSortBy) {
      case "priority":
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        return items.sort((a, b) => {
          const aPriority = a.priority ? priorityOrder[a.priority] : 999;
          const bPriority = b.priority ? priorityOrder[b.priority] : 999;
          return aPriority - bPriority;
        });
      case "dueDate":
        return items.sort((a, b) => {
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        });
      case "alphabetical":
        return items.sort((a, b) => a.text.localeCompare(b.text));
      case "manual":
      default:
        return items.sort((a, b) => a.order - b.order);
    }
  };

  const getGroupedGroceryItems = () => {
    if (!list || !isGrocery) return {};
    
    const items = getSortedItems();
    const grouped: Record<string, ListItemType[]> = {};
    const sectionOrder: string[] = []; // Track order sections first appear
    
    items.forEach((item) => {
      // Use section if available, fallback to category, then "other"
      const rawSection = item.attributes?.section;
      const rawCategory = item.attributes?.category;
      const section = (rawSection && rawSection.trim()) 
        ? rawSection.trim() 
        : (rawCategory || "other");
      
      if (!grouped[section]) {
        grouped[section] = [];
        sectionOrder.push(section);
      }
      grouped[section].push(item);
    });
    
    // Return with stable order (first appearance order)
    const orderedGrouped: Record<string, ListItemType[]> = {};
    sectionOrder.forEach((section) => {
      orderedGrouped[section] = grouped[section];
    });
    
    return orderedGrouped;
  };

  // Group items by section attribute (for templates with sections)
  const getGroupedItemsBySection = () => {
    if (!list) return {};
    
    const items = getSortedItems();
    const grouped: Record<string, ListItemType[]> = {};
    const sectionOrder: string[] = []; // Track order sections first appear
    
    items.forEach((item) => {
      // Get section, normalize empty/whitespace to 'Other'
      const rawSection = item.attributes?.section;
      const section = (rawSection && rawSection.trim()) ? rawSection.trim() : 'Other';
      
      if (!grouped[section]) {
        grouped[section] = [];
        sectionOrder.push(section);
      }
      grouped[section].push(item);
    });
    
    // Return with stable order (first appearance order)
    const orderedGrouped: Record<string, ListItemType[]> = {};
    sectionOrder.forEach((section) => {
      orderedGrouped[section] = grouped[section];
    });
    
    return orderedGrouped;
  };

  // Check if any items have a section attribute
  const hasItemsWithSections = () => {
    if (!list) return false;
    return list.items.some((item) => {
      const section = item.attributes?.section;
      return section && section.trim();
    });
  };

  const categoryLabels: Record<string, string> = {
    // Legacy category labels
    produce: "Produce",
    dairy: "Dairy",
    meat: "Meat",
    pantry: "Pantry",
    frozen: "Frozen",
    bakery: "Bakery",
    other: "Other",
    // Section labels from templates
    Fruit: "Fruit",
    Dairy: "Dairy",
    Meat: "Meat",
    Bakery: "Bakery",
    Produce: "Produce",
    Pantry: "Pantry",
    Basics: "Basics",
    Ingredients: "Ingredients",
    Instructions: "Instructions",
    Notes: "Notes",
    Documents: "Documents",
    Financials: "Financials",
    Electronics: "Electronics",
    Toiletries: "Toiletries",
    Clothing: "Clothing",
    Accessories: "Accessories",
    Other: "Other",
  };

  // Helper function to compute the primary outbound URL for an item
  const getPrimaryItemUrl = (item: ListItemType, listSource?: string): { url: string | null; isFallback: boolean; isTheKnot: boolean } => {
    const isTheKnot = !!listSource?.startsWith('theknot:');
    const isMyRegistry = !!listSource?.startsWith('myregistry:');
    
    // For The Knot lists: ALWAYS use registry URL, treat item links as unreliable
    if (isTheKnot) {
      return { url: listSource!.replace(/^theknot:/, ''), isFallback: true, isTheKnot: true };
    }
    
    // For other lists: use item's direct link if available
    if (item.links?.[0] && item.links[0].trim() !== '') {
      return { url: item.links[0], isFallback: false, isTheKnot: false };
    }
    
    // Fallback to MyRegistry source if available
    if (isMyRegistry) {
      return { url: listSource!.replace(/^myregistry:/, ''), isFallback: true, isTheKnot: false };
    }
    
    return { url: null, isFallback: false, isTheKnot: false };
  };

  // Universal item link component
  const ItemLinkActions = ({ item }: { item: ListItemType }) => {
    const { url: primaryUrl, isFallback, isTheKnot } = getPrimaryItemUrl(item, list.source);
    
    // For copy link: only copy real non-Knot links
    const hasRealLink = !isTheKnot && item.links?.[0] && item.links[0].trim() !== '';
    const copyableUrl = hasRealLink ? item.links![0] : null;
    
    const handleCopyLink = async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!copyableUrl) return;
      try {
        await navigator.clipboard.writeText(copyableUrl);
        toast({
          title: "Copied!",
          description: "Link copied to clipboard",
        });
      } catch {
        toast({
          title: "Copy failed",
          description: "Could not copy link",
          variant: "destructive",
        });
      }
    };

    // Don't render anything if no URL - parent should conditionally render ItemLinkActions
    if (!primaryUrl) {
      return null;
    }

    const searchUrl = `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(item.text + " buy")}`;

    return (
      <div className="relative inline-flex items-center gap-2">
        <a
          href={primaryUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs sm:text-sm text-primary hover:text-primary/80 underline flex items-center gap-1"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <ExternalLink className="w-3 h-3 flex-shrink-0" />
          View item
        </a>
        {/* The Knot tooltip - always show for Knot lists */}
        {isTheKnot && (
          <span title="The Knot doesn't provide reliable per-item product links. View item opens the registry.">
            <Info className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground cursor-help" />
          </span>
        )}
        {/* Non-Knot fallback tooltip */}
        {isFallback && !isTheKnot && (
          <span title="This item opens in the source registry (no direct product link available).">
            <Info className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground cursor-help" />
          </span>
        )}
        {/* Copy link - only show if there's a real non-Knot link */}
        {copyableUrl && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={handleCopyLink}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <Copy className="w-3 h-3 mr-1" />
            Copy link
          </Button>
        )}
        {/* Search - always available */}
        <a
          href={searchUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <Search className="w-3 h-3" />
          Search
        </a>
      </div>
    );
  };
  
  // Helper to check if ItemLinkActions should render
  const shouldShowItemLinks = (item: ListItemType): boolean => {
    const isTheKnot = (list.source ?? "").startsWith("theknot:");
    const hasDirectLink = !isTheKnot && !!item.links?.[0];
    const hasRegistryFallback = isTheKnot || (list.source ?? "").startsWith("myregistry:");
    return hasDirectLink || hasRegistryFallback;
  };

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-primary/10 via-white to-secondary/10 animate-in fade-in duration-200 print:bg-white print:min-h-0">
      {/* DEV-only debug badge for editingItem */}
      {import.meta.env.DEV && (editingItem || isEditModalOpen) && (
        <div className="fixed top-2 left-1/2 -translate-x-1/2 z-[9999] bg-yellow-400 text-black px-3 py-1 rounded-full text-xs font-mono shadow-lg">
          {editingItem ? `Editing: ${editingItem.text} (ID: ${editingItem.id.slice(0, 8)}...)` : 'No editingItem'} | Modal: {isEditModalOpen ? 'OPEN' : 'CLOSED'}
        </div>
      )}

      {/* GLOBAL Edit Modal - Schema-driven by listType */}
      {isEditModalOpen && editingItem && (
        <Dialog
          open={true}
          onOpenChange={(open) => {
            if (import.meta.env.DEV) console.log('[DEV] GLOBAL Edit Dialog onOpenChange:', open);
            if (!open) {
              setIsEditModalOpen(false);
              setEditingItem(null);
              setDueDateInput('');
              setLinkFieldTouched(false);
              setOriginalItemLinks(null);
            }
          }}
          modal={true}
        >
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto z-[9999]">
            <DialogHeader>
              <DialogTitle>Edit Item</DialogTitle>
              <DialogDescription>
                Update item details and attributes
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              {/* Item Name - Always shown */}
              <div className="space-y-2">
                <Label>Item Name</Label>
                <Input
                  value={editingItem.text}
                  onChange={(e) =>
                    setEditingItem({
                      ...editingItem,
                      text: e.target.value,
                    })
                  }
                />
              </div>

              {/* TO-DO LIST FIELDS: todo, todo-list */}
              {isTodo && (
                <>
                  <div className="space-y-2">
                    <Label>Due Date</Label>
                    <Input
                      type="date"
                      value={dueDateInput}
                      onChange={(e) => setDueDateInput(e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Priority</Label>
                      <Select
                        value={editingItem.priority || "none"}
                        onValueChange={(value) =>
                          setEditingItem({
                            ...editingItem,
                            priority: value === "none" ? undefined : (value as "low" | "medium" | "high"),
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Status</Label>
                      <Select
                        value={editingItem.attributes?.status || ""}
                        onValueChange={(value) =>
                          setEditingItem({
                            ...editingItem,
                            attributes: {
                              ...editingItem.attributes,
                              status: value,
                            },
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="not-started">Not started</SelectItem>
                          <SelectItem value="in-progress">In progress</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </>
              )}

              {/* IDEA LIST FIELDS: idea, idea-list */}
              {isIdea && (
                <>
                  <div className="space-y-2">
                    <Label>Inspiration Link (optional)</Label>
                    <Input
                      type="url"
                      placeholder="https://example.com/inspiration"
                      value={editingItem.attributes?.inspirationLink || ""}
                      onChange={(e) =>
                        setEditingItem({
                          ...editingItem,
                          attributes: {
                            ...editingItem.attributes,
                            inspirationLink: e.target.value,
                          },
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Link Title (optional)</Label>
                    <Input
                      type="text"
                      placeholder="e.g., Modern Kitchen Design"
                      value={editingItem.attributes?.customLinkTitle || ""}
                      onChange={(e) =>
                        setEditingItem({
                          ...editingItem,
                          attributes: {
                            ...editingItem.attributes,
                            customLinkTitle: e.target.value,
                          },
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Link Description (optional)</Label>
                    <Textarea
                      placeholder="e.g., Minimalist kitchen with marble countertops"
                      value={editingItem.attributes?.customLinkDescription || ""}
                      onChange={(e) =>
                        setEditingItem({
                          ...editingItem,
                          attributes: {
                            ...editingItem.attributes,
                            customLinkDescription: e.target.value,
                          },
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Link Image URL (optional)</Label>
                    <Input
                      type="url"
                      placeholder="e.g., https://example.com/image.jpg"
                      value={editingItem.attributes?.custom?.image ?? editingItem.attributes?.customLinkImage ?? ""}
                      onChange={(e) =>
                        setEditingItem({
                          ...editingItem,
                          attributes: {
                            ...editingItem.attributes,
                            customLinkImage: e.target.value,
                             custom: {
                               ...editingItem.attributes?.custom,
                               image: e.target.value,
                             },
                          },
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select
                      value={editingItem.attributes?.status || ""}
                      onValueChange={(value) =>
                        setEditingItem({
                          ...editingItem,
                          attributes: {
                            ...editingItem.attributes,
                            status: value,
                          },
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="brainstorm">Brainstorm</SelectItem>
                        <SelectItem value="in-progress">In progress</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="on-hold">On hold</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}

              {/* REGISTRY/WISHLIST FIELDS: registry, registry-list, wishlist */}
              {isRegistryOrWishlistType && (
                <>
                  <div className="space-y-2">
                    <Label>Product Link (optional)</Label>
                    <Input
                      type="url"
                      placeholder="https://example.com/product"
                      value={editingItem.links?.[0] ?? editingItem.attributes?.productLink ?? ""}
                      onChange={(e) => {
                        const v = e.target.value.trim();
                        setLinkFieldTouched(true);
                        setEditingItem({
                          ...editingItem,
                          links: v ? [v] : [],
                        });
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Link Title (optional)</Label>
                    <Input
                      type="text"
                      placeholder="e.g., Sterling Silver Ring"
                      value={editingItem.attributes?.customLinkTitle || ""}
                      onChange={(e) =>
                        setEditingItem({
                          ...editingItem,
                          attributes: {
                            ...editingItem.attributes,
                            customLinkTitle: e.target.value,
                          },
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Link Description (optional)</Label>
                    <Textarea
                      placeholder="e.g., Beautiful handcrafted ring"
                      value={editingItem.attributes?.customLinkDescription || ""}
                      onChange={(e) =>
                        setEditingItem({
                          ...editingItem,
                          attributes: {
                            ...editingItem.attributes,
                            customLinkDescription: e.target.value,
                          },
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Link Image URL (optional)</Label>
                    <Input
                      type="url"
                      placeholder="e.g., https://example.com/image.jpg"
                      value={editingItem.attributes?.custom?.image ?? editingItem.attributes?.customLinkImage ?? ""}
                      onChange={(e) =>
                        setEditingItem({
                          ...editingItem,
                          attributes: {
                            ...editingItem.attributes,
                            customLinkImage: e.target.value,
                             custom: {
                               ...editingItem.attributes?.custom,
                               image: e.target.value,
                             },
                          },
                        })
                      }
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Price</Label>
                      <Input
                        type="text"
                        placeholder="$0.00"
                        value={String(editingItem.attributes?.custom?.price ?? "")}
                        onChange={(e) =>
                          setEditingItem({
                            ...editingItem,
                            attributes: {
                              ...editingItem.attributes,
                              custom: {
                                ...editingItem.attributes?.custom,
                                price: e.target.value,
                              },
                            },
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Quantity</Label>
                      <Input
                        type="number"
                        value={editingItem.quantity || ""}
                        onChange={(e) =>
                          setEditingItem({
                            ...editingItem,
                            quantity: e.target.value ? parseInt(e.target.value) : undefined,
                          })
                        }
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Purchase Status</Label>
                    <Select
                      value={editingItem.attributes?.purchaseStatus || ""}
                      onValueChange={(value) =>
                        setEditingItem({
                          ...editingItem,
                          attributes: {
                            ...editingItem.attributes,
                            purchaseStatus: value,
                          },
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="not-purchased">Not purchased</SelectItem>
                        <SelectItem value="purchased">Purchased</SelectItem>
                        <SelectItem value="received">Received</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {/* Purchaser info tip - ONLY for registry/wishlist */}
                  <div className="bg-blue-50 p-3 rounded-md text-sm text-blue-700">
                    <p className="flex items-center gap-2">
                      <span className="text-blue-500">💡</span>
                      When shared, visitors can mark items as purchased and their info will be recorded.
                    </p>
                  </div>
                </>
              )}

              {/* SHOPPING LIST FIELDS: shopping-list - NO purchaser UI */}
              {isShoppingList && !isGrocery && (
                <>
                  <div className="space-y-2">
                    <Label>Product Link (optional)</Label>
                    <Input
                      type="url"
                      placeholder="https://example.com/product"
                      value={editingItem.links?.[0] ?? editingItem.attributes?.productLink ?? ""}
                      onChange={(e) => {
                        const v = e.target.value.trim();
                        setLinkFieldTouched(true);
                        setEditingItem({
                          ...editingItem,
                          links: v ? [v] : [],
                        });
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Link Title (optional)</Label>
                    <Input
                      type="text"
                      placeholder="e.g., Wireless Headphones"
                      value={editingItem.attributes?.customLinkTitle || ""}
                      onChange={(e) =>
                        setEditingItem({
                          ...editingItem,
                          attributes: {
                            ...editingItem.attributes,
                            customLinkTitle: e.target.value,
                          },
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Link Description (optional)</Label>
                    <Textarea
                      placeholder="e.g., Noise-canceling over-ear headphones"
                      value={editingItem.attributes?.customLinkDescription || ""}
                      onChange={(e) =>
                        setEditingItem({
                          ...editingItem,
                          attributes: {
                            ...editingItem.attributes,
                            customLinkDescription: e.target.value,
                          },
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Link Image URL (optional)</Label>
                    <Input
                      type="url"
                      placeholder="e.g., https://example.com/image.jpg"
                      value={editingItem.attributes?.custom?.image ?? editingItem.attributes?.customLinkImage ?? ""}
                      onChange={(e) =>
                        setEditingItem({
                          ...editingItem,
                          attributes: {
                            ...editingItem.attributes,
                            customLinkImage: e.target.value,
                             custom: {
                               ...editingItem.attributes?.custom,
                               image: e.target.value,
                             },
                          },
                        })
                      }
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Price</Label>
                      <Input
                        type="text"
                        placeholder="$0.00"
                        value={String(editingItem.attributes?.custom?.price ?? "")}
                        onChange={(e) =>
                          setEditingItem({
                            ...editingItem,
                            attributes: {
                              ...editingItem.attributes,
                              custom: {
                                ...editingItem.attributes?.custom,
                                price: e.target.value,
                              },
                            },
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Quantity</Label>
                      <Input
                        type="number"
                        value={editingItem.quantity || ""}
                        onChange={(e) =>
                          setEditingItem({
                            ...editingItem,
                            quantity: e.target.value ? parseInt(e.target.value) : undefined,
                          })
                        }
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Purchase Status</Label>
                    <Select
                      value={editingItem.attributes?.purchaseStatus || ""}
                      onValueChange={(value) =>
                        setEditingItem({
                          ...editingItem,
                          attributes: {
                            ...editingItem.attributes,
                            purchaseStatus: value,
                          },
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="not-purchased">Not purchased</SelectItem>
                        <SelectItem value="purchased">Purchased</SelectItem>
                        <SelectItem value="received">Received</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}

              {/* GROCERY LIST FIELDS: grocery-list */}
              {isGrocery && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Category</Label>
                      <Select
                        value={editingItem.attributes?.category || ""}
                        onValueChange={(value) =>
                          setEditingItem({
                            ...editingItem,
                            attributes: {
                              ...editingItem.attributes,
                              category: value,
                            },
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="produce">Produce</SelectItem>
                          <SelectItem value="dairy">Dairy</SelectItem>
                          <SelectItem value="meat">Meat</SelectItem>
                          <SelectItem value="pantry">Pantry</SelectItem>
                          <SelectItem value="frozen">Frozen</SelectItem>
                          <SelectItem value="bakery">Bakery</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Quantity</Label>
                      <Input
                        type="number"
                        value={editingItem.quantity || ""}
                        onChange={(e) =>
                          setEditingItem({
                            ...editingItem,
                            quantity: e.target.value ? parseInt(e.target.value) : undefined,
                          })
                        }
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Unit</Label>
                      <Select
                        value={editingItem.attributes?.unit || ""}
                        onValueChange={(value) =>
                          setEditingItem({
                            ...editingItem,
                            attributes: {
                              ...editingItem.attributes,
                              unit: value,
                            },
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select unit" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="lbs">lbs</SelectItem>
                          <SelectItem value="oz">oz</SelectItem>
                          <SelectItem value="count">count</SelectItem>
                          <SelectItem value="liters">liters</SelectItem>
                          <SelectItem value="ml">ml</SelectItem>
                          <SelectItem value="cups">cups</SelectItem>
                          <SelectItem value="tbsp">tbsp</SelectItem>
                          <SelectItem value="tsp">tsp</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Est. Price</Label>
                      <Input
                        type="text"
                        placeholder="$0.00"
                        value={String(editingItem.attributes?.custom?.price ?? "")}
                        onChange={(e) =>
                          setEditingItem({
                            ...editingItem,
                            attributes: {
                              ...editingItem.attributes,
                              custom: {
                                ...editingItem.attributes?.custom,
                                price: e.target.value,
                              },
                            },
                          })
                        }
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Notes field - Always shown for all list types */}
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  value={editingItem.notes || ""}
                  onChange={(e) =>
                    setEditingItem({
                      ...editingItem,
                      notes: e.target.value,
                    })
                  }
                  placeholder="Add notes..."
                  className="min-h-[80px]"
                />
              </div>

              {/* Save/Cancel Buttons */}
              <div className="flex justify-end gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsEditModalOpen(false);
                    setEditingItem(null);
                    setDueDateInput('');
                    setLinkFieldTouched(false);
                    setOriginalItemLinks(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={async () => {
                    if (editingItem) {
                      // Convert dueDateInput string to Date or undefined for todo items
                      const dueDate = dueDateInput 
                        ? new Date(dueDateInput + 'T00:00:00') 
                        : undefined;
                      
                      // Build update payload - only include links if the Product Link field was edited
                      const updatePayload: Partial<ListItemType> = {
                        text: editingItem.text,
                        notes: editingItem.notes,
                        dueDate: isTodo ? dueDate : editingItem.dueDate,
                        priority: editingItem.priority,
                        quantity: editingItem.quantity,
                        attributes: editingItem.attributes,
                        completed: editingItem.completed,
                      };
                      // Only include links in payload if the Product Link field was explicitly edited
                      // If edited and blank: set links: []
                      // If edited and non-empty: set links: [url]
                      // Otherwise: omit links so existing links are preserved
                      if (linkFieldTouched) {
                        const currentLinks = editingItem.links;
                        if (Array.isArray(currentLinks) && currentLinks.length > 0) {
                          updatePayload.links = currentLinks;
                        } else {
                          updatePayload.links = [];
                        }
                      }
                      await updateListItem(list.id, editingItem.id, updatePayload);
                      setIsEditModalOpen(false);
                      setEditingItem(null);
                      setDueDateInput('');
                      setLinkFieldTouched(false);
                      setOriginalItemLinks(null);
                    }
                  }}
                >
                  Save Changes
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
      
      {/* Sidebar - Hidden on mobile, visible on desktop, hidden on print */}
      <div className="hidden md:block print:hidden">
        <ListSidebar />
      </div>

      {/* Mobile Sidebar Overlay */}
      <Sheet open={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
        <SheetContent side="left" className="w-[280px] p-0 print:hidden">
          <ListSidebar />
        </SheetContent>
      </Sheet>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 sticky top-0 z-10 print:hidden">
          <div className="px-4 sm:px-6 lg:px-8 py-4">
            {/* Breadcrumbs */}
            <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
              <button
                onClick={() => {
                  // Always navigate to dashboard when clicking breadcrumb
                  localStorage.setItem("dashboardViewMode", "dashboard");
                  navigate("/dashboard");
                }}
                className="hover:text-gray-900 transition-colors"
              >
                Dashboard
              </button>
              <ChevronRight className="w-4 h-4" />
              <span className="text-gray-400">{list.category}</span>
              <ChevronRight className="w-4 h-4" />
              <span className="font-semibold text-gray-900">{list.title}</span>
            </div>

            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
                {/* Hamburger Menu Button - Mobile Only */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsSidebarOpen(true)}
                  className="md:hidden min-h-[44px] min-w-[44px] flex-shrink-0"
                >
                  <Menu className="w-6 h-6" />
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    // Use browser history to go back to previous action
                    navigate(-1);
                  }}
                  className="min-h-[44px] min-w-[44px] flex-shrink-0"
                >
                  <ArrowLeft className="w-5 h-5" />
                </Button>
                <div className="min-w-0 flex-1">
                  <h1 className="text-lg sm:text-2xl font-bold text-foreground truncate flex items-center gap-2">
                    {list.title}
                    {list.isGuestAccess && (
                      <Badge variant="outline" className="text-xs bg-teal-100 text-teal-700 border-teal-300">
                        {list.guestPermission === 'edit' ? 'Guest (can edit)' : 'Guest (view only)'}
                      </Badge>
                    )}
                    {list.isTeamOwner && list.accountId && (
                      <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/30">
                        Team Owner
                      </Badge>
                    )}
                    {list.isTeamMember && !list.isTeamOwner && (
                      <Badge variant="outline" className="text-xs bg-secondary/10 text-secondary border-secondary/30">
                        Team (can edit)
                      </Badge>
                    )}
                    {list.isArchived && (
                      <Badge variant="secondary" className="text-xs">Archived</Badge>
                    )}
                  </h1>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    {list.category} · {Math.max(0, list.items?.length || 0)}/
                    {user?.itemsPerListLimit === -1 ? "∞" : user?.itemsPerListLimit} items
                    {list.lastEditedAt && (
                      <span className="ml-2">
                        · Last edited {list.lastEditedByEmail ? `by ${list.lastEditedByEmail}` : ''} on {new Date(list.lastEditedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} at {new Date(list.lastEditedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                      </span>
                    )}
                  </p>
                </div>
              </div>

              {/* View Mode Toggle */}
              <div className="hidden sm:flex items-center bg-muted rounded-lg p-1 shrink-0">
                <Button
                  variant={viewMode === "dashboard" ? "default" : "ghost"}
                  size="sm"
                  className="h-8 px-3"
                  onClick={() => {
                    setViewMode("dashboard");
                    localStorage.setItem("dashboardViewMode", "dashboard");
                    navigate("/dashboard");
                  }}
                >
                  <LayoutDashboard className="w-4 h-4 mr-1" />
                  Dashboard
                </Button>
                <Button
                  variant={viewMode === "list" ? "default" : "ghost"}
                  size="sm"
                  className="h-8 px-3"
                  onClick={() => {
                    // Just set the view mode preference, stay on current list
                    setViewMode("list");
                    localStorage.setItem("dashboardViewMode", "list");
                  }}
                >
                  <ListIcon className="w-4 h-4 mr-1" />
                  List
                </Button>
              </div>

              {/* Desktop Actions - Grouped logically */}
              <div className="hidden md:flex items-center gap-1 shrink-0">
                {/* Primary Actions Group */}
                <div className="flex items-center gap-1 pr-2 border-r border-gray-200">
                  {effectiveTier === "free" ? (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="outline" size="sm" onClick={handlePrint} className="h-9 print:hidden">
                            <Printer className="w-4 h-4 mr-2" />
                            Print
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Print this list</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ) : (
                    <Popover>
                      <TooltipProvider>
                        <Tooltip>
                          <PopoverTrigger asChild>
                            <TooltipTrigger asChild>
                              <Button variant="outline" size="sm" disabled={isExporting} className="h-9">
                                {isExporting ? (
                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                ) : (
                                  <Download className="w-4 h-4 mr-2" />
                                )}
                                Export
                              </Button>
                            </TooltipTrigger>
                          </PopoverTrigger>
                          <TooltipContent>Export this list</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <PopoverContent className="w-48">
                        <div className="space-y-2">
                          {getAvailableExportFormats(effectiveTier).map((format) => (
                            <Button
                              key={format}
                              variant="ghost"
                              className="w-full justify-start"
                              onClick={() => handleExport(format as "csv" | "txt" | "pdf")}
                              disabled={isExporting}
                            >
                              Export as {format.toUpperCase()}
                            </Button>
                          ))}
                        </div>
                      </PopoverContent>
                    </Popover>
                  )}
                </div>

                {/* Secondary Actions Group */}
                <div className="flex items-center gap-1 px-2 border-r border-gray-200">
                  {/* Open source registry Button - only for The Knot and MyRegistry lists */}
                  {(() => {
                    const isTheKnot = list.source?.startsWith('theknot:');
                    const isMyRegistry = list.source?.startsWith('myregistry:');
                    
                    // Only show for registry sources
                    if (!isTheKnot && !isMyRegistry) return null;
                    
                    const registryUrl = isTheKnot 
                      ? list.source?.replace(/^theknot:/, '') 
                      : list.source?.replace(/^myregistry:/, '');
                    
                    const handleCopyRegistryLink = async () => {
                      try {
                        await navigator.clipboard.writeText(registryUrl!);
                        toast({
                          title: "Copied!",
                          description: "Registry link copied to clipboard",
                        });
                      } catch {
                        toast({
                          title: "Copy failed",
                          description: "Could not copy. Please copy from the address bar.",
                          variant: "destructive",
                        });
                      }
                    };
                    
                    if (registryUrl) {
                      return (
                        <>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <a 
                                  href={registryUrl} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3"
                                >
                                  <ExternalLink className="w-4 h-4 mr-2" />
                                  Open source registry
                                </a>
                              </TooltipTrigger>
                              <TooltipContent>
                                Open the original registry in a new tab
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-9"
                                  onClick={handleCopyRegistryLink}
                                >
                                  <Copy className="w-4 h-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                Copy registry link
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </>
                      );
                    }
                    return null;
                  })()}
                  {/* Favorite Toggle */}
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className={`h-9 w-9 ${list.isFavorite ? "bg-muted hover:bg-primary/10" : ""}`}
                          onClick={async () => {
                            await toggleFavorite(list.id);
                            toast({
                              title: list.isFavorite ? "Removed from favorites" : "Added to favorites",
                              description: list.isFavorite ? `"${list.title}" removed from favorites` : `"${list.title}" added to favorites`,
                            });
                          }}
                        >
                          <Star className={`w-4 h-4 ${list.isFavorite ? "text-amber-500 fill-amber-500" : "text-gray-600"}`} />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{list.isFavorite ? "Remove from Favorites" : "Add to Favorites"}</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  {/* Share dropdown - only show for owners with paid tier */}
                  {isOwner && canShareLists(effectiveTier) && (
                    <DropdownMenu>
                      <TooltipProvider>
                        <Tooltip>
                          <DropdownMenuTrigger asChild>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className={`h-9 w-9 ${list.isShared ? "bg-primary/10" : ""}`}
                              >
                                <Share2 className={`w-4 h-4 ${list.isShared ? "text-primary" : "text-gray-600"}`} />
                              </Button>
                            </TooltipTrigger>
                          </DropdownMenuTrigger>
                          <TooltipContent>{list.isShared ? "Sharing options" : "Share this list"}</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuItem onClick={() => setIsShareSettingsOpen(true)}>
                          <Share2 className="w-4 h-4 mr-2" />
                          {list.isShared ? "Share Settings" : "Share options"}
                        </DropdownMenuItem>
                        {canInviteGuests(effectiveTier) && (
                          <DropdownMenuItem onClick={() => setIsGuestManagementOpen(true)}>
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
                          <DropdownMenuItem onClick={handleUnshareList} className="text-red-600">
                            <Link2Off className="w-4 h-4 mr-2" />
                            Unshare List
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant={isSelectMode ? "default" : "ghost"}
                          size="icon"
                          onClick={() => {
                            setIsSelectMode(!isSelectMode);
                            if (isSelectMode) setSelectedItems(new Set());
                          }}
                          className="h-9 w-9"
                        >
                          <CheckCircle className={`w-4 h-4 ${isSelectMode ? "" : "text-gray-600"}`} />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{isSelectMode ? "Done selecting" : "Select Multiple"}</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>

                {/* Utility Actions Group */}
                <div className="flex items-center gap-1 px-2 border-r border-gray-200">
                  {isRegistryOrWishlistType && (
                    <>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setIsPurchaseHistoryOpen(true)}
                              className="h-9 w-9"
                            >
                              <ShoppingCart className="w-4 h-4 text-gray-600" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Purchase History</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setIsUpdateFromRetailerOpen(true)}
                              className="h-9 w-9"
                            >
                              <RefreshCw className="w-4 h-4 text-gray-600" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Update from Retailer</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </>
                  )}
                  {isOwner && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={openEditListDialog}
                            className="h-9 w-9"
                          >
                            <Edit className="w-4 h-4 text-gray-600" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Edit list</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                  {isOwner && lists.length >= 2 && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setIsMergeModalOpen(true)}
                            className="h-9 w-9"
                          >
                            <Merge className="w-4 h-4 text-accent" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Merge with another list</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9"
                          onClick={() => setIsHelpModalOpen(true)}
                        >
                          <HelpCircle className="w-4 h-4 text-gray-600" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Help</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>

                {/* Destructive Actions - Separated (Owner only) */}
                {isOwner && (
                  <div className="flex items-center gap-1 pl-2">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-9 w-9 hover:bg-accent/10"
                            onClick={handleArchiveList}
                          >
                            <Archive className="w-4 h-4 text-accent" />
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
                              className="h-9 w-9 hover:bg-accent/10"
                              onClick={handleUnarchiveList}
                            >
                              <ArchiveRestore className="w-4 h-4 text-accent" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Restore from Archive</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                    <AlertDialog>
                      <TooltipProvider>
                        <Tooltip>
                          <AlertDialogTrigger asChild>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-9 w-9 hover:bg-red-50">
                                <Trash2 className="w-4 h-4 text-red-600" />
                              </Button>
                            </TooltipTrigger>
                          </AlertDialogTrigger>
                          <TooltipContent>Delete list</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete this list? You can
                            undo this action for a few seconds after deletion.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="bg-muted hover:bg-primary/10">
                            Cancel
                          </AlertDialogCancel>
                          <AlertDialogAction
                            onClick={handleDeleteList}
                            className="bg-red-600 hover:bg-red-700"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                )}
              </div>

              {/* Mobile Menu */}
              <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
                <SheetTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="md:hidden min-h-[44px] min-w-[44px] flex-shrink-0"
                  >
                    <Menu className="w-6 h-6" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-[280px] overflow-y-auto">
                  <div className="flex flex-col gap-2 mt-8">
                    {/* View Mode Toggle - Mobile */}
                    <div className="flex items-center bg-muted rounded-lg p-1 mb-2">
                      <Button
                        variant={localStorage.getItem("dashboardViewMode") === "dashboard" || !localStorage.getItem("dashboardViewMode") ? "default" : "ghost"}
                        size="sm"
                        className="h-8 flex-1"
                        onClick={() => {
                          localStorage.setItem("dashboardViewMode", "dashboard");
                          setIsMobileMenuOpen(false);
                          navigate("/dashboard");
                        }}
                      >
                        <LayoutDashboard className="w-4 h-4 mr-1" />
                        Dashboard
                      </Button>
                      <Button
                        variant={localStorage.getItem("dashboardViewMode") === "list" ? "default" : "ghost"}
                        size="sm"
                        className="h-8 flex-1"
                        onClick={() => {
                          localStorage.setItem("dashboardViewMode", "list");
                          setIsMobileMenuOpen(false);
                          navigate("/dashboard");
                        }}
                      >
                        <ListIcon className="w-4 h-4 mr-1" />
                        List
                      </Button>
                    </div>

                    {/* Primary Actions */}
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-1">Primary</p>
                    {effectiveTier === "free" ? (
                      <Button
                        variant="outline"
                        onClick={() => {
                          handlePrint();
                          setIsMobileMenuOpen(false);
                        }}
                        className="w-full justify-start min-h-[44px] print:hidden"
                      >
                        <Printer className="w-4 h-4 mr-2" />
                        Print List
                      </Button>
                    ) : (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="outline"
                            disabled={isExporting}
                            className="w-full justify-start min-h-[44px]"
                          >
                            <Download className="w-4 h-4 mr-2" />
                            Export
                            <ChevronDown className="w-4 h-4 ml-auto" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-56">
                          {getAvailableExportFormats(effectiveTier).map((format) => (
                            <DropdownMenuItem key={format} onClick={() => { handleExport(format as "csv" | "txt" | "pdf"); setIsMobileMenuOpen(false); }}>
                              Export as {format.toUpperCase()}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}

                    {/* Secondary Actions */}
                    <div className="border-t border-gray-200 my-2" />
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-1">Actions</p>
                    
                    {/* Open source registry Button - Mobile - only for The Knot and MyRegistry lists */}
                    {(() => {
                      const isTheKnot = list.source?.startsWith('theknot:');
                      const isMyRegistry = list.source?.startsWith('myregistry:');
                      
                      // Only show for registry sources
                      if (!isTheKnot && !isMyRegistry) return null;
                      
                      const registryUrl = isTheKnot 
                        ? list.source?.replace(/^theknot:/, '') 
                        : list.source?.replace(/^myregistry:/, '');
                      
                      const handleCopyRegistryLink = async () => {
                        try {
                          await navigator.clipboard.writeText(registryUrl!);
                          toast({
                            title: "Copied!",
                            description: "Registry link copied to clipboard",
                          });
                        } catch {
                          toast({
                            title: "Copy failed",
                            description: "Could not copy. Please copy from the address bar.",
                            variant: "destructive",
                          });
                        }
                      };
                      
                      if (registryUrl) {
                        return (
                          <>
                            <Button
                              variant="outline"
                              onClick={() => {
                                window.open(registryUrl, '_blank', 'noopener,noreferrer');
                                setIsMobileMenuOpen(false);
                              }}
                              className="w-full justify-start min-h-[44px]"
                            >
                              <ExternalLink className="w-4 h-4 mr-2" />
                              Open source registry
                            </Button>
                            
                            <Button
                              variant="outline"
                              onClick={() => {
                                handleCopyRegistryLink();
                                setIsMobileMenuOpen(false);
                              }}
                              className="w-full justify-start min-h-[44px]"
                            >
                              <Copy className="w-4 h-4 mr-2" />
                              Copy Registry Link
                            </Button>
                          </>
                        );
                      }
                      return null;
                    })()}
                    
                    {/* Favorite Toggle - Mobile */}
                    <Button
                      variant="outline"
                      onClick={async () => {
                        await toggleFavorite(list.id);
                        toast({
                          title: list.isFavorite ? "Removed from favorites" : "Added to favorites",
                          description: list.isFavorite ? `"${list.title}" removed from favorites` : `"${list.title}" added to favorites`,
                        });
                        setIsMobileMenuOpen(false);
                      }}
                      className={`w-full justify-start min-h-[44px] ${list.isFavorite ? "bg-muted border-border" : ""}`}
                    >
                      <Star className={`w-4 h-4 mr-2 ${list.isFavorite ? "text-amber-500 fill-amber-500" : ""}`} />
                      {list.isFavorite ? "Remove from Favorites" : "Add to Favorites"}
                    </Button>
                    {/* Mobile share buttons - only for owners with paid tier */}
                    {isOwner && canShareLists(effectiveTier) && (
                      <>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setIsShareSettingsOpen(true);
                            setIsMobileMenuOpen(false);
                          }}
                          className={`w-full justify-start min-h-[44px] ${list.isShared ? "bg-primary/10 border-primary/20" : ""}`}
                        >
                          <Share2 className={`w-4 h-4 mr-2 ${list.isShared ? "text-primary" : ""}`} />
                          {list.isShared ? "Share Settings" : "Share options"}
                        </Button>
                        {canInviteGuests(effectiveTier) && (
                          <Button
                            variant="outline"
                            onClick={() => {
                              setIsGuestManagementOpen(true);
                              setIsMobileMenuOpen(false);
                            }}
                            className="w-full justify-start min-h-[44px]"
                          >
                            <Users className="w-4 h-4 mr-2" />
                            Manage Guests
                          </Button>
                        )}
                        {canHaveTeamMembers(effectiveTier) && (
                          <Button
                            variant="outline"
                            onClick={() => {
                              setIsTeamManagementOpen(true);
                              setIsMobileMenuOpen(false);
                            }}
                            className="w-full justify-start min-h-[44px]"
                          >
                            <Users className="w-4 h-4 mr-2" />
                            Manage Team
                          </Button>
                        )}
                      </>
                    )}

                    <Button
                      variant={isSelectMode ? "default" : "outline"}
                      onClick={() => {
                        setIsSelectMode(!isSelectMode);
                        if (isSelectMode) setSelectedItems(new Set());
                        setIsMobileMenuOpen(false);
                      }}
                      className="w-full justify-start min-h-[44px]"
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      {isSelectMode ? "Done Selecting" : "Select Multiple"}
                    </Button>

                    {/* Utility Actions */}
                    <div className="border-t border-gray-200 my-2" />
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-1">More</p>
                    
                    {isRegistryOrWishlistType && (
                      <>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setIsPurchaseHistoryOpen(true);
                            setIsMobileMenuOpen(false);
                          }}
                          className="w-full justify-start min-h-[44px]"
                        >
                          <ShoppingCart className="w-4 h-4 mr-2" />
                          Purchase History
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setIsUpdateFromRetailerOpen(true);
                            setIsMobileMenuOpen(false);
                          }}
                          className="w-full justify-start min-h-[44px]"
                        >
                          <RefreshCw className="w-4 h-4 mr-2" />
                          Update from Retailer
                        </Button>
                      </>
                    )}
                    {isOwner && (
                      <Button
                        variant="outline"
                        onClick={() => {
                          openEditListDialog();
                          setIsMobileMenuOpen(false);
                        }}
                        className="w-full justify-start min-h-[44px]"
                      >
                        <Edit className="w-4 h-4 mr-2" />
                        Edit List
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      onClick={() => {
                        setIsHelpModalOpen(true);
                        setIsMobileMenuOpen(false);
                      }}
                      className="w-full justify-start min-h-[44px]"
                    >
                      <HelpCircle className="w-4 h-4 mr-2" />
                      Help & Support
                    </Button>

                    {/* Destructive Actions (Owner only) */}
                    {isOwner && (
                      <>
                        <div className="border-t border-gray-200 my-2" />
                        <Button
                          variant="outline"
                          onClick={() => {
                            handleArchiveList();
                            setIsMobileMenuOpen(false);
                          }}
                          className="w-full justify-start min-h-[44px] text-accent hover:text-accent hover:bg-accent/10"
                        >
                          <Archive className="w-4 h-4 mr-2" />
                          Archive List
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="destructive"
                              className="w-full justify-start min-h-[44px]"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete List
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete this list? You can
                                undo this action for a few seconds after deletion.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel className="bg-muted hover:bg-primary/10 min-h-[44px]">
                                Cancel
                              </AlertDialogCancel>
                              <AlertDialogAction
                                onClick={handleDeleteList}
                                className="bg-red-600 hover:bg-red-700 min-h-[44px]"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </>
                    )}
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </header>

        {/* Print-only header with list title */}
        <div className="hidden print:block px-8 py-6 border-b border-gray-200">
          <h1 className="text-2xl font-bold text-gray-900">{list.title}</h1>
          {list.description && (
            <p className="text-gray-600 mt-2">{list.description}</p>
          )}
          <p className="text-sm text-gray-500 mt-2">
            {list.items.length} items • Printed on {new Date().toLocaleDateString()}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Guest Access Banner */}
          {list.isGuestAccess && (
            <div className="bg-teal-50 border-b border-teal-200 px-4 sm:px-6 lg:px-8 py-2 print:hidden">
              <p className="text-sm text-teal-700 text-center">
                {canEditListItems 
                  ? "📝 Guest access: You can add, edit, and remove items."
                  : "👁️ Guest access: View-only."}
              </p>
            </div>
          )}
          
          {/* Sticky Add Item Section */}
          <div className="sticky top-0 z-10 bg-gradient-to-br from-primary/10 via-white to-secondary/10 px-4 sm:px-6 lg:px-8 pt-4 pb-2 print:hidden">
            {/* Bulk Actions Toolbar */}
          {isSelectMode && (
            <Card className="p-3 sm:p-4 mb-4 bg-primary/10 border-primary/20 print:hidden">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                    <p className="text-sm font-semibold text-primary">
                      {selectedItems.size} item
                      {selectedItems.size !== 1 ? "s" : ""} selected
                    </p>
                  </div>
                  <p className="text-xs text-gray-600 hidden sm:block">
                    Click items to select, then use actions below
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleSelectAll}
                    className="min-h-[36px] bg-white hover:bg-primary/5"
                  >
                    {selectedItems.size === list.items.length
                      ? "Deselect All"
                      : "Select All"}
                  </Button>
                </div>
                {selectedItems.size > 0 && (
                  <div className="flex flex-col sm:flex-row gap-2">
                    {(() => {
                      const selectedItemsList = list.items.filter(item => selectedItems.has(item.id));
                      const hasIncompleteItems = selectedItemsList.some(item => !item.completed);
                      const allCompleted = selectedItemsList.every(item => item.completed);
                      
                      return (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="w-full sm:w-auto">
                                <Button
                                  size="sm"
                                  onClick={handleBulkComplete}
                                  disabled={allCompleted}
                                  className={`min-h-[44px] w-full sm:w-auto ${
                                    allCompleted 
                                      ? "bg-muted text-muted-foreground cursor-not-allowed" 
                                      : "bg-accent hover:bg-accent/90 text-white"
                                  }`}
                                >
                                  <CheckSquare className="w-4 h-4 mr-2" />
                                  Mark Complete
                                </Button>
                              </span>
                            </TooltipTrigger>
                            {allCompleted && (
                              <TooltipContent>
                                <p>All selected items are already completed</p>
                              </TooltipContent>
                            )}
                          </Tooltip>
                        </TooltipProvider>
                      );
                    })()}
                    <Button
                      size="sm"
                      onClick={handleBulkDelete}
                      className="min-h-[44px] w-full sm:w-auto bg-destructive hover:bg-destructive/90 text-white"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete Selected
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setIsSelectMode(false);
                        setSelectedItems(new Set());
                      }}
                      className="min-h-[44px] w-full sm:w-auto bg-muted hover:bg-primary/10 text-foreground"
                    >
                      <X className="w-4 h-4 mr-2" />
                      Cancel
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* Add Item - Only show if user can edit items */}
          {canEditListItems ? (
            <Card className="p-0 mb-4 sm:mb-6 print:hidden">
              <div className="p-3 sm:p-4">
                <div className="space-y-3">
                  {/* Mode Toggle */}
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Add Item Mode</Label>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Quick</span>
                      <Switch
                        checked={detailedMode}
                        onCheckedChange={setDetailedMode}
                      />
                      <span className="text-xs text-muted-foreground">
                        Detailed
                      </span>
                  </div>
                </div>

                {/* Item Limit Warning */}
                {itemLimitReached && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      You've reached your item limit ({user?.itemsPerListLimit === -1 ? "∞" : user?.itemsPerListLimit}{" "}
                      items). Upgrade to add more items.
                    </AlertDescription>
                  </Alert>
                )}

                {/* CUSTOM LIST - Simple fields */}
                {effectiveListType === "custom" && (
                  <>
                    {/* Section dropdown for sectioned custom lists (Recipe, Vacation Packing, etc.) */}
                    {isSectioned && (
                      <div className="mb-2">
                        <Label className="text-xs mb-2">Section</Label>
                        <Select
                          value={newItemSection || availableSections[0] || "OTHER"}
                          onValueChange={handleSectionChange}
                        >
                          <SelectTrigger className="min-h-[44px]">
                            <SelectValue placeholder="Select section" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableSections.map((section) => (
                              <SelectItem key={section} value={section}>
                                {(section ?? 'OTHER').trim().toUpperCase()}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    {!detailedMode && (
                      <div className="space-y-2">
                        <Input
                          placeholder="Item name"
                          value={newItemText}
                          onChange={(e) => setNewItemText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleAddItem();
                            }
                          }}
                          className="min-h-[44px]"
                        />
                      </div>
                    )}
                    {detailedMode && (
                      <div className="space-y-3">
                        <Input
                          placeholder="Item name"
                          value={newItemText}
                          onChange={(e) => setNewItemText(e.target.value)}
                          className="min-h-[44px]"
                        />
                        <Textarea
                          placeholder="Notes (optional)"
                          value={newItemNotes}
                          onChange={(e) => setNewItemNotes(e.target.value)}
                          className="min-h-[80px]"
                        />
                      </div>
                    )}
                  </>
                )}

                {/* TO-DO LIST - Task fields */}
                {isTodo && (
                  <>
                    {/* Section dropdown for sectioned todo lists */}
                    {isSectioned && (
                      <div className="mb-2">
                        <Label className="text-xs mb-2">Section</Label>
                        <Select
                          value={newItemSection || "OTHER"}
                          onValueChange={handleSectionChange}
                        >
                          <SelectTrigger className="min-h-[44px]">
                            <SelectValue placeholder="Select section" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableSections.map((section) => (
                              <SelectItem key={section} value={section}>
                                {(section ?? 'OTHER').trim().toUpperCase()}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    {!detailedMode && (
                      <div className="space-y-2">
                        <Input
                          placeholder="Task name"
                          value={newItemText}
                          onChange={(e) => setNewItemText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleAddItem();
                            }
                          }}
                          className="min-h-[44px]"
                        />
                      </div>
                    )}
                    {detailedMode && (
                      <div className="space-y-3">
                        <Input
                          placeholder="Task name"
                          value={newItemText}
                          onChange={(e) => setNewItemText(e.target.value)}
                          className="min-h-[44px]"
                        />
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label className="text-xs mb-2">Due Date</Label>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button
                                  variant="outline"
                                  className="w-full justify-start min-h-[44px]"
                                >
                                  <Calendar className="mr-2 h-4 w-4" />
                                  {newItemDueDate ? (
                                    format(newItemDueDate, "PPP")
                                  ) : (
                                    <span className="text-gray-400">Pick date</span>
                                  )}
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0">
                                <CalendarComponent
                                  mode="single"
                                  selected={newItemDueDate}
                                  onSelect={setNewItemDueDate}
                                  initialFocus
                                />
                              </PopoverContent>
                            </Popover>
                          </div>
                          <div>
                            <Label className="text-xs mb-2">Priority</Label>
                            <Select
                              value={newItemPriority || ""}
                              onValueChange={(value) =>
                                setNewItemPriority(value as "high" | "medium" | "low")
                              }
                            >
                              <SelectTrigger className="min-h-[44px]">
                                <SelectValue placeholder="Select priority" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="high">High</SelectItem>
                                <SelectItem value="medium">Medium</SelectItem>
                                <SelectItem value="low">Low</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs mb-2">Status</Label>
                          <Select
                            value={newItemStatus || ""}
                            onValueChange={setNewItemStatus}
                          >
                            <SelectTrigger className="min-h-[44px]">
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="not-started">Not started</SelectItem>
                              <SelectItem value="in-progress">In progress</SelectItem>
                              <SelectItem value="completed">Completed</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <Textarea
                          placeholder="Notes (optional)"
                          value={newItemNotes}
                          onChange={(e) => setNewItemNotes(e.target.value)}
                          className="min-h-[80px]"
                        />
                      </div>
                    )}
                  </>
                )}

                {/* GROCERY LIST - Grocery fields */}
                {isGrocery && (
                  <>
                    {!detailedMode && (
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          placeholder="Qty"
                          value={newItemQuantity || ""}
                          onChange={(e) =>
                            setNewItemQuantity(e.target.value ? parseInt(e.target.value) : undefined)
                          }
                          className="w-20 min-h-[44px]"
                          min="1"
                        />
                        <Input
                          placeholder="Item name"
                          value={newItemText}
                          onChange={(e) => setNewItemText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleAddItem();
                            }
                          }}
                          className="flex-1 min-h-[44px]"
                        />
                      </div>
                    )}
                    {detailedMode && (
                      <div className="space-y-3">
                        {/* Row 1: Item name (full width) */}
                        <Input
                          placeholder="Item name"
                          value={newItemText}
                          onChange={(e) => setNewItemText(e.target.value)}
                          className="min-h-[44px]"
                        />
                        {/* Row 2: Category (left 50%) + Quantity (right 50%) */}
                        <div className="grid grid-cols-2 gap-3">
                          {isCategorized && (
                            <div>
                              <Label className="text-xs mb-2">Category</Label>
                              <Select
                                value={newItemGroceryCategory || "Other"}
                                onValueChange={handleGroceryCategoryChange}
                              >
                                <SelectTrigger className="min-h-[44px]">
                                  <SelectValue placeholder="Select category" />
                                </SelectTrigger>
                                <SelectContent>
                                  {availableCategories.map((category) => (
                                    <SelectItem key={category} value={category}>
                                      {category}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                          <div>
                            <Label className="text-xs mb-2">Quantity</Label>
                            <Input
                              type="number"
                              placeholder="1"
                              value={newItemQuantity || ""}
                              onChange={(e) =>
                                setNewItemQuantity(e.target.value ? parseInt(e.target.value) : undefined)
                              }
                              className="min-h-[44px]"
                              min="1"
                            />
                          </div>
                        </div>
                        {/* Row 3: Unit (left 50%) + Est. Price (right 50%) */}
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label className="text-xs mb-2">Unit</Label>
                            <Select
                              value={newItemUnit || ""}
                              onValueChange={setNewItemUnit}
                            >
                              <SelectTrigger className="min-h-[44px]">
                                <SelectValue placeholder="Select unit" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="lbs">lbs</SelectItem>
                                <SelectItem value="oz">oz</SelectItem>
                                <SelectItem value="count">count</SelectItem>
                                <SelectItem value="liters">liters</SelectItem>
                                <SelectItem value="ml">ml</SelectItem>
                                <SelectItem value="cups">cups</SelectItem>
                                <SelectItem value="tbsp">tbsp</SelectItem>
                                <SelectItem value="tsp">tsp</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-xs mb-2">Est. Price</Label>
                            <Input
                              type="number"
                              placeholder="0.00"
                              value={newItemPrice || ""}
                              onChange={(e) =>
                                setNewItemPrice(e.target.value ? parseFloat(e.target.value) : undefined)
                              }
                              className="min-h-[44px]"
                              step="0.01"
                              min="0"
                            />
                          </div>
                        </div>
                        {/* Notes (full width) */}
                        <Textarea
                          placeholder="Notes (optional)"
                          value={newItemNotes}
                          onChange={(e) => setNewItemNotes(e.target.value)}
                          className="min-h-[80px]"
                        />
                      </div>
                    )}
                  </>
                )}

                {/* REGISTRY LIST - Registry fields (Baby Registry, Wedding Registry, etc.) */}
                {isRegistryOrWishlistType && (
                  <>
                    {/* Section dropdown for sectioned registry lists */}
                    {isSectioned && (
                      <div className="mb-2">
                        <Label className="text-xs mb-2">Section</Label>
                        <Select
                          value={newItemSection || "OTHER"}
                          onValueChange={(value) => {
                            setNewItemSection(value);
                            if (list?.id) {
                              localStorage.setItem(`listmine:lastSection:${list.id}`, value);
                            }
                          }}
                        >
                          <SelectTrigger className="min-h-[44px]">
                            <SelectValue placeholder="Select section" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableSections.map((section) => (
                              <SelectItem key={section} value={section}>
                                {(section ?? 'OTHER').trim().toUpperCase()}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    {!detailedMode && (
                      <div className="space-y-2">
                        <Input
                          placeholder="Item name"
                          value={newItemText}
                          onChange={(e) => setNewItemText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleAddItem();
                            }
                          }}
                          className="min-h-[44px]"
                        />
                      </div>
                    )}
                    {detailedMode && (
                      <div className="space-y-3">
                        <Input
                          placeholder="Item name"
                          value={newItemText}
                          onChange={(e) => setNewItemText(e.target.value)}
                          className="min-h-[44px]"
                        />
                        <div>
                          <Label className="text-xs mb-2">Product Link (optional)</Label>
                          <Input
                            type="url"
                            placeholder="https://example.com/product"
                            value={newItemProductLink}
                            onChange={(e) => setNewItemProductLink(e.target.value)}
                            className="min-h-[44px]"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label className="text-xs mb-2">Price</Label>
                            <Input
                              type="number"
                              placeholder="0.00"
                              value={newItemPrice || ""}
                              onChange={(e) =>
                                setNewItemPrice(e.target.value ? parseFloat(e.target.value) : undefined)
                              }
                              className="min-h-[44px]"
                              step="0.01"
                              min="0"
                            />
                          </div>
                          <div>
                            <Label className="text-xs mb-2">Quantity</Label>
                            <Input
                              type="number"
                              placeholder="1"
                              value={newItemQuantity || ""}
                              onChange={(e) =>
                                setNewItemQuantity(e.target.value ? parseInt(e.target.value) : undefined)
                              }
                              className="min-h-[44px]"
                              min="1"
                            />
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs mb-2">Link Title (optional)</Label>
                          <Input
                            type="text"
                            placeholder="e.g., Sterling Silver Ring"
                            value={newItemLinkTitle}
                            onChange={(e) => setNewItemLinkTitle(e.target.value)}
                            className="min-h-[44px]"
                          />
                        </div>
                        <div>
                          <Label className="text-xs mb-2">Link Description (optional)</Label>
                          <Textarea
                            placeholder="e.g., Beautiful handcrafted ring"
                            value={newItemLinkDescription}
                            onChange={(e) => setNewItemLinkDescription(e.target.value)}
                            className="min-h-[60px]"
                          />
                        </div>
                        <div>
                          <Label className="text-xs mb-2">Link Image URL (optional)</Label>
                          <Input
                            type="url"
                            placeholder="e.g., https://example.com/image.jpg"
                            value={newItemLinkImage}
                            onChange={(e) => setNewItemLinkImage(e.target.value)}
                            className="min-h-[44px]"
                          />
                        </div>
                        <div>
                          <Label className="text-xs mb-2">Purchase Status</Label>
                          <Select
                            value={newItemStatus || ""}
                            onValueChange={setNewItemStatus}
                          >
                            <SelectTrigger className="min-h-[44px]">
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="not-purchased">Not purchased</SelectItem>
                              <SelectItem value="purchased">Purchased</SelectItem>
                              <SelectItem value="received">Received</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <Textarea
                          placeholder="Notes (optional)"
                          value={newItemNotes}
                          onChange={(e) => setNewItemNotes(e.target.value)}
                          className="min-h-[80px]"
                        />
                      </div>
                    )}
                  </>
                )}

                {/* SHOPPING LIST - Shopping fields (NO purchaser UI, simpler than registry) */}
                {isShoppingList && !isGrocery && (
                  <>
                    {!detailedMode && (
                      <div className="space-y-2">
                        <Input
                          placeholder="Item name"
                          value={newItemText}
                          onChange={(e) => setNewItemText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleAddItem();
                            }
                          }}
                          className="min-h-[44px]"
                        />
                      </div>
                    )}
                    {detailedMode && (
                      <div className="space-y-3">
                        <Input
                          placeholder="Item name"
                          value={newItemText}
                          onChange={(e) => setNewItemText(e.target.value)}
                          className="min-h-[44px]"
                        />
                        <div>
                          <Label className="text-xs mb-2">Product Link (optional)</Label>
                          <Input
                            type="url"
                            placeholder="https://example.com/product"
                            value={newItemProductLink}
                            onChange={(e) => setNewItemProductLink(e.target.value)}
                            className="min-h-[44px]"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label className="text-xs mb-2">Price</Label>
                            <Input
                              type="number"
                              placeholder="0.00"
                              value={newItemPrice || ""}
                              onChange={(e) =>
                                setNewItemPrice(e.target.value ? parseFloat(e.target.value) : undefined)
                              }
                              className="min-h-[44px]"
                              step="0.01"
                              min="0"
                            />
                          </div>
                          <div>
                            <Label className="text-xs mb-2">Quantity</Label>
                            <Input
                              type="number"
                              placeholder="1"
                              value={newItemQuantity || ""}
                              onChange={(e) =>
                                setNewItemQuantity(e.target.value ? parseInt(e.target.value) : undefined)
                              }
                              className="min-h-[44px]"
                              min="1"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label className="text-xs mb-2">Link Title (optional)</Label>
                            <Input
                              type="text"
                              placeholder="e.g., Wireless Headphones"
                              value={newItemLinkTitle}
                              onChange={(e) => setNewItemLinkTitle(e.target.value)}
                              className="min-h-[44px]"
                            />
                          </div>
                          <div>
                            <Label className="text-xs mb-2">Link Description (optional)</Label>
                            <Textarea
                              placeholder="e.g., Noise-canceling over-ear headphones"
                              value={newItemLinkDescription}
                              onChange={(e) => setNewItemLinkDescription(e.target.value)}
                              className="min-h-[60px]"
                            />
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs mb-2">Link Image URL (optional)</Label>
                          <Input
                            type="url"
                            placeholder="e.g., https://example.com/image.jpg"
                            value={newItemLinkImage}
                            onChange={(e) => setNewItemLinkImage(e.target.value)}
                            className="min-h-[44px]"
                          />
                        </div>
                        <div>
                          <Label className="text-xs mb-2">Purchase Status</Label>
                          <Select
                            value={newItemStatus || ""}
                            onValueChange={setNewItemStatus}
                          >
                            <SelectTrigger className="min-h-[44px]">
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="not-purchased">Not purchased</SelectItem>
                              <SelectItem value="purchased">Purchased</SelectItem>
                              <SelectItem value="received">Received</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <Textarea
                          placeholder="Notes (optional)"
                          value={newItemNotes}
                          onChange={(e) => setNewItemNotes(e.target.value)}
                          className="min-h-[80px]"
                        />
                      </div>
                    )}
                  </>
                )}

                {/* IDEA LIST - Idea fields */}
                {isIdea && (
                  <>
                    {/* Section dropdown for sectioned idea lists */}
                    {isSectioned && (
                      <div className="mb-2">
                        <Label className="text-xs mb-2">Section</Label>
                        <Select
                          value={newItemSection || "OTHER"}
                          onValueChange={handleSectionChange}
                        >
                          <SelectTrigger className="min-h-[44px]">
                            <SelectValue placeholder="Select section" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableSections.map((section) => (
                              <SelectItem key={section} value={section}>
                                {(section ?? 'OTHER').trim().toUpperCase()}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    {!detailedMode && (
                      <div className="space-y-2">
                        <Input
                          placeholder="Idea title"
                          value={newItemText}
                          onChange={(e) => setNewItemText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleAddItem();
                            }
                          }}
                          className="min-h-[44px]"
                        />
                      </div>
                    )}
                    {detailedMode && (
                      <div className="space-y-3">
                        <Input
                          placeholder="Idea title"
                          value={newItemText}
                          onChange={(e) => setNewItemText(e.target.value)}
                          className="min-h-[44px]"
                        />
                        <div>
                          <Label className="text-xs mb-2">Inspiration Link (optional)</Label>
                          <Input
                            type="url"
                            placeholder="https://example.com/inspiration"
                            value={newItemProductLink}
                            onChange={(e) => setNewItemProductLink(e.target.value)}
                            className="min-h-[44px]"
                          />
                        </div>
                        <div>
                          <Label className="text-xs mb-2">Link Title (optional)</Label>
                          <Input
                            type="text"
                            placeholder="e.g., Modern Kitchen Design"
                            value={newItemLinkTitle}
                            onChange={(e) => setNewItemLinkTitle(e.target.value)}
                            className="min-h-[44px]"
                          />
                        </div>
                        <div>
                          <Label className="text-xs mb-2">Link Description (optional)</Label>
                          <Textarea
                            placeholder="e.g., Minimalist kitchen with marble countertops"
                            value={newItemLinkDescription}
                            onChange={(e) => setNewItemLinkDescription(e.target.value)}
                            className="min-h-[60px]"
                          />
                        </div>
                        <div>
                          <Label className="text-xs mb-2">Link Image URL (optional)</Label>
                          <Input
                            type="url"
                            placeholder="e.g., https://example.com/image.jpg"
                            value={newItemLinkImage}
                            onChange={(e) => setNewItemLinkImage(e.target.value)}
                            className="min-h-[44px]"
                          />
                        </div>
                        <div>
                          <Label className="text-xs mb-2">Status</Label>
                          <Select
                            value={newItemStatus || ""}
                            onValueChange={setNewItemStatus}
                          >
                            <SelectTrigger className="min-h-[44px]">
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="brainstorm">Brainstorm</SelectItem>
                              <SelectItem value="in-progress">In progress</SelectItem>
                              <SelectItem value="completed">Completed</SelectItem>
                              <SelectItem value="on-hold">On hold</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <Textarea
                          placeholder="Notes (optional)"
                          value={newItemNotes}
                          onChange={(e) => setNewItemNotes(e.target.value)}
                          className="min-h-[80px]"
                        />
                      </div>
                    )}
                  </>
                )}

                {/* Add Item Button */}
                <Button onClick={handleAddItem} className="w-full min-h-[44px] bg-primary hover:bg-primary/90">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Item
                </Button>
              </div>
            </div>
          </Card>
          ) : (
            <Card className="p-4 mb-4 sm:mb-6 print:hidden bg-muted border-border">
              <p className="text-sm text-muted-foreground text-center">
                {list.isGuestAccess 
                  ? "Guest access: You have view-only access. Contact the list owner to request edit permissions."
                  : "You have view-only access to this list."}
              </p>
            </Card>
          )}
          </div>

          {/* Scrollable Content Area */}
          <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
            {/* Items Header with Tags and Sort */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 print:hidden">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-medium text-gray-700">Items</h3>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-2 min-w-0 w-full items-start sm:items-center">
              {/* Tags Dropdown */}
              <Popover open={isTagsSectionOpen} onOpenChange={setIsTagsSectionOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-[40px] gap-2 flex-shrink-0">
                    <Tag className="w-4 h-4" />
                    Tags
                    <Badge variant="secondary" className="text-xs ml-1">
                      {list.tags?.length || 0}
                    </Badge>
                    <ChevronDown 
                      className={`w-4 h-4 transition-transform ${isTagsSectionOpen ? 'rotate-180' : ''}`} 
                    />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80" align="end">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-medium">Tags</h4>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <HelpCircle className="w-4 h-4 text-gray-400 cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="max-w-xs">
                              Add keywords to organize and filter items
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {list.tags && list.tags.length > 0 ? (
                        list.tags.map((tag) => (
                          <Badge key={tag} variant="outline" className="text-xs">
                            {tag}
                            <button
                              onClick={() => removeTagFromList(list.id, tag)}
                              className="ml-1 hover:text-red-600"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </Badge>
                        ))
                      ) : (
                        <p className="text-xs text-gray-500">No tags yet</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Input
                        placeholder="e.g., urgent, work"
                        value={newTag}
                        onChange={(e) => setNewTag(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleAddTag();
                          }
                        }}
                        className="flex-1 min-h-[40px]"
                      />
                      <Button onClick={handleAddTag} size="sm" className="min-h-[40px]">
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>

              {/* Sort Dropdown */}
              <Select value={itemSortBy} onValueChange={handleItemSortChange}>
                <SelectTrigger className="w-full sm:w-[220px] h-[40px] flex-shrink-0">
                  <SelectValue placeholder="Sort items by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual (drag to reorder)</SelectItem>
                  <SelectItem value="priority">Priority</SelectItem>
                  <SelectItem value="dueDate">Due Date</SelectItem>
                  <SelectItem value="alphabetical">Alphabetical</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Purchase History Note - ONLY for Registry/Wishlist (purchaser tracking) */}
          {isRegistryOrWishlistType && (
            <Alert className="mb-4 bg-primary/10 border-primary/20">
              <ShoppingCart className="h-4 w-4 text-primary" />
              <AlertDescription className="text-sm text-primary">
                <strong>Tip:</strong> Open Purchase History to see purchaser details for items marked as purchased.
              </AlertDescription>
            </Alert>
          )}

          {/* Items List */}
          <div className="space-y-2">
            {list.items.length === 0 ? (
              <Card className="p-8 sm:p-16 text-center bg-gradient-to-br from-gray-50 to-white">
                <div className="max-w-md mx-auto">
                  <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Package className="w-8 h-8 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">
                    This list is empty
                  </h3>
                  <p className="text-gray-600 mb-6">
                    Add your first item above to get started.
                  </p>
                </div>
              </Card>
            ) : isGrocery ? (
              // Grouped display for grocery lists
              Object.entries(getGroupedGroceryItems()).map(([category, categoryItems]) => (
                <div key={category} className="space-y-2">
                  <div className="flex items-center gap-2 mt-4 mb-2">
                    <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                      {categoryLabels[category] || category}
                    </h3>
                    <div className="flex-1 h-px bg-border"></div>
                    <Badge variant="outline" className="text-xs">
                      {categoryItems.length}
                    </Badge>
                  </div>
                  {categoryItems.map((item, index) => {
                    const isPurchased = isRegistryOrWishlistType && item.attributes?.purchaseStatus === "purchased";
                    const isDropTarget = dropTargetId === item.id;
                    
                    return (
                    <div key={item.id} className="relative">
                      {/* Drop indicator - before */}
                      {isDropTarget && dropPosition === "before" && itemSortBy === "manual" && (
                        <div className="absolute -top-1 left-0 right-0 h-1 bg-primary rounded-full z-10 animate-pulse" />
                      )}
                    <Card
                      className={`p-3 sm:p-4 hover:shadow-md transition-all relative ${index % 2 === 1 ? "bg-gray-50" : "bg-white"} ${draggedItem?.id === item.id ? "animate-drag-lift border-primary border-2 opacity-50" : ""} ${isDropTarget && itemSortBy === "manual" ? "ring-2 ring-primary/30" : ""}`}
                      draggable={itemSortBy === "manual" && canEditListItems}
                      onDragStart={(e) => {
                        const target = e.target as HTMLElement | null;
                        if (target?.closest("a")) return;
                        itemSortBy === "manual" && canEditListItems && handleDragStart(e, item);
                      }}
                      onClick={(e) => {
                        const target = e.target as HTMLElement | null;
                        if (target?.closest("a")) return;
                      }}
                      onMouseDown={(e) => {
                        const target = e.target as HTMLElement | null;
                        if (target?.closest("a")) return;
                      }}
                      onDragOver={(e) =>
                        itemSortBy === "manual" && handleDragOver(e, item)
                      }
                      onDragLeave={(e) =>
                        itemSortBy === "manual" && handleDragLeave(e)
                      }
                      onDrop={(e) =>
                        itemSortBy === "manual" && handleDrop(e, item)
                      }
                      onDragEnd={(e) =>
                        itemSortBy === "manual" && handleDragEnd(e)
                      }
                    >
                      <div className="flex items-start gap-2 sm:gap-3 w-full">
                        {isSelectMode && (
                          <Checkbox
                            checked={selectedItems.has(item.id)}
                            onCheckedChange={() => toggleItemSelection(item.id)}
                            className="mt-1 h-6 w-6 md:h-[18px] md:w-[18px] rounded md:rounded-[3px] mr-3 md:mr-2 flex-shrink-0"
                          />
                        )}
                        {itemSortBy === "manual" && (
                          <div className="cursor-grab active:cursor-grabbing mt-1 touch-none">
                            <GripVertical className="w-5 h-5 text-gray-400 hover:text-gray-600" />
                          </div>
                        )}
                        <Checkbox
                          checked={item.completed}
                          onCheckedChange={(checked) =>
                            updateListItem(list.id, item.id, {
                              completed: checked as boolean,
                            })
                          }
                          className={`mt-1 h-6 w-6 md:h-[18px] md:w-[18px] rounded md:rounded-[3px] mr-3 md:mr-2 flex-shrink-0 transition-transform border-gray-400 ${item.completed ? "animate-check-bounce bg-gray-700 border-gray-700" : ""}`}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-col gap-1 min-w-0 w-full">
                            <p
                              className={`text-sm sm:text-base text-gray-900 transition-all duration-200 ${item.completed ? "line-through opacity-50" : ""} break-words overflow-hidden w-full`}
                                              style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}
                            >
                              {(() => {
                                // For shopping, registry, wishlist, and grocery types, show quantity prefix when > 1
                                const qty = item.quantity || item.attributes?.quantityNeeded;
                                const showQtyTypes = isShoppingList || isRegistryOrWishlistType || isGrocery;
                                if (showQtyTypes && qty && qty > 1) {
                                  return (
                                    <span className="font-semibold text-primary">
                                      {qty}× {" "}
                                    </span>
                                  );
                                }
                                return null;
                              })()}
                              {item.text}
                            </p>
                            {item.notes && !item.completed && (
                              <p className="text-xs text-gray-500 -mt-0.5 break-words italic pointer-events-none">
                                {item.notes}
                              </p>
                            )}
                            <div className="flex items-center gap-2 flex-wrap">
                            {isPurchased && (
                              <Badge className="bg-accent/10 text-accent border-accent/20">
                                ✓ Purchased
                              </Badge>
                            )}
                            {isItemUnavailable(item) && (
                              <Badge variant="outline" className="bg-gray-100 text-gray-600 border-gray-300">
                                Unavailable
                              </Badge>
                            )}
                            {/* Price display - attributes.price or custom.price (registry imports) */}
                            {(item.attributes?.price || item.attributes?.custom?.price) && (
                              <span className="text-sm font-medium text-gray-700">
                                {(() => {
                                  const priceVal = String(item.attributes?.price || item.attributes?.custom?.price || '');
                                  return priceVal.startsWith('$') ? priceVal : `$${priceVal}`;
                                })()}
                              </span>
                            )}
                            {item.dueDate && (
                              <Badge
                                variant="outline"
                                className={`${getDueDateColor(item.dueDate)} flex items-center gap-1 text-xs`}
                              >
                                <Calendar className="w-3 h-3" />
                                {format(new Date(item.dueDate), "MMM d")}
                              </Badge>
                            )}
                            {item.assignedTo && (
                              <Badge variant="outline" className="text-xs">
                                <UserIcon className="w-3 h-3 mr-1" />
                                {item.assignedTo}
                              </Badge>
                            )}
                            {/* Note indicator only shows when notes exist but are hidden (item completed) */}
                            {item.notes && item.completed && 
                              !item.text.match(/^(Main idea|Supporting details|Action items|Follow-up needed|Resources\/links|Breakfast|Lunch|Dinner|Snack|Notes)$/) &&
                              !item.notes.match(/^(Add meal|Add snack|Add idea|Add item|Ideas for next week)/) && (
                              <Badge variant="outline" className="text-xs">
                                <FileText className="w-3 h-3 mr-1" />
                                Note
                              </Badge>
                            )}
                            </div>
                          </div>

                          {/* Grocery-specific attributes - price excluded since it's shown above */}
                          {item.attributes && (
                            <div className="flex items-center gap-2 mt-2 flex-wrap pointer-events-none">
                              {item.attributes.unit && (
                                <Badge
                                  variant="outline"
                                  className="bg-primary/10 text-primary border-primary/20 text-xs"
                                >
                                  {item.attributes.unit}
                                </Badge>
                              )}
                            </div>
                          )}

                          {/* Link Preview Card for Registry/Wishlist/Idea items - VIEW 1 */}
                          {(item.attributes?.productLink || item.attributes?.inspirationLink) && (
                            <div className="mt-3 pointer-events-none">
                              <a
                                href={item.attributes.productLink || item.attributes.inspirationLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow bg-white pointer-events-auto"
                              >
                                {item.attributes.customLinkImage && (
                                  <img
                                    src={item.attributes.customLinkImage}
                                    alt={item.attributes.customLinkTitle || "Product"}
                                    className="w-full h-32 object-cover"
                                  />
                                )}
                                <div className="p-3">
                                  <h4 className="font-semibold text-sm text-gray-900 line-clamp-2">
                                    {item.attributes.customLinkTitle || new URL(item.attributes.productLink || item.attributes.inspirationLink || "").hostname}
                                  </h4>
                                  {item.attributes.customLinkDescription && (
                                    <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                                      {item.attributes.customLinkDescription}
                                    </p>
                                  )}
                                  {!item.attributes.customLinkDescription && (
                                    <p className="text-xs text-gray-500 mt-1">
                                      Click to view
                                    </p>
                                  )}
                                  <p className="text-xs text-primary mt-2 truncate flex items-center gap-1">
                                    <ExternalLink className="w-3 h-3" />
                                    {new URL(item.attributes.productLink || item.attributes.inspirationLink || "").hostname}
                                  </p>
                                </div>
                              </a>
                            </div>
                          )}

                          {/* Universal item link actions - only show for registry/wishlist with links */}
                          {shouldShowItemLinks(item) && (
                            <div className="mt-2">
                              <ItemLinkActions item={item} />
                            </div>
                          )}
                        </div>
                        {/* VIEW 1 Actions - Standard/Category View */}
                        {!isSelectMode && canEditListItems && (
                          <div className="flex flex-col sm:flex-row items-center gap-1 shrink-0 relative z-50 pointer-events-auto">
                            <button
                              type="button"
                              className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-9 px-3"
                              onClick={(e) => {
                                const target = e.target as HTMLElement | null;
                                if (target?.closest("a")) return;
                                e.stopPropagation();
                                e.preventDefault();
                                if (import.meta.env.DEV) console.log('[DEV] VIEW 1 Edit button clicked for item:', item.id, item.text);
                                // Debug logging for image data when opening edit modal
                                console.log(`[EDIT_MODAL_DEBUG] Opening edit for "${item.text?.substring(0, 40)}" | custom.image: ${item.attributes?.custom?.image || 'MISSING'} | customLinkImage: ${item.attributes?.customLinkImage || 'MISSING'} | Full attributes:`, JSON.stringify(item.attributes, null, 2));
                                setEditingItem(item);
                                // Store original links and reset touched state
                                setOriginalItemLinks(item.links ?? null);
                                setLinkFieldTouched(false);
                                // Initialize dueDateInput from item.dueDate
                                if (item.dueDate) {
                                  const d = typeof item.dueDate === 'string' ? item.dueDate : new Date(item.dueDate).toISOString().split('T')[0];
                                  setDueDateInput(d);
                                } else {
                                  setDueDateInput('');
                                }
                                setIsEditModalOpen(true);
                              }}
                            >
                              Edit
                            </button>
                            <AlertDialog
                              open={itemToDelete === item.id}
                              onOpenChange={(open) =>
                                !open && setItemToDelete(null)
                              }
                            >
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setItemToDelete(item.id)}
                                >
                                  <Trash2 className="w-4 h-4 text-red-600" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete this item? You can
                                    undo this action for a few seconds after deletion.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel className="bg-muted hover:bg-primary/10">
                                    Cancel
                                  </AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={async () => {
                                      const itemData = { ...item };
                                      const itemText = item.text;
                                      
                                      await executeWithUndo(
                                        `delete-item-${item.id}`,
                                        itemData,
                                        async () => {
                                          await deleteListItem(list.id, item.id);
                                        },
                                        async (data) => {
                                          await restoreListItem(list.id, data);
                                        },
                                        {
                                          title: "Item deleted",
                                          description: `"${itemText}" removed from list`,
                                          undoDescription: `"${itemText}" has been restored`,
                                        }
                                      );
                                      setItemToDelete(null);
                                    }}
                                    className="bg-red-600 hover:bg-red-700"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        )}
                      </div>
                    </Card>
                    {/* Drop indicator - after */}
                    {isDropTarget && dropPosition === "after" && itemSortBy === "manual" && (
                      <div className="absolute -bottom-1 left-0 right-0 h-1 bg-primary rounded-full z-10 animate-pulse" />
                    )}
                    </div>
                    );
                  })}
                </div>
              ))
            ) : hasItemsWithSections() ? (
              // Grouped display by section (for templates with sections)
              Object.entries(getGroupedItemsBySection()).map(([section, sectionItems]) => (
                <div key={section} className="space-y-2">
                  <div className="flex items-center gap-2 mt-4 mb-2">
                    <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                      {(section ?? 'OTHER').trim().toUpperCase()}
                    </h3>
                    <div className="flex-1 h-px bg-border"></div>
                    <Badge variant="outline" className="text-xs">
                      {sectionItems.length}
                    </Badge>
                  </div>
                  {sectionItems.map((item, index) => {
                    const isPurchased = isRegistryOrWishlistType && item.attributes?.purchaseStatus === "purchased";
                    const isDropTarget = dropTargetId === item.id;
                    
                    return (
                    <div key={item.id} className="relative">
                      {/* Drop indicator - before */}
                      {isDropTarget && dropPosition === "before" && itemSortBy === "manual" && (
                        <div className="absolute -top-1 left-0 right-0 h-1 bg-primary rounded-full z-10 animate-pulse" />
                      )}
                    <Card
                      className={`p-3 sm:p-4 hover:shadow-md transition-all relative ${index % 2 === 1 ? "bg-gray-50" : "bg-white"} ${draggedItem?.id === item.id ? "animate-drag-lift border-primary border-2 opacity-50" : ""} ${isDropTarget && itemSortBy === "manual" ? "ring-2 ring-primary/30" : ""}`}
                      draggable={itemSortBy === "manual" && canEditListItems}
                      onDragStart={(e) => {
                        const target = e.target as HTMLElement | null;
                        if (target?.closest("a")) return;
                        itemSortBy === "manual" && canEditListItems && handleDragStart(e, item);
                      }}
                      onClick={(e) => {
                        const target = e.target as HTMLElement | null;
                        if (target?.closest("a")) return;
                      }}
                      onMouseDown={(e) => {
                        const target = e.target as HTMLElement | null;
                        if (target?.closest("a")) return;
                      }}
                      onDragOver={(e) =>
                        itemSortBy === "manual" && handleDragOver(e, item)
                      }
                      onDragLeave={(e) =>
                        itemSortBy === "manual" && handleDragLeave(e)
                      }
                      onDrop={(e) =>
                        itemSortBy === "manual" && handleDrop(e, item)
                      }
                      onDragEnd={(e) =>
                        itemSortBy === "manual" && handleDragEnd(e)
                      }
                    >
                      <div className="flex items-start gap-2 sm:gap-3 w-full">
                        {isSelectMode && (
                          <Checkbox
                            checked={selectedItems.has(item.id)}
                            onCheckedChange={() => toggleItemSelection(item.id)}
                            className="mt-1 h-6 w-6 md:h-[18px] md:w-[18px] rounded md:rounded-[3px] mr-3 md:mr-2 flex-shrink-0"
                          />
                        )}
                        {itemSortBy === "manual" && (
                          <div className="cursor-grab active:cursor-grabbing mt-1 touch-none">
                            <GripVertical className="w-5 h-5 text-gray-400 hover:text-gray-600" />
                          </div>
                        )}
                        <Checkbox
                          checked={item.completed}
                          onCheckedChange={(checked) =>
                            updateListItem(list.id, item.id, {
                              completed: checked as boolean,
                            })
                          }
                          className={`mt-1 h-6 w-6 md:h-[18px] md:w-[18px] rounded md:rounded-[3px] mr-3 md:mr-2 flex-shrink-0 transition-transform border-gray-400 ${item.completed ? "animate-check-bounce bg-gray-700 border-gray-700" : ""}`}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-col gap-1 min-w-0 w-full">
                            <p
                              className={`text-sm sm:text-base text-gray-900 transition-all duration-200 ${item.completed ? "line-through opacity-50" : ""} break-words overflow-hidden w-full`}
                                              style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}
                            >
                              {(() => {
                                // For shopping, registry, wishlist, and grocery types, show quantity prefix when > 1
                                const qty = item.quantity || item.attributes?.quantityNeeded;
                                const showQtyTypes = isShoppingList || isRegistryOrWishlistType || isGrocery;
                                if (showQtyTypes && qty && qty > 1) {
                                  return (
                                    <span className="font-semibold text-primary">
                                      {qty}× {" "}
                                    </span>
                                  );
                                }
                                return null;
                              })()}
                              {item.text}
                            </p>
                            {item.notes && !item.completed && (
                              <p className="text-xs text-gray-500 -mt-0.5 break-words italic pointer-events-none">
                                {item.notes}
                              </p>
                            )}
                            <div className="flex items-center gap-2 flex-wrap">
                            {isPurchased && (
                              <Badge className="bg-accent/10 text-accent border-accent/20">
                                ✓ Purchased
                              </Badge>
                            )}
                            {isItemUnavailable(item) && (
                              <Badge variant="outline" className="bg-gray-100 text-gray-600 border-gray-300">
                                Unavailable
                              </Badge>
                            )}
                            {/* Price display - attributes.price or custom.price (registry imports) */}
                            {(item.attributes?.price || item.attributes?.custom?.price) && (
                              <span className="text-sm font-medium text-gray-700">
                                {(() => {
                                  const priceVal = String(item.attributes?.price || item.attributes?.custom?.price || '');
                                  return priceVal.startsWith('$') ? priceVal : `$${priceVal}`;
                                })()}
                              </span>
                            )}
                            {item.dueDate && (
                              <Badge
                                variant="outline"
                                className={`${getDueDateColor(item.dueDate)} flex items-center gap-1 text-xs`}
                              >
                                <Calendar className="w-3 h-3" />
                                {format(new Date(item.dueDate), "MMM d")}
                              </Badge>
                            )}
                            {item.assignedTo && (
                              <Badge variant="outline" className="text-xs">
                                <UserIcon className="w-3 h-3 mr-1" />
                                {item.assignedTo}
                              </Badge>
                            )}
                            {/* Note indicator only shows when notes exist but are hidden (item completed) */}
                            {item.notes && item.completed && 
                              !item.text.match(/^(Main idea|Supporting details|Action items|Follow-up needed|Resources\/links|Breakfast|Lunch|Dinner|Snack|Notes)$/) &&
                              !item.notes.match(/^(Add meal|Add snack|Add idea|Add item|Ideas for next week)/) && (
                              <Badge variant="outline" className="text-xs">
                                <FileText className="w-3 h-3 mr-1" />
                                Note
                              </Badge>
                            )}
                            </div>
                          </div>

                          {/* Universal item link actions - only show for registry/wishlist with links */}
                          {shouldShowItemLinks(item) && (
                            <div className="mt-2">
                              <ItemLinkActions item={item} />
                            </div>
                          )}
                        </div>
                        {/* VIEW 2 Actions - Section View */}
                        {!isSelectMode && canEditListItems && (
                          <div className="flex flex-col sm:flex-row items-center gap-1 shrink-0 relative z-50 pointer-events-auto">
                            <button
                              type="button"
                              className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-9 px-3"
                              onClick={(e) => {
                                const target = e.target as HTMLElement | null;
                                if (target?.closest("a")) return;
                                e.stopPropagation();
                                e.preventDefault();
                                if (import.meta.env.DEV) console.log('[DEV] VIEW 2 Edit button clicked for item:', item.id, item.text);
                                // Debug logging for image data when opening edit modal
                                console.log(`[EDIT_MODAL_DEBUG] Opening edit for "${item.text?.substring(0, 40)}" | custom.image: ${item.attributes?.custom?.image || 'MISSING'} | customLinkImage: ${item.attributes?.customLinkImage || 'MISSING'} | Full attributes:`, JSON.stringify(item.attributes, null, 2));
                                setEditingItem(item);
                                // Store original links and reset touched state
                                setOriginalItemLinks(item.links ?? null);
                                setLinkFieldTouched(false);
                                // Initialize dueDateInput from item.dueDate
                                if (item.dueDate) {
                                  const d = typeof item.dueDate === 'string' ? item.dueDate : new Date(item.dueDate).toISOString().split('T')[0];
                                  setDueDateInput(d);
                                } else {
                                  setDueDateInput('');
                                }
                                setIsEditModalOpen(true);
                              }}
                            >
                              Edit
                            </button>
                            <AlertDialog
                              open={itemToDelete === item.id}
                              onOpenChange={(open) =>
                                setItemToDelete(open ? item.id : null)
                              }
                            >
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-red-600 hover:text-red-700"
                                >
                                  Delete
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete this item? You can
                                    undo this action for a few seconds after deletion.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel className="bg-muted hover:bg-primary/10">
                                    Cancel
                                  </AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={async () => {
                                      const itemData = { ...item };
                                      const itemText = item.text;
                                      
                                      await executeWithUndo(
                                        `delete-item-${item.id}`,
                                        itemData,
                                        async () => {
                                          await deleteListItem(list.id, item.id);
                                        },
                                        async (data) => {
                                          await restoreListItem(list.id, data);
                                        },
                                        {
                                          title: "Item deleted",
                                          description: `"${itemText}" removed from list`,
                                          undoDescription: `"${itemText}" has been restored`,
                                        }
                                      );
                                      setItemToDelete(null);
                                    }}
                                    className="bg-red-600 hover:bg-red-700"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        )}
                      </div>
                    </Card>
                    {/* Drop indicator - after */}
                    {isDropTarget && dropPosition === "after" && itemSortBy === "manual" && (
                      <div className="absolute -bottom-1 left-0 right-0 h-1 bg-primary rounded-full z-10 animate-pulse" />
                    )}
                    </div>
                    );
                  })}
                </div>
              ))
            ) : (
              // Regular display for non-grocery lists (no sections)
              (() => {
                const sortedItems = getSortedItems();
                // Purchaser UI only for registry/wishlist, NOT shopping-list
                const hasPurchasedItems = isRegistryOrWishlistType && sortedItems.some(item => item.attributes?.purchaseStatus === "purchased");
                const hasUnpurchasedItems = isRegistryOrWishlistType && sortedItems.some(item => item.attributes?.purchaseStatus !== "purchased");
                
                return sortedItems.map((item, index) => {
                  const isPurchased = item.attributes?.purchaseStatus === "purchased";
                  const prevItem = index > 0 ? sortedItems[index - 1] : null;
                  const prevIsPurchased = prevItem?.attributes?.purchaseStatus === "purchased";
                  const isFirstPurchased = isPurchased && !prevIsPurchased && isRegistryOrWishlistType;
                  
                  // Calculate continuous numbering for registry/wishlist
                  const showNumbering = isRegistryOrWishlistType;
                  const itemNumber = index + 1;
                  const isDropTarget = dropTargetId === item.id;
                  
                  return (
                    <div key={item.id} className="relative">
                      {/* Unpurchased Items header - show at the very beginning if there are both purchased and unpurchased items */}
                      {index === 0 && isRegistryOrWishlistType && hasPurchasedItems && hasUnpurchasedItems && !isPurchased && (
                        <div className="flex items-center gap-3 mb-4">
                          <div className="flex-1 h-px bg-gray-300"></div>
                          <Badge className="bg-success/10 text-success border-success/30 px-3 py-1">
                            📋 Unpurchased Items
                          </Badge>
                          <div className="flex-1 h-px bg-gray-300"></div>
                        </div>
                      )}
                      
                      {/* Divider before first purchased item */}
                      {isFirstPurchased && (
                        <div className="flex items-center gap-3 my-6">
                          <div className="flex-1 h-px bg-gray-300"></div>
                          <Badge className="bg-success/10 text-success border-success/30 px-3 py-1">
                            ✓ Purchased Items
                          </Badge>
                          <div className="flex-1 h-px bg-gray-300"></div>
                        </div>
                      )}
                    
                    {/* Drop indicator - before */}
                    {isDropTarget && dropPosition === "before" && itemSortBy === "manual" && (
                      <div className="absolute -top-1 left-0 right-0 h-1 bg-primary rounded-full z-10 animate-pulse" />
                    )}
                    
                    <Card
                      className={`p-3 sm:p-4 hover:shadow-md transition-all relative ${index % 2 === 1 ? "bg-gray-50" : "bg-white"} ${isPurchased ? "border-success/20 bg-success/5" : ""} ${draggedItem?.id === item.id ? "animate-drag-lift border-primary border-2 opacity-50" : ""} ${isDropTarget && itemSortBy === "manual" ? "ring-2 ring-primary/30" : ""}`}
                      draggable={itemSortBy === "manual" && canEditListItems}
                      onDragStart={(e) => {
                        const target = e.target as HTMLElement | null;
                        if (target?.closest("a")) return;
                        itemSortBy === "manual" && canEditListItems && handleDragStart(e, item);
                      }}
                      onClick={(e) => {
                        const target = e.target as HTMLElement | null;
                        if (target?.closest("a")) return;
                      }}
                      onMouseDown={(e) => {
                        const target = e.target as HTMLElement | null;
                        if (target?.closest("a")) return;
                      }}
                      onDragOver={(e) =>
                        itemSortBy === "manual" && handleDragOver(e, item)
                      }
                      onDragLeave={(e) =>
                        itemSortBy === "manual" && handleDragLeave(e)
                      }
                      onDrop={(e) =>
                        itemSortBy === "manual" && handleDrop(e, item)
                      }
                      onDragEnd={(e) =>
                        itemSortBy === "manual" && handleDragEnd(e)
                      }
                    >
                      <div className="flex items-start gap-2 sm:gap-3 w-full">
                        {isSelectMode && (
                          <Checkbox
                            checked={selectedItems.has(item.id)}
                            onCheckedChange={() => toggleItemSelection(item.id)}
                            className="mt-1 h-6 w-6 md:h-[18px] md:w-[18px] rounded md:rounded-[3px] mr-3 md:mr-2 flex-shrink-0"
                          />
                        )}
                        {itemSortBy === "manual" && (
                          <div className="cursor-grab active:cursor-grabbing mt-1 touch-none">
                            <GripVertical className="w-5 h-5 text-gray-400 hover:text-gray-600" />
                          </div>
                        )}
                        {showNumbering && (
                          <span className="text-sm font-semibold text-gray-500 mt-1 flex-shrink-0 min-w-[2rem]">
                            {itemNumber}.
                          </span>
                        )}
                        <Checkbox
                          checked={item.completed}
                          onCheckedChange={(checked) =>
                            updateListItem(list.id, item.id, {
                              completed: checked as boolean,
                            })
                          }
                          className={`mt-1 h-6 w-6 md:h-[18px] md:w-[18px] rounded md:rounded-[3px] mr-3 md:mr-2 flex-shrink-0 transition-transform ${item.completed ? "animate-check-bounce" : ""}`}
                        />
                        {(() => {
                          // Debug logging for Target item images
                          const customImage = item.attributes?.custom?.image;
                          const customLinkImage = item.attributes?.customLinkImage;
                          const imageUrl = customImage || customLinkImage;
                          
                          if (imageUrl || item.attributes?.custom?.tcin) {
                            console.log(`[IMAGE_DEBUG] Item "${item.text?.substring(0, 40)}" | custom.image: ${customImage || 'MISSING'} | customLinkImage: ${customLinkImage || 'MISSING'} | tcin: ${item.attributes?.custom?.tcin || 'N/A'}`);
                          }
                          
                          return imageUrl ? (
                            <img
                              src={imageUrl}
                              alt={item.text}
                              className="h-10 w-10 rounded object-cover flex-shrink-0 mr-3"
                              loading="lazy"
                              referrerPolicy="no-referrer"
                              onError={(e) => {
                                console.error(`[IMAGE_ERROR] Failed to load image for "${item.text?.substring(0, 40)}" | URL: ${imageUrl}`);
                                e.currentTarget.style.display = 'none';
                              }}
                              onLoad={() => {
                                console.log(`[IMAGE_LOADED] Successfully loaded image for "${item.text?.substring(0, 40)}"`);
                              }}
                            />
                          ) : null;
                        })()}
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-col gap-1 min-w-0 w-full">
                            <p
                              className={`text-sm sm:text-base text-gray-900 transition-all duration-200 ${item.completed ? "line-through opacity-50" : ""} break-words overflow-hidden w-full`}
                                              style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}
                            >
                              {item.quantity && (
                                <span className="font-semibold text-primary">
                                  {item.quantity}×{" "}
                                </span>
                              )}
                              {item.text}
                            </p>
                            {item.notes && !item.completed && (
                              <p className="text-xs text-gray-500 -mt-0.5 break-words italic pointer-events-none">
                                {item.notes}
                              </p>
                            )}
                            <div className="flex items-center gap-2 flex-wrap">
                            {isPurchased && (
                              <Badge className="bg-success/10 text-success border-success/30">
                                ✓ Purchased
                              </Badge>
                            )}
                            {/* Price display - attributes.price or custom.price (registry imports) */}
                            {(item.attributes?.price || item.attributes?.custom?.price) && (
                              <span className="text-sm font-medium text-gray-700">
                                {(() => {
                                  const priceVal = String(item.attributes?.price || item.attributes?.custom?.price || '');
                                  return priceVal.startsWith('$') ? priceVal : `$${priceVal}`;
                                })()}
                              </span>
                            )}
                            {item.dueDate && (
                              <Badge
                                variant="outline"
                                className={`${getDueDateColor(item.dueDate)} flex items-center gap-1 text-xs`}
                              >
                                <Calendar className="w-3 h-3" />
                                {format(new Date(item.dueDate), "MMM d")}
                              </Badge>
                            )}
                            {item.assignedTo && (
                              <Badge variant="outline" className="text-xs">
                                <UserIcon className="w-3 h-3 mr-1" />
                                {item.assignedTo}
                              </Badge>
                            )}
                            </div>
                          </div>

                          {/* Attribute Tags - price excluded since it's shown above */}
                          {item.attributes && (
                            <div className="flex items-center gap-2 mt-2 flex-wrap">
                              {item.attributes.color && (
                                <Badge
                                  variant="outline"
                                  className="bg-primary/10 text-primary border-primary/20 text-xs"
                                >
                                  Color: {item.attributes.color}
                                </Badge>
                              )}
                              {item.attributes.size && (
                                <Badge
                                  variant="outline"
                                  className="bg-success/10 text-success border-success/20 text-xs"
                                >
                                  Size: {item.attributes.size}
                                </Badge>
                              )}
                              {item.attributes.weight && (
                                <Badge
                                  variant="outline"
                                  className="bg-warning/10 text-warning border-warning/20 text-xs"
                                >
                                  Weight: {item.attributes.weight}
                                </Badge>
                              )}
                            </div>
                          )}

                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            {item.priority && (
                              <Badge
                                variant="outline"
                                className={`${priorityColors[item.priority]} text-xs`}
                              >
                                <Flag className="w-3 h-3 mr-1" />
                                {item.priority}
                              </Badge>
                            )}
                            {/* Note indicator only shows when notes exist but are hidden (item completed) */}
                            {item.notes && item.completed && 
                              !item.text.match(/^(Main idea|Supporting details|Action items|Follow-up needed|Resources\/links|Breakfast|Lunch|Dinner|Snack|Notes)$/) &&
                              !item.notes.match(/^(Add meal|Add snack|Add idea|Add item|Ideas for next week)/) && (
                              <Badge variant="outline" className="text-xs">
                                <FileText className="w-3 h-3 mr-1" />
                                Note
                              </Badge>
                            )}
                            {(item.attributes?.productLink || item.attributes?.inspirationLink) && (
                              <Badge variant="outline" className="text-xs bg-primary/10 border-primary/20">
                                <LinkIcon className="w-3 h-3 mr-1 text-primary" />
                                <span className="text-primary underline">{isIdea ? "Inspiration" : "Product"} Link</span>
                              </Badge>
                            )}
                          </div>

                          {/* Link Preview Card for Registry/Wishlist/Idea items */}
                          {(item.attributes?.productLink || item.attributes?.inspirationLink) && (
                            <div className="mt-3">
                              <a
                                href={item.attributes.productLink || item.attributes.inspirationLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow bg-white"
                              >
                                {item.attributes.customLinkImage && (
                                  <img
                                    src={item.attributes.customLinkImage}
                                    alt={item.attributes.customLinkTitle || "Product"}
                                    className="w-full h-32 object-cover"
                                  />
                                )}
                                <div className="p-3">
                                  <h4 className="font-semibold text-sm text-gray-900 line-clamp-2">
                                    {item.attributes.customLinkTitle || new URL(item.attributes.productLink || item.attributes.inspirationLink || "").hostname}
                                  </h4>
                                  {item.attributes.customLinkDescription && (
                                    <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                                      {item.attributes.customLinkDescription}
                                    </p>
                                  )}
                                  {!item.attributes.customLinkDescription && (
                                    <p className="text-xs text-gray-500 mt-1">
                                      Click to view
                                    </p>
                                  )}
                                  <p className="text-xs text-primary mt-2 truncate flex items-center gap-1">
                                    <ExternalLink className="w-3 h-3" />
                                    {new URL(item.attributes.productLink || item.attributes.inspirationLink || "").hostname}
                                  </p>
                                </div>
                              </a>
                            </div>
                          )}

                          {/* Universal item link actions - only show for registry/wishlist with links */}
                          {shouldShowItemLinks(item) && (
                            <div className="mt-2">
                              <ItemLinkActions item={item} />
                            </div>
                          )}
                        </div>
                        {/* VIEW 3 Actions - Compact View */}
                        {!isSelectMode && canEditListItems && (
                          <div className="flex flex-col sm:flex-row items-center gap-1 shrink-0 relative z-50 pointer-events-auto">
                            <button
                              type="button"
                              className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-9 px-3"
                              onClick={(e) => {
                                const target = e.target as HTMLElement | null;
                                if (target?.closest("a")) return;
                                e.stopPropagation();
                                e.preventDefault();
                                if (import.meta.env.DEV) console.log('[DEV] VIEW 3 Edit button clicked for item:', item.id, item.text);
                                // Debug logging for image data when opening edit modal
                                console.log(`[EDIT_MODAL_DEBUG] Opening edit for "${item.text?.substring(0, 40)}" | custom.image: ${item.attributes?.custom?.image || 'MISSING'} | customLinkImage: ${item.attributes?.customLinkImage || 'MISSING'} | Full attributes:`, JSON.stringify(item.attributes, null, 2));
                                setEditingItem(item);
                                // Store original links and reset touched state
                                setOriginalItemLinks(item.links ?? null);
                                setLinkFieldTouched(false);
                                // Initialize dueDateInput from item.dueDate
                                if (item.dueDate) {
                                  const d = typeof item.dueDate === 'string' ? item.dueDate : new Date(item.dueDate).toISOString().split('T')[0];
                                  setDueDateInput(d);
                                } else {
                                  setDueDateInput('');
                                }
                                setIsEditModalOpen(true);
                              }}
                            >
                              Edit
                            </button>
                            <AlertDialog
                              open={itemToDelete === item.id}
                              onOpenChange={(open) =>
                                !open && setItemToDelete(null)
                              }
                            >
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setItemToDelete(item.id)}
                                >
                                  <Trash2 className="w-4 h-4 text-red-600" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete this item? You can
                                    undo this action for a few seconds after deletion.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel className="bg-muted hover:bg-primary/10">
                                    Cancel
                                  </AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={async () => {
                                      const itemData = { ...item };
                                      const itemText = item.text;
                                      
                                      await executeWithUndo(
                                        `delete-item-${item.id}`,
                                        itemData,
                                        async () => {
                                          await deleteListItem(list.id, item.id);
                                        },
                                        async (data) => {
                                          await restoreListItem(list.id, data);
                                        },
                                        {
                                          title: "Item deleted",
                                          description: `"${itemText}" removed from list`,
                                          undoDescription: `"${itemText}" has been restored`,
                                        }
                                      );
                                      setItemToDelete(null);
                                    }}
                                    className="bg-red-600 hover:bg-red-700"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        )}
                      </div>
                    </Card>
                    {/* Drop indicator - after */}
                    {isDropTarget && dropPosition === "after" && itemSortBy === "manual" && (
                      <div className="absolute -bottom-1 left-0 right-0 h-1 bg-primary rounded-full z-10 animate-pulse" />
                    )}
                  </div>
                );
              });
              })()
            )}
          </div>
          </div>
        </div>
      </div>

      {/* Edit List Modal */}
      <Dialog open={isEditListDialogOpen} onOpenChange={setIsEditListDialogOpen}>
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
                onValueChange={(value) => setEditListCategory(value)}
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
                onValueChange={(value) => setEditListType(value)}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="custom">Custom</SelectItem>
                  <SelectItem value="todo-list">To-Do List</SelectItem>
                  <SelectItem value="grocery-list">Grocery List</SelectItem>
                  <SelectItem value="registry-list">Registry</SelectItem>
                  <SelectItem value="shopping-list">Shopping List</SelectItem>
                  <SelectItem value="idea-list">Idea List</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => setIsEditListDialogOpen(false)}
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

      {/* Purchase History Modal */}
      {isRegistryOrWishlistType && (
        <PurchaseHistoryModal
          open={isPurchaseHistoryOpen}
          onOpenChange={(open) => {
            setIsPurchaseHistoryOpen(open);
            // Refresh lists when modal closes to sync purchase statuses
            if (!open) {
              refreshLists();
            }
          }}
          listId={list.id}
          listItems={list.items.map((item) => ({ id: item.id, text: item.text }))}
          showPurchaserInfo={list.showPurchaserInfo || false}
          onTogglePurchaserInfo={handleTogglePurchaserInfo}
        />
      )}

      {/* Update from Retailer Modal */}
      {isRegistryOrWishlistType && (
        <UpdateFromRetailerModal
          open={isUpdateFromRetailerOpen}
          onOpenChange={setIsUpdateFromRetailerOpen}
          list={list}
          onAddItems={async (items) => {
            for (const item of items) {
              await addItemToList(list.id, {
                text: item.text || "",
                completed: item.completed || false,
                attributes: item.attributes,
              });
            }
            await refreshLists();
          }}
          onUpdateItems={async (updates) => {
            for (const update of updates) {
              await updateListItem(list.id, update.id, update.updates);
            }
            await refreshLists();
          }}
        />
      )}

      {/* Guest Management Dialog */}
      <Dialog open={isGuestManagementOpen} onOpenChange={setIsGuestManagementOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              Manage Guests
            </DialogTitle>
            <DialogDescription>
              Invite guests to collaborate on this list or manage existing guest access.
            </DialogDescription>
          </DialogHeader>
          <GuestManagement listId={list.id} listOwnerId={user?.id || ""} />
        </DialogContent>
      </Dialog>

      {/* Team Management Dialog */}
      <Dialog open={isTeamManagementOpen} onOpenChange={setIsTeamManagementOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              Manage Team
            </DialogTitle>
            <DialogDescription>
              Manage team members who have access to all your lists.
            </DialogDescription>
          </DialogHeader>
          <TeamManagement />
        </DialogContent>
      </Dialog>

      {/* Share Settings Modal */}
      <ShareSettingsModal
        open={isShareSettingsOpen}
        onOpenChange={setIsShareSettingsOpen}
        list={{
          id: list.id,
          title: list.title,
          isShared: list.isShared,
          shareLink: list.shareLink,
          shareMode: list.shareMode,
          listType: list.listType,
        }}
        onGenerateLink={(shareMode) => generateShareLink(list.id, shareMode)}
        onUpdateShareMode={(shareMode) => updateShareMode(list.id, shareMode)}
        onUnshare={() => unshareList(list.id)}
        effectiveTier={effectiveTier}
      />

      {/* Merge Lists Modal */}
      <MergeListsModal
        open={isMergeModalOpen}
        onOpenChange={setIsMergeModalOpen}
        initialSourceListId={list.id}
        onSuccess={() => {
          refreshLists();
        }}
      />

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
                  <span className="text-gray-600">Create new list</span>
                </div>
                <div className="flex items-center gap-3">
                  <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono border border-border min-w-[32px] text-center">
                    /
                  </kbd>
                  <span className="text-gray-600">Search lists</span>
                </div>
                <div className="flex items-center gap-3">
                  <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono border border-border min-w-[32px] text-center">
                    ESC
                  </kbd>
                  <span className="text-gray-600">Close modal</span>
                </div>
              </div>
            </div>

            {/* Quick FAQ */}
            <div>
              <h4 className="font-semibold text-sm mb-3">Quick FAQ</h4>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="font-medium text-gray-900">How do I share a list?</p>
                  <p className="text-gray-600">Open any list and click the Share button to generate a shareable link or invite collaborators.</p>
                </div>
                <div>
                  <p className="font-medium text-gray-900">How do I upgrade my plan?</p>
                  <p className="text-gray-600">Click the "Upgrade" button in the header or visit the Pricing page to see available plans.</p>
                </div>
                <div>
                  <p className="font-medium text-gray-900">Can I import existing lists?</p>
                  <p className="text-gray-600">Yes! Use the Import/Export feature to import lists from CSV or TXT files.</p>
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
    </div>
  );
}