import { useOpenGraphPreview } from "@/hooks/useOpenGraphPreview";
import { LinkPreviewCard } from "@/components/list/LinkPreviewCard";
import { ListSidebar } from "./ListSidebar";
import PurchaseHistoryModal from "./PurchaseHistoryModal";
import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useLists } from "@/contexts/useListsHook";
import { useAuth } from "@/contexts/useAuthHook";
import { ListItem as ListItemType, ListCategory, ListType } from "@/types";
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
  Pin,
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
  User as UserIcon,
  LogOut,
  GripVertical,
  Tag,
  ExternalLink,
  Flag,
  Link as LinkIcon,
} from "lucide-react";
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
import { useEffect } from "react";
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
    togglePin,
    generateShareLink,
    addCollaborator,
    addTagToList,
    removeTagFromList,
    updateList,
  } = useLists();
  const { toast } = useToast();

  const list = lists.find((l) => l.id === id);
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

  // Link preview for new items
  const { previewData, loading: previewLoading, error: previewError, fetchPreview } = useOpenGraphPreview();
  const [showNewItemPreview, setShowNewItemPreview] = useState(false);

  const [draggedItem, setDraggedItem] = useState<ListItemType | null>(null);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [collaboratorEmail, setCollaboratorEmail] = useState("");
  const [newTag, setNewTag] = useState("");
  const [newLink, setNewLink] = useState("");
  const [isLoading, setIsLoading] = useState(true);
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
  
  // Tags section collapsed state
  const [isTagsSectionOpen, setIsTagsSectionOpen] = useState(false);

  // Simulate loading on mount
  useState(() => {
    setTimeout(() => setIsLoading(false), 300);
  });

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Press 'Escape' to close dialogs
      if (e.key === "Escape") {
        setIsShareDialogOpen(false);
        setEditingItem(null);
        setItemToDelete(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const priorityColors = {
    low: "bg-success/10 text-success border-success/20",
    medium: "bg-warning/10 text-warning border-warning/20",
    high: "bg-destructive/10 text-destructive border-destructive/20",
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/10 via-white to-secondary/10 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-4" />
          <p className="text-gray-600 text-lg">Loading...</p>
        </div>
      </div>
    );
  }

  if (!list) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/10 via-white to-secondary/10 flex items-center justify-center">
        <Card className="p-8 text-center">
          <h2 className="text-xl font-semibold mb-4">List not found</h2>
          <Button onClick={() => navigate("/dashboard")}>
            Back to Dashboard
          </Button>
        </Card>
      </div>
    );
  }

  const handleAddItem = () => {
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

    // Check for duplicate item
    const existingItem = list.items.find(
      (i) => i.text.toLowerCase() === nameValidation.value!.toLowerCase(),
    );
    if (existingItem) {
      toast({
        title: "⚠️ This item already exists",
        description:
          "This item is already in your list. Add it anyway or choose a different name?",
        variant: "destructive",
      });
      // Allow user to continue if they want
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
          user.tier === "free"
            ? "Free"
            : user.tier === "good"
              ? "Good"
              : user.tier === "even-better"
                ? "Even Better"
                : "Lots More";
        toast({
          title: "⚠️ Item limit reached",
          description: `This list has reached the ${user.itemsPerListLimit} item limit for your ${tierName} tier.`,
          variant: "destructive",
        });
        return;
      }
    }

    try {
      // Build attributes object based on list type
      const attributes: any = {};
      
      if (list.listType === "grocery-list") {
        if (newItemCategory) attributes.category = newItemCategory;
        if (newItemUnit) attributes.unit = newItemUnit;
        if (newItemPrice) attributes.price = newItemPrice;
      } else if (list.listType === "registry-list") {
        if (newItemPrice) attributes.price = newItemPrice;
        if (newItemQuantityNeeded) attributes.quantityNeeded = newItemQuantityNeeded;
        if (newItemQuantityPurchased) attributes.quantityPurchased = newItemQuantityPurchased;
        if (newItemStatus) attributes.purchaseStatus = newItemStatus;
        if (newItemProductLink) {
          attributes.productLink = newItemProductLink;
          // Save manual link preview data
          if (newItemLinkTitle) attributes.customLinkTitle = newItemLinkTitle;
          if (newItemLinkDescription) attributes.customLinkDescription = newItemLinkDescription;
          if (newItemLinkImage) attributes.customLinkImage = newItemLinkImage;
        }
      } else if (list.listType === "shopping-list") {
        if (newItemPrice) attributes.price = newItemPrice;
        if (newItemStatus) attributes.purchaseStatus = newItemStatus;
        if (newItemProductLink) {
          attributes.productLink = newItemProductLink;
          // Save manual link preview data
          if (newItemLinkTitle) attributes.customLinkTitle = newItemLinkTitle;
          if (newItemLinkDescription) attributes.customLinkDescription = newItemLinkDescription;
          if (newItemLinkImage) attributes.customLinkImage = newItemLinkImage;
        }
      } else if (list.listType === "todo-list") {
        if (newItemStatus) attributes.status = newItemStatus;
      } else if (list.listType === "idea-list") {
        if (newItemStatus) attributes.status = newItemStatus;
        if (newItemProductLink) {
          attributes.inspirationLink = newItemProductLink;
          // Save manual link preview data
          if (newItemLinkTitle) attributes.customLinkTitle = newItemLinkTitle;
          if (newItemLinkDescription) attributes.customLinkDescription = newItemLinkDescription;
          if (newItemLinkImage) attributes.customLinkImage = newItemLinkImage;
        }
      }

      addItemToList(list.id, {
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
        title: "✅ Item added!",
        description: `${nameValidation.value} has been added to the list`,
        className: "bg-green-50 border-green-200",
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
  };

  const handleDrop = (e: React.DragEvent, targetItem: ListItemType) => {
    e.preventDefault();
    if (!draggedItem || draggedItem.id === targetItem.id) {
      setDraggedItem(null);
      return;
    }

    const items = [...list.items];
    const draggedIndex = items.findIndex((i) => i.id === draggedItem.id);
    const targetIndex = items.findIndex((i) => i.id === targetItem.id);

    if (draggedIndex === -1 || targetIndex === -1) {
      setDraggedItem(null);
      return;
    }

    items.splice(draggedIndex, 1);
    items.splice(targetIndex, 0, draggedItem);

    reorderListItems(list.id, items);
    setDraggedItem(null);
  };

  const handleDragEnd = (e: React.DragEvent) => {
    // Reset visual feedback
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = "1";
    }
    setDraggedItem(null);
  };

  const handleDeleteList = () => {
    deleteList(list.id);
    navigate("/dashboard");
    toast({
      title: "List deleted",
      description: "The list has been removed",
    });
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

  const handleBulkDelete = () => {
    bulkDeleteItems(list.id, Array.from(selectedItems));
    setSelectedItems(new Set());
    toast({
      title: "Items deleted",
      description: `${selectedItems.size} items removed`,
    });
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
      navigator.clipboard.writeText(link);
      toast({
        title: "✅ Share link copied!",
        description: link,
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

  const handleAddCollaborator = () => {
    if (user?.tier !== "premium") {
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
        title: "✅ Collaborator added",
        description: `${emailValidation.value} can now edit this list`,
        className: "bg-green-50 border-green-200",
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
        title: "✅ Tag added",
        description: `Tag "${tagValidation.value}" has been added`,
        className: "bg-green-50 border-green-200",
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
        title: "✅ List updated successfully!",
        description: `${nameValidation.value} has been updated`,
        className: "bg-green-50 border-green-200",
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
        title: "✅ List exported!",
        description: `${format.toUpperCase()} file downloaded successfully`,
        className: "bg-green-50 border-green-200",
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

  const getDueDateColor = (dueDate: Date | undefined) => {
    if (!dueDate) return "";
    const date = new Date(dueDate);
    if (isToday(date)) return "text-orange-600 bg-orange-50 border-orange-200";
    if (isPast(date)) return "text-red-600 bg-red-50 border-red-200";
    return "text-gray-600 bg-gray-50 border-gray-200";
  };

  const handleItemSortChange = (value: string) => {
    setItemSortBy(value as any);
    localStorage.setItem("itemSortBy", value);
  };

  const getSortedItems = () => {
    if (!list) return [];
    let items = [...list.items];

    // For registry/wishlist, group by purchase status first
    if (list.listType === "registry-list" || list.listType === "shopping-list") {
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
    if (!list || list.listType !== "grocery-list") return {};
    
    const items = getSortedItems();
    const grouped: Record<string, ListItemType[]> = {};
    
    items.forEach((item) => {
      const category = item.attributes?.category || "other";
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(item);
    });
    
    return grouped;
  };

  const categoryLabels: Record<string, string> = {
    produce: "Produce",
    dairy: "Dairy",
    meat: "Meat",
    pantry: "Pantry",
    frozen: "Frozen",
    bakery: "Bakery",
    other: "Other",
  };

  const LinkIconWithPreview = ({ url }: { url: string }) => {
    return (
      <div className="relative inline-block">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs sm:text-sm text-primary hover:text-primary/80 underline flex items-center gap-1 break-all"
        >
          <LinkIcon className="w-3 h-3 flex-shrink-0" />
          {url}
        </a>
      </div>
    );
  };

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-primary/10 via-white to-secondary/10">
      {/* Sidebar - Hidden on mobile, visible on desktop */}
      <div className="hidden md:block">
        <ListSidebar />
      </div>

      {/* Mobile Sidebar Overlay */}
      <Sheet open={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
        <SheetContent side="left" className="w-[280px] p-0">
          <ListSidebar />
        </SheetContent>
      </Sheet>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="px-4 sm:px-6 lg:px-8 py-4">
            {/* Breadcrumbs */}
            <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
              <button
                onClick={() => navigate("/dashboard")}
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
                  onClick={() => navigate("/dashboard")}
                  className="min-h-[44px] min-w-[44px] flex-shrink-0"
                >
                  <ArrowLeft className="w-5 h-5" />
                </Button>
                <div className="min-w-0 flex-1">
                  <h1 className="text-lg sm:text-2xl font-bold text-gray-900 truncate">
                    {list.title}
                  </h1>
                  <p className="text-xs sm:text-sm text-gray-600">
                    {list.category} · {list.items.length}/
                    {user?.itemsPerListLimit} items
                  </p>
                </div>
              </div>

              {/* Desktop Actions */}
              <div className="hidden md:flex items-center gap-2">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-10 w-10"
                      >
                        <HelpCircle className="w-5 h-5 text-gray-600" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Help</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                {(list.listType === "registry-list" || list.listType === "shopping-list") && (
                  <>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={handleGenerateShareLink}
                            className="h-10 w-10"
                          >
                            <Share2 className="w-4 h-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Share this list</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => setIsPurchaseHistoryOpen(true)}
                            className="h-10 w-10"
                          >
                            <ShoppingCart className="w-4 h-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Purchase History</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </>
                )}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={openEditListDialog}
                        className="h-10 w-10"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Edit list</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => togglePin(list.id)}
                        className="h-10 w-10"
                      >
                        <Pin
                          className={`w-4 h-4 ${list.isPinned ? "fill-current" : ""}`}
                        />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {list.isPinned ? "Unpin list" : "Pin list"}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <Button
                  variant={isSelectMode ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setIsSelectMode(!isSelectMode);
                    if (isSelectMode) setSelectedItems(new Set());
                  }}
                  className="h-10"
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  {isSelectMode ? "Done" : "Select Multiple"}
                </Button>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" disabled={isExporting} className="h-10">
                      {isExporting ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Download className="w-4 h-4 mr-2" />
                      )}
                      Export
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-48">
                    <div className="space-y-2">
                      <Button
                        variant="ghost"
                        className="w-full justify-start"
                        onClick={() => handleExport("csv")}
                        disabled={isExporting}
                      >
                        Export as CSV
                      </Button>
                      <Button
                        variant="ghost"
                        className="w-full justify-start"
                        onClick={() => handleExport("txt")}
                        disabled={isExporting}
                      >
                        Export as TXT
                      </Button>
                      <Button
                        variant="ghost"
                        className="w-full justify-start"
                        onClick={() => handleExport("pdf")}
                        disabled={isExporting}
                      >
                        Export as PDF
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm" className="h-10">
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to delete this list? This action
                        cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="bg-gray-100">
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
                <SheetContent side="right" className="w-[280px]">
                  <div className="flex flex-col gap-3 mt-8">
                    {(list.listType === "registry-list" || list.listType === "shopping-list") && (
                      <>
                        <Button
                          variant="outline"
                          onClick={() => {
                            handleGenerateShareLink();
                            setIsMobileMenuOpen(false);
                          }}
                          className="w-full justify-start min-h-[44px]"
                        >
                          <Share2 className="w-4 h-4 mr-2" />
                          Share List
                        </Button>
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
                      </>
                    )}
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
                    <Button
                      variant="outline"
                      onClick={() => {
                        togglePin(list.id);
                        setIsMobileMenuOpen(false);
                      }}
                      className="w-full justify-start min-h-[44px]"
                    >
                      <Pin
                        className={`w-4 h-4 mr-2 ${list.isPinned ? "fill-current" : ""}`}
                      />
                      {list.isPinned ? "Unpin List" : "Pin List"}
                    </Button>
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
                    <Button
                      variant="outline"
                      onClick={() => {
                        handleExport("csv");
                        setIsMobileMenuOpen(false);
                      }}
                      disabled={isExporting}
                      className="w-full justify-start min-h-[44px]"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Export as CSV
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        handleExport("txt");
                        setIsMobileMenuOpen(false);
                      }}
                      disabled={isExporting}
                      className="w-full justify-start min-h-[44px]"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Export as TXT
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
                            Are you sure you want to delete this list? This
                            action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="bg-gray-100 min-h-[44px]">
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
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </header>

        <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
          {/* Tags Section - Collapsible */}
          <Card className="p-3 sm:p-4 mb-4">
            <button
              onClick={() => setIsTagsSectionOpen(!isTagsSectionOpen)}
              className="w-full flex items-center justify-between text-left"
            >
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-medium text-gray-700">Tags</h3>
                <Badge variant="outline" className="text-xs">
                  {list.tags?.length || 0}
                </Badge>
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
              <ChevronDown 
                className={`w-4 h-4 transition-transform ${isTagsSectionOpen ? 'rotate-180' : ''}`} 
              />
            </button>
            
            {isTagsSectionOpen && (
              <div className="mt-3 space-y-3">
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
                    placeholder="e.g., urgent, work, personal, home"
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddTag();
                      }
                    }}
                    className="flex-1 min-h-[44px]"
                  />
                  <Button onClick={handleAddTag} size="sm" className="min-h-[44px]">
                    <Tag className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </Card>

          {/* Bulk Actions Toolbar */}
          {isSelectMode && (
            <Card className="p-3 sm:p-4 mb-4 bg-primary/10 border-primary/20">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <p className="text-sm font-semibold text-primary">
                    {selectedItems.size} item
                    {selectedItems.size !== 1 ? "s" : ""} selected
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleSelectAll}
                    className="min-h-[36px] bg-white hover:bg-gray-50"
                  >
                    {selectedItems.size === list.items.length
                      ? "Deselect All"
                      : "Select All"}
                  </Button>
                </div>
                {selectedItems.size > 0 && (
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button
                      size="sm"
                      onClick={handleBulkComplete}
                      className="min-h-[44px] w-full sm:w-auto bg-success hover:bg-success/90 text-white"
                    >
                      <CheckSquare className="w-4 h-4 mr-2" />
                      Mark Complete
                    </Button>
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
                      className="min-h-[44px] w-full sm:w-auto bg-gray-100 hover:bg-gray-200"
                    >
                      <X className="w-4 h-4 mr-2" />
                      Cancel
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* Add Item */}
          <Card className="p-0 mb-4 sm:mb-6">
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
                      You've reached your item limit ({user?.itemsPerListLimit}{" "}
                      items). Upgrade to add more items.
                    </AlertDescription>
                  </Alert>
                )}

                {/* CUSTOM LIST - Simple fields */}
                {list.listType === "custom" && (
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
                {list.listType === "todo-list" && (
                  <>
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
                {list.listType === "grocery-list" && (
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
                        <Input
                          placeholder="Item name"
                          value={newItemText}
                          onChange={(e) => setNewItemText(e.target.value)}
                          className="min-h-[44px]"
                        />
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label className="text-xs mb-2">Category</Label>
                            <Select
                              value={newItemCategory || ""}
                              onValueChange={setNewItemCategory}
                            >
                              <SelectTrigger className="min-h-[44px]">
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

                {/* REGISTRY LIST - Registry fields */}
                {list.listType === "registry-list" && (
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
                            <Label className="text-xs mb-2">Qty Needed</Label>
                            <Input
                              type="number"
                              placeholder="1"
                              value={newItemQuantityNeeded || ""}
                              onChange={(e) =>
                                setNewItemQuantityNeeded(e.target.value ? parseInt(e.target.value) : undefined)
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

                {/* WISHLIST - Wishlist fields */}
                {list.listType === "shopping-list" && (
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
                            <Label className="text-xs mb-2">Link Title (optional)</Label>
                            <Input
                              type="text"
                              placeholder="e.g., Wireless Headphones"
                              value={newItemLinkTitle}
                              onChange={(e) => setNewItemLinkTitle(e.target.value)}
                              className="min-h-[44px]"
                            />
                          </div>
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
                {list.listType === "idea-list" && (
                  <>
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

          {/* Sort Items Dropdown */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-medium text-gray-700">Items</h3>
              {itemSortBy === "manual" && (
                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                  Drag to reorder
                </span>
              )}
            </div>
            <Select value={itemSortBy} onValueChange={handleItemSortChange}>
              <SelectTrigger className="w-[180px] h-[40px]">
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

          {/* Purchase History Note for Registry/Wishlist */}
          {(list.listType === "registry-list" || list.listType === "shopping-list") && (
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
            ) : list.listType === "grocery-list" ? (
              // Grouped display for grocery lists
              Object.entries(getGroupedGroceryItems()).map(([category, categoryItems]) => (
                <div key={category} className="space-y-2">
                  <div className="flex items-center gap-2 mt-4 mb-2">
                    <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                      {categoryLabels[category] || category}
                    </h3>
                    <div className="flex-1 h-px bg-gray-200"></div>
                    <Badge variant="outline" className="text-xs">
                      {categoryItems.length}
                    </Badge>
                  </div>
                  {categoryItems.map((item, index) => {
                    const isPurchased = item.attributes?.purchaseStatus === "purchased";
                    
                    return (
                    <Card
                      key={item.id}
                      className={`p-3 sm:p-4 hover:shadow-md transition-all ${index % 2 === 1 ? "bg-gray-50" : "bg-white"} ${draggedItem?.id === item.id ? "animate-drag-lift border-primary border-2" : ""}`}
                      draggable={itemSortBy === "manual"}
                      onDragStart={(e) =>
                        itemSortBy === "manual" && handleDragStart(e, item)
                      }
                      onDragOver={(e) =>
                        itemSortBy === "manual" && handleDragOver(e, item)
                      }
                      onDrop={(e) =>
                        itemSortBy === "manual" && handleDrop(e, item)
                      }
                      onDragEnd={(e) =>
                        itemSortBy === "manual" && handleDragEnd(e)
                      }
                    >
                      <div className="flex items-start gap-2 sm:gap-3">
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
                          className={`mt-1 h-6 w-6 md:h-[18px] md:w-[18px] rounded md:rounded-[3px] mr-3 md:mr-2 flex-shrink-0 transition-transform ${item.completed ? "animate-check-bounce" : ""}`}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p
                              className={`text-sm sm:text-base text-gray-900 transition-all duration-200 ${item.completed ? "line-through opacity-50" : ""} break-words`}
                            >
                              {item.quantity && (
                                <span className="font-semibold text-blue-600">
                                  {item.quantity}× {" "}
                                </span>
                              )}
                              {item.text}
                            </p>
                            {isPurchased && (
                              <Badge className="bg-green-100 text-green-700 border-green-300">
                                ✓ Purchased
                              </Badge>
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

                          {/* Grocery-specific attributes */}
                          {item.attributes && (
                            <div className="flex items-center gap-2 mt-2 flex-wrap">
                              {item.attributes.unit && (
                                <Badge
                                  variant="outline"
                                  className="bg-primary/10 text-primary border-primary/20 text-xs"
                                >
                                  {item.attributes.unit}
                                </Badge>
                              )}
                              {item.attributes.price && (
                                <Badge
                                  variant="outline"
                                  className="bg-gray-100 text-gray-700 border-gray-300 text-xs"
                                >
                                  ${item.attributes.price}
                                </Badge>
                              )}
                            </div>
                          )}

                          {item.notes && !item.completed && (
                            <p className="text-xs sm:text-sm text-gray-600 mt-2 break-words">
                              {item.notes}
                            </p>
                          )}

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

                          {item.links && item.links.length > 0 && (
                            <div className="mt-2 space-y-1">
                              {item.links.map((link, idx) => (
                                <LinkIconWithPreview key={idx} url={link} />
                              ))}
                            </div>
                          )}
                        </div>
                        {!isSelectMode && (
                          <div className="flex flex-col sm:flex-row items-center gap-1">
                            <Dialog
                              open={editingItem?.id === item.id}
                              onOpenChange={(open) => !open && setEditingItem(null)}
                            >
                              <DialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setEditingItem(item)}
                                >
                                  Edit
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                                <DialogHeader>
                                  <DialogTitle>Edit Item</DialogTitle>
                                  <DialogDescription>
                                    Update item details and attributes
                                  </DialogDescription>
                                </DialogHeader>
                                {editingItem && (
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

                                    {/* GROCERY LIST FIELDS */}
                                    {list.listType === "grocery-list" && (
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
                                                  quantity: e.target.value
                                                    ? parseInt(e.target.value)
                                                    : undefined,
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
                                              type="number"
                                              step="0.01"
                                              value={editingItem.attributes?.price || ""}
                                              onChange={(e) =>
                                                setEditingItem({
                                                  ...editingItem,
                                                  attributes: {
                                                    ...editingItem.attributes,
                                                    price: e.target.value
                                                      ? parseFloat(e.target.value)
                                                      : undefined,
                                                  },
                                                })
                                              }
                                            />
                                          </div>
                                        </div>
                                      </>
                                    )}

                                    {/* TO-DO LIST FIELDS */}
                                    {list.listType === "todo-list" && (
                                      <>
                                        <div className="space-y-2">
                                          <Label>Due Date</Label>
                                          <Popover>
                                            <PopoverTrigger asChild>
                                              <Button
                                                variant="outline"
                                                className="w-full justify-start"
                                              >
                                                <Calendar className="w-4 h-4 mr-2" />
                                                {editingItem.dueDate
                                                  ? format(
                                                      new Date(editingItem.dueDate),
                                                      "PPP",
                                                    )
                                                  : "Pick a date"}
                                              </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0">
                                              <CalendarComponent
                                                mode="single"
                                                selected={
                                                  editingItem.dueDate
                                                    ? new Date(editingItem.dueDate)
                                                    : undefined
                                                }
                                                onSelect={(date) =>
                                                  setEditingItem({
                                                    ...editingItem,
                                                    dueDate: date,
                                                  })
                                                }
                                              />
                                            </PopoverContent>
                                          </Popover>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                          <div className="space-y-2">
                                            <Label>Priority</Label>
                                            <Select
                                              value={editingItem.priority || "none"}
                                              onValueChange={(value) =>
                                                setEditingItem({
                                                  ...editingItem,
                                                  priority:
                                                    value === "none"
                                                      ? undefined
                                                      : (value as
                                                          | "low"
                                                          | "medium"
                                                          | "high"),
                                                })
                                              }
                                            >
                                              <SelectTrigger>
                                                <SelectValue />
                                              </SelectTrigger>
                                              <SelectContent>
                                                <SelectItem value="none">
                                                  None
                                                </SelectItem>
                                                <SelectItem value="low">Low</SelectItem>
                                                <SelectItem value="medium">
                                                  Medium
                                                </SelectItem>
                                                <SelectItem value="high">
                                                  High
                                                </SelectItem>
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

                                    {/* WISHLIST FIELDS */}
                                    {list.listType === "shopping-list" && (
                                      <>
                                        <div className="space-y-2">
                                          <Label>Product Link (optional)</Label>
                                          <Input
                                            type="url"
                                            placeholder="https://example.com/product"
                                            value={editingItem.attributes?.productLink || ""}
                                            onChange={(e) =>
                                              setEditingItem({
                                                ...editingItem,
                                                attributes: {
                                                  ...editingItem.attributes,
                                                  productLink: e.target.value,
                                                },
                                              })
                                            }
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
                                            value={editingItem.attributes?.customLinkImage || ""}
                                            onChange={(e) =>
                                              setEditingItem({
                                                ...editingItem,
                                                attributes: {
                                                  ...editingItem.attributes,
                                                  customLinkImage: e.target.value,
                                                },
                                              })
                                            }
                                          />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                          <div className="space-y-2">
                                            <Label>Price</Label>
                                            <Input
                                              type="number"
                                              step="0.01"
                                              value={editingItem.attributes?.price || ""}
                                              onChange={(e) =>
                                                setEditingItem({
                                                  ...editingItem,
                                                  attributes: {
                                                    ...editingItem.attributes,
                                                    price: e.target.value
                                                      ? parseFloat(e.target.value)
                                                      : undefined,
                                                  },
                                                })
                                              }
                                            />
                                          </div>
                                          <div className="space-y-2">
                                            <Label>Priority</Label>
                                            <Select
                                              value={editingItem.priority || "none"}
                                              onValueChange={(value) =>
                                                setEditingItem({
                                                  ...editingItem,
                                                  priority:
                                                    value === "none"
                                                      ? undefined
                                                      : (value as
                                                          | "low"
                                                          | "medium"
                                                          | "high"),
                                                })
                                              }
                                            >
                                              <SelectTrigger>
                                                <SelectValue />
                                              </SelectTrigger>
                                              <SelectContent>
                                                <SelectItem value="none">None</SelectItem>
                                                <SelectItem value="high">Must have</SelectItem>
                                                <SelectItem value="medium">Want</SelectItem>
                                                <SelectItem value="low">Nice to have</SelectItem>
                                              </SelectContent>
                                            </Select>
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

                                    {/* REGISTRY FIELDS */}
                                    {list.listType === "registry-list" && (
                                      <>
                                        <div className="space-y-2">
                                          <Label>Product Link (optional)</Label>
                                          <Input
                                            type="url"
                                            placeholder="https://example.com/product"
                                            value={editingItem.attributes?.productLink || ""}
                                            onChange={(e) =>
                                              setEditingItem({
                                                ...editingItem,
                                                attributes: {
                                                  ...editingItem.attributes,
                                                  productLink: e.target.value,
                                                },
                                              })
                                            }
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
                                            value={editingItem.attributes?.customLinkImage || ""}
                                            onChange={(e) =>
                                              setEditingItem({
                                                ...editingItem,
                                                attributes: {
                                                  ...editingItem.attributes,
                                                  customLinkImage: e.target.value,
                                                },
                                              })
                                            }
                                          />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                          <div className="space-y-2">
                                            <Label>Price</Label>
                                            <Input
                                              type="number"
                                              step="0.01"
                                              value={editingItem.attributes?.price || ""}
                                              onChange={(e) =>
                                                setEditingItem({
                                                  ...editingItem,
                                                  attributes: {
                                                    ...editingItem.attributes,
                                                    price: e.target.value
                                                      ? parseFloat(e.target.value)
                                                      : undefined,
                                                  },
                                                })
                                              }
                                            />
                                          </div>
                                          <div className="space-y-2">
                                            <Label>Qty Needed</Label>
                                            <Input
                                              type="number"
                                              value={editingItem.attributes?.quantityNeeded || ""}
                                              onChange={(e) =>
                                                setEditingItem({
                                                  ...editingItem,
                                                  attributes: {
                                                    ...editingItem.attributes,
                                                    quantityNeeded: e.target.value
                                                      ? parseInt(e.target.value)
                                                      : undefined,
                                                  },
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

                                    {/* IDEA LIST FIELDS */}
                                    {list.listType === "idea-list" && (
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
                                            value={editingItem.attributes?.customLinkImage || ""}
                                            onChange={(e) =>
                                              setEditingItem({
                                                ...editingItem,
                                                attributes: {
                                                  ...editingItem.attributes,
                                                  customLinkImage: e.target.value,
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

                                    {/* Notes - Always shown */}
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
                                        rows={3}
                                      />
                                    </div>

                                    <Button
                                      onClick={() => {
                                        // Fetch and save link preview data if link was updated
                                        const linkField = list.listType === "registry-list" || list.listType === "shopping-list" 
                                          ? "productLink" 
                                          : "inspirationLink";
                                        const link = editingItem.attributes?.[linkField];
                                        
                                        if (link && previewData[link]) {
                                          editingItem.attributes = {
                                            ...editingItem.attributes,
                                            linkTitle: previewData[link].title,
                                            linkImage: previewData[link].image,
                                            linkDescription: previewData[link].description,
                                          };
                                        }
                                        
                                        updateListItem(list.id, editingItem.id, {
                                          text: editingItem.text,
                                          quantity: editingItem.quantity,
                                          priority: editingItem.priority,
                                          dueDate: editingItem.dueDate,
                                          notes: editingItem.notes,
                                          assignedTo: editingItem.assignedTo,
                                          links: editingItem.links,
                                          attributes: editingItem.attributes,
                                          completed: editingItem.completed,
                                        });
                                        setEditingItem(null);
                                        setNewLink("");
                                      }}
                                      className="w-full"
                                    >
                                      Save Changes
                                    </Button>
                                  </div>
                                )}
                              </DialogContent>
                            </Dialog>
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
                                    Are you sure you want to delete this item? This
                                    action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel className="bg-gray-100">
                                    Cancel
                                  </AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => {
                                      deleteListItem(list.id, item.id);
                                      setItemToDelete(null);
                                      toast({
                                        title: "Item deleted",
                                        description: "Item removed from list",
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
                        )}
                      </div>
                    </Card>
                    );
                  })}
                </div>
              ))
            ) : (
              // Regular display for non-grocery lists
              getSortedItems().map((item, index) => {
                const isPurchased = item.attributes?.purchaseStatus === "purchased";
                const isFirstPurchased = index > 0 && 
                  !getSortedItems()[index - 1].attributes?.purchaseStatus && 
                  isPurchased && 
                  (list.listType === "registry-list" || list.listType === "shopping-list");
                
                // Calculate continuous numbering for registry/wishlist
                const showNumbering = list.listType === "registry-list" || list.listType === "shopping-list";
                const itemNumber = index + 1;
                
                return (
                  <div key={item.id}>
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
                    
                    <Card
                      className={`p-3 sm:p-4 hover:shadow-md transition-all ${index % 2 === 1 ? "bg-gray-50" : "bg-white"} ${isPurchased ? "border-success/20 bg-success/5" : ""} ${draggedItem?.id === item.id ? "animate-drag-lift border-primary border-2" : ""}`}
                      draggable={itemSortBy === "manual"}
                      onDragStart={(e) =>
                        itemSortBy === "manual" && handleDragStart(e, item)
                      }
                      onDragOver={(e) =>
                        itemSortBy === "manual" && handleDragOver(e, item)
                      }
                      onDrop={(e) =>
                        itemSortBy === "manual" && handleDrop(e, item)
                      }
                      onDragEnd={(e) =>
                        itemSortBy === "manual" && handleDragEnd(e)
                      }
                    >
                      <div className="flex items-start gap-2 sm:gap-3">
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
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p
                              className={`text-sm sm:text-base text-gray-900 transition-all duration-200 ${item.completed ? "line-through opacity-50" : ""} break-words`}
                            >
                              {item.quantity && (
                                <span className="font-semibold text-blue-600">
                                  {item.quantity}×{" "}
                                </span>
                              )}
                              {item.text}
                            </p>
                            {isPurchased && (
                              <Badge className="bg-success/10 text-success border-success/30">
                                ✓ Purchased
                              </Badge>
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

                          {/* Attribute Tags */}
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
                              {item.attributes.price && (
                                <Badge
                                  variant="outline"
                                  className="bg-gray-100 text-gray-700 border-gray-300 text-xs"
                                >
                                  ${item.attributes.price}
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
                            {item.notes && (
                              <Badge variant="outline" className="text-xs">
                                <FileText className="w-3 h-3 mr-1" />
                                Note
                              </Badge>
                            )}
                            {(item.attributes?.productLink || item.attributes?.inspirationLink) && (
                              <Badge variant="outline" className="text-xs bg-blue-50 border-blue-200">
                                <LinkIcon className="w-3 h-3 mr-1 text-primary" />
                                <span className="text-primary underline">{list.listType === "idea-list" ? "Inspiration" : "Product"} Link</span>
                              </Badge>
                            )}
                            {item.links && item.links.length > 0 && (
                              <Badge variant="outline" className="text-xs">
                                <LinkIcon className="w-3 h-3 mr-1" />
                                {item.links.length} link
                                {item.links.length > 1 ? "s" : ""}
                              </Badge>
                            )}
                          </div>
                          {item.notes && !item.completed && (
                            <p className="text-xs sm:text-sm text-gray-600 mt-2 break-words">
                              {item.notes}
                            </p>
                          )}

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

                          {item.links && item.links.length > 0 && (
                            <div className="mt-2 space-y-1">
                              {item.links.map((link, idx) => (
                                <LinkIconWithPreview key={idx} url={link} />
                              ))}
                            </div>
                          )}
                        </div>
                        {!isSelectMode && (
                          <div className="flex flex-col sm:flex-row items-center gap-1">
                            <Dialog
                              open={editingItem?.id === item.id}
                              onOpenChange={(open) => !open && setEditingItem(null)}
                            >
                              <DialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setEditingItem(item)}
                                >
                                  Edit
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                                <DialogHeader>
                                  <DialogTitle>Edit Item</DialogTitle>
                                  <DialogDescription>
                                    Update item details and attributes
                                  </DialogDescription>
                                </DialogHeader>
                                {editingItem && (
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

                                    {/* GROCERY LIST FIELDS */}
                                    {list.listType === "grocery-list" && (
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
                                                  quantity: e.target.value
                                                    ? parseInt(e.target.value)
                                                    : undefined,
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
                                              type="number"
                                              step="0.01"
                                              value={editingItem.attributes?.price || ""}
                                              onChange={(e) =>
                                                setEditingItem({
                                                  ...editingItem,
                                                  attributes: {
                                                    ...editingItem.attributes,
                                                    price: e.target.value
                                                      ? parseFloat(e.target.value)
                                                      : undefined,
                                                  },
                                                })
                                              }
                                            />
                                          </div>
                                        </div>
                                      </>
                                    )}

                                    {/* TO-DO LIST FIELDS */}
                                    {list.listType === "todo-list" && (
                                      <>
                                        <div className="space-y-2">
                                          <Label>Due Date</Label>
                                          <Popover>
                                            <PopoverTrigger asChild>
                                              <Button
                                                variant="outline"
                                                className="w-full justify-start"
                                              >
                                                <Calendar className="w-4 h-4 mr-2" />
                                                {editingItem.dueDate
                                                  ? format(
                                                      new Date(editingItem.dueDate),
                                                      "PPP",
                                                    )
                                                  : "Pick a date"}
                                              </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0">
                                              <CalendarComponent
                                                mode="single"
                                                selected={
                                                  editingItem.dueDate
                                                    ? new Date(editingItem.dueDate)
                                                    : undefined
                                                }
                                                onSelect={(date) =>
                                                  setEditingItem({
                                                    ...editingItem,
                                                    dueDate: date,
                                                  })
                                                }
                                              />
                                            </PopoverContent>
                                          </Popover>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                          <div className="space-y-2">
                                            <Label>Priority</Label>
                                            <Select
                                              value={editingItem.priority || "none"}
                                              onValueChange={(value) =>
                                                setEditingItem({
                                                  ...editingItem,
                                                  priority:
                                                    value === "none"
                                                      ? undefined
                                                      : (value as
                                                          | "low"
                                                          | "medium"
                                                          | "high"),
                                                })
                                              }
                                            >
                                              <SelectTrigger>
                                                <SelectValue />
                                              </SelectTrigger>
                                              <SelectContent>
                                                <SelectItem value="none">
                                                  None
                                                </SelectItem>
                                                <SelectItem value="low">Low</SelectItem>
                                                <SelectItem value="medium">
                                                  Medium
                                                </SelectItem>
                                                <SelectItem value="high">
                                                  High
                                                </SelectItem>
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

                                    {/* WISHLIST FIELDS */}
                                    {list.listType === "shopping-list" && (
                                      <>
                                        <div className="grid grid-cols-2 gap-4">
                                          <div className="space-y-2">
                                            <Label>Product Link (optional)</Label>
                                            <Input
                                              type="url"
                                              placeholder="https://example.com/product"
                                              value={editingItem.attributes?.productLink || ""}
                                              onChange={(e) =>
                                                setEditingItem({
                                                  ...editingItem,
                                                  attributes: {
                                                    ...editingItem.attributes,
                                                    productLink: e.target.value,
                                                  },
                                                })
                                              }
                                              onBlur={() => {
                                                const link = editingItem.attributes?.productLink;
                                                if (link) {
                                                  fetchPreview(link);
                                                }
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
                                              rows={2}
                                            />
                                          </div>
                                          <div className="space-y-2">
                                            <Label>Link Image URL (optional)</Label>
                                            <Input
                                              type="url"
                                              placeholder="e.g., https://example.com/image.jpg"
                                              value={editingItem.attributes?.customLinkImage || ""}
                                              onChange={(e) =>
                                                setEditingItem({
                                                  ...editingItem,
                                                  attributes: {
                                                    ...editingItem.attributes,
                                                    customLinkImage: e.target.value,
                                                  },
                                                })
                                              }
                                            />
                                          </div>
                                          <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                              <Label>Price</Label>
                                              <Input
                                                type="number"
                                                step="0.01"
                                                value={editingItem.attributes?.price || ""}
                                                onChange={(e) =>
                                                  setEditingItem({
                                                    ...editingItem,
                                                    attributes: {
                                                      ...editingItem.attributes,
                                                      price: e.target.value
                                                        ? parseFloat(e.target.value)
                                                        : undefined,
                                                    },
                                                  })
                                                }
                                              />
                                            </div>
                                            <div className="space-y-2">
                                              <Label>Priority</Label>
                                              <Select
                                                value={editingItem.priority || "none"}
                                                onValueChange={(value) =>
                                                  setEditingItem({
                                                    ...editingItem,
                                                    priority:
                                                      value === "none"
                                                        ? undefined
                                                        : (value as
                                                            | "low"
                                                            | "medium"
                                                            | "high"),
                                                  })
                                                }
                                              >
                                                <SelectTrigger>
                                                  <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                  <SelectItem value="none">None</SelectItem>
                                                  <SelectItem value="high">Must have</SelectItem>
                                                  <SelectItem value="medium">Want</SelectItem>
                                                  <SelectItem value="low">Nice to have</SelectItem>
                                                </SelectContent>
                                              </Select>
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
                                        </div>
                                      </>
                                    )}

                                    {/* REGISTRY FIELDS */}
                                    {list.listType === "registry-list" && (
                                      <>
                                        <div className="space-y-2">
                                          <Label>Product Link (optional)</Label>
                                          <Input
                                            type="url"
                                            placeholder="https://example.com/product"
                                            value={editingItem.attributes?.productLink || ""}
                                            onChange={(e) =>
                                              setEditingItem({
                                                ...editingItem,
                                                attributes: {
                                                  ...editingItem.attributes,
                                                  productLink: e.target.value,
                                                },
                                              })
                                            }
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
                                            value={editingItem.attributes?.customLinkImage || ""}
                                            onChange={(e) =>
                                              setEditingItem({
                                                ...editingItem,
                                                attributes: {
                                                  ...editingItem.attributes,
                                                  customLinkImage: e.target.value,
                                                },
                                              })
                                            }
                                          />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                          <div className="space-y-2">
                                            <Label>Price</Label>
                                            <Input
                                              type="number"
                                              step="0.01"
                                              value={editingItem.attributes?.price || ""}
                                              onChange={(e) =>
                                                setEditingItem({
                                                  ...editingItem,
                                                  attributes: {
                                                    ...editingItem.attributes,
                                                    price: e.target.value
                                                      ? parseFloat(e.target.value)
                                                      : undefined,
                                                  },
                                                })
                                              }
                                            />
                                          </div>
                                          <div className="space-y-2">
                                            <Label>Qty Needed</Label>
                                            <Input
                                              type="number"
                                              value={editingItem.attributes?.quantityNeeded || ""}
                                              onChange={(e) =>
                                                setEditingItem({
                                                  ...editingItem,
                                                  attributes: {
                                                    ...editingItem.attributes,
                                                    quantityNeeded: e.target.value
                                                      ? parseInt(e.target.value)
                                                      : undefined,
                                                  },
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

                                    {/* IDEA LIST FIELDS */}
                                    {list.listType === "idea-list" && (
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
                                            value={editingItem.attributes?.customLinkImage || ""}
                                            onChange={(e) =>
                                              setEditingItem({
                                                ...editingItem,
                                                attributes: {
                                                  ...editingItem.attributes,
                                                  customLinkImage: e.target.value,
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

                                    {/* Notes - Always shown */}
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
                                        rows={3}
                                      />
                                    </div>

                                    <Button
                                      onClick={() => {
                                        updateListItem(list.id, editingItem.id, {
                                          text: editingItem.text,
                                          quantity: editingItem.quantity,
                                          priority: editingItem.priority,
                                          dueDate: editingItem.dueDate,
                                          notes: editingItem.notes,
                                          assignedTo: editingItem.assignedTo,
                                          links: editingItem.links,
                                          attributes: editingItem.attributes,
                                          completed: editingItem.completed,
                                        });
                                        setEditingItem(null);
                                        setNewLink("");
                                      }}
                                      className="w-full"
                                    >
                                      Save Changes
                                    </Button>
                                  </div>
                                )}
                              </DialogContent>
                            </Dialog>
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
                                    Are you sure you want to delete this item? This
                                    action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel className="bg-gray-100">
                                    Cancel
                                  </AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => {
                                      deleteListItem(list.id, item.id);
                                      setItemToDelete(null);
                                      toast({
                                        title: "Item deleted",
                                        description: "Item removed from list",
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
                        )}
                      </div>
                    </Card>
                  </div>
                )
              })
            )}
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
                  <SelectItem value="Groceries">Groceries</SelectItem>
                  <SelectItem value="Ideas">Ideas</SelectItem>
                  <SelectItem value="Shopping">Shopping</SelectItem>
                  <SelectItem value="Travel">Travel</SelectItem>
                  <SelectItem value="Work">Work</SelectItem>
                  <SelectItem value="Home">Home</SelectItem>
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
                  <SelectItem value="shopping-list">Wishlist</SelectItem>
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
      {(list.listType === "registry-list" || list.listType === "shopping-list") && (
        <PurchaseHistoryModal
          open={isPurchaseHistoryOpen}
          onOpenChange={setIsPurchaseHistoryOpen}
          listId={list.id}
          listItems={list.items.map((item) => ({ id: item.id, text: item.text }))}
          showPurchaserInfo={list.showPurchaserInfo || false}
          onTogglePurchaserInfo={handleTogglePurchaserInfo}
        />
      )}
    </div>
  );
}