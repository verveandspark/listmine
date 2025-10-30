import { ListSidebar } from "./ListSidebar";
import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useLists } from "@/contexts/useListsHook";
import { useAuth } from "@/contexts/useAuthHook";
import { ListItem as ListItemType } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Plus,
  Trash2,
  GripVertical,
  Calendar,
  Flag,
  StickyNote,
  Download,
  Pin,
  Link as LinkIcon,
  User as UserIcon,
  Share2,
  Tag,
  CheckSquare,
  X,
  ExternalLink,
  Package,
  Loader2,
  HelpCircle,
  CheckCircle,
  Menu,
  Zap,
  ListTree,
  ChevronRight,
  AlertCircle,
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
} from "@/lib/validation";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";

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
  } = useLists();
  const { toast } = useToast();

  const list = lists.find((l) => l.id === id);
  const [newItemText, setNewItemText] = useState("");
  const [newItemQuantity, setNewItemQuantity] = useState<number | undefined>();
  const [newItemPriority, setNewItemPriority] = useState<
    "low" | "medium" | "high" | undefined
  >();
  const [newItemDueDate, setNewItemDueDate] = useState<Date | undefined>();
  const [newItemNotes, setNewItemNotes] = useState("");
  const [newItemAssignedTo, setNewItemAssignedTo] = useState("");
  const [isDetailedMode, setIsDetailedMode] = useState(() => {
    const savedMode = localStorage.getItem("itemEntryMode");
    return savedMode === "detailed";
  });
  const [editingItem, setEditingItem] = useState<ListItemType | null>(null);
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
  const [itemSortBy, setItemSortBy] = useState<
    "manual" | "priority" | "dueDate" | "alphabetical"
  >(() => {
    return (localStorage.getItem("itemSortBy") as any) || "manual";
  });
  const [showItemLimitError, setShowItemLimitError] = useState(false);
  const [detailedMode, setDetailedMode] = useState(false);
  const [itemLimitReached, setItemLimitReached] = useState(false);

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

  if (!list) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
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
      addItemToList(list.id, {
        text: nameValidation.value!,
        quantity: newItemQuantity,
        priority: newItemPriority,
        dueDate: newItemDueDate,
        notes: newItemNotes,
        assignedTo: newItemAssignedTo || undefined,
        completed: false,
      });
      setNewItemText("");
      setNewItemQuantity(undefined);
      setNewItemPriority(undefined);
      setNewItemDueDate(undefined);
      setNewItemNotes("");
      setNewItemAssignedTo("");
      setShowItemLimitError(false);
      toast({
        title: "✅ Item added!",
        description: `${nameValidation.value} has been added to the list`,
        className: "bg-green-50 border-green-200",
      });

      // Focus back on the text input
      setTimeout(() => {
        const textInput = document.querySelector(
          'input[placeholder="Add a new item..."]',
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

  const handleDragStart = (item: ListItemType) => {
    setDraggedItem(item);
  };

  const handleDragOver = (e: React.DragEvent, targetItem: ListItemType) => {
    e.preventDefault();
    if (!draggedItem || draggedItem.id === targetItem.id) return;

    const items = [...list.items];
    const draggedIndex = items.findIndex((i) => i.id === draggedItem.id);
    const targetIndex = items.findIndex((i) => i.id === targetItem.id);

    items.splice(draggedIndex, 1);
    items.splice(targetIndex, 0, draggedItem);

    reorderListItems(list.id, items);
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

  const priorityColors = {
    low: "bg-green-100 text-green-700 border-green-200",
    medium: "bg-yellow-100 text-yellow-700 border-yellow-200",
    high: "bg-red-100 text-red-700 border-red-200",
  };

  const handleItemSortChange = (value: string) => {
    setItemSortBy(value as any);
    localStorage.setItem("itemSortBy", value);
  };

  const getSortedItems = () => {
    if (!list) return [];
    let items = [...list.items];

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

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Sidebar */}
      <ListSidebar />
      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
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
                        className="min-h-[44px] min-w-[44px]"
                      >
                        <HelpCircle className="w-5 h-5 text-gray-600" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-xs">
                      <div className="space-y-2 text-sm">
                        <p className="font-semibold">Keyboard Shortcuts:</p>
                        <p>
                          <kbd className="px-2 py-1 bg-gray-100 rounded">
                            Esc
                          </kbd>{" "}
                          - Close Modal
                        </p>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => togglePin(list.id)}
                  className="min-h-[44px] min-w-[44px]"
                >
                  <Pin
                    className={`w-4 h-4 ${list.isPinned ? "fill-current" : ""}`}
                  />
                </Button>
                <Button
                  variant={isSelectMode ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setIsSelectMode(!isSelectMode);
                    if (isSelectMode) setSelectedItems(new Set());
                  }}
                  className="min-h-[44px]"
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  {isSelectMode ? "Done" : "Select Multiple"}
                </Button>
                <Dialog
                  open={isShareDialogOpen}
                  onOpenChange={setIsShareDialogOpen}
                >
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Share2 className="w-4 h-4 mr-2" />
                      Share
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Share List</DialogTitle>
                      <DialogDescription>
                        Share this list with others
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label>Share Link (Read-only)</Label>
                        <div className="flex gap-2 mt-2">
                          <Input value={list.shareLink || ""} readOnly />
                          <Button onClick={handleGenerateShareLink}>
                            {list.shareLink ? "Copy" : "Generate"}
                          </Button>
                        </div>
                      </div>
                      <div>
                        <Label>Add Collaborator (Premium)</Label>
                        <div className="flex gap-2 mt-2">
                          <Input
                            placeholder="email@example.com"
                            value={collaboratorEmail}
                            onChange={(e) =>
                              setCollaboratorEmail(e.target.value)
                            }
                          />
                          <Button onClick={handleAddCollaborator}>Add</Button>
                        </div>
                        {list.collaborators &&
                          list.collaborators.length > 0 && (
                            <div className="mt-3">
                              <p className="text-sm text-gray-600 mb-2">
                                Collaborators:
                              </p>
                              {list.collaborators.map((email) => (
                                <Badge
                                  key={email}
                                  variant="secondary"
                                  className="mr-2"
                                >
                                  {email}
                                </Badge>
                              ))}
                            </div>
                          )}
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" disabled={isExporting}>
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
                    <Button variant="destructive" size="sm">
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
                        setIsShareDialogOpen(true);
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

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
          {/* Tags Section */}
          <Card className="p-3 sm:p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-medium text-gray-700">Tags</h3>
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
            </div>
            <div className="flex flex-wrap gap-2 mb-3">
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
          </Card>

          {/* Bulk Actions Toolbar */}
          {isSelectMode && (
            <Card className="p-3 sm:p-4 mb-4 bg-blue-50 border-blue-200">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <p className="text-sm font-semibold text-blue-900">
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
                      className="min-h-[44px] w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white"
                    >
                      <CheckSquare className="w-4 h-4 mr-2" />
                      Mark Complete
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleBulkDelete}
                      className="min-h-[44px] w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white"
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
                    <span className="text-xs text-muted-foreground">Detailed</span>
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

                {/* Quick Mode - Text and Quantity Only */}
                {!detailedMode && (
                  <div className="flex gap-2 w-full">
                    <Input
                      type="number"
                      placeholder="Qty"
                      value={newItemQuantity}
                      onChange={(e) => setNewItemQuantity(e.target.value)}
                      className="w-20 min-h-[44px]"
                      min="1"
                    />
                    <Input
                      placeholder="e.g., Buy milk, Call dentist, Pack sunscreen"
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

                {/* Detailed Mode - All Fields */}
                {detailedMode && (
                  <div className="space-y-3">
                    <div className="flex gap-2 w-full">
                      <Input
                        type="number"
                        placeholder="Qty"
                        value={newItemQuantity}
                        onChange={(e) => setNewItemQuantity(e.target.value)}
                        className="w-20 min-h-[44px]"
                        min="1"
                      />
                      <Input
                        placeholder="e.g., Buy milk, Call dentist, Pack sunscreen"
                        value={newItemText}
                        onChange={(e) => setNewItemText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handleAddItem();
                          }
                        }}
                        className="flex-1 min-h-[44px]"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <Label className="text-xs">Priority</Label>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <HelpCircle className="w-3 h-3 text-gray-400 cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="max-w-xs">
                                  Mark items as high, medium, or low priority
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
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
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <Label className="text-xs">Due Date</Label>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <HelpCircle className="w-3 h-3 text-gray-400 cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="max-w-xs">
                                  Set a deadline for this item
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className="w-full justify-start text-left font-normal min-h-[44px]"
                            >
                              <Calendar className="mr-2 h-4 w-4" />
                              {newItemDueDate ? (
                                format(newItemDueDate, "PPP")
                              ) : (
                                <span className="text-gray-400">
                                  Select a date
                                </span>
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
                    </div>
                    <div>
                      <Label className="text-xs">Assigned To</Label>
                      <Input
                        placeholder="Person's name or email"
                        value={newItemAssignedTo}
                        onChange={(e) => setNewItemAssignedTo(e.target.value)}
                        className="min-h-[44px] mt-2"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Notes</Label>
                      <Textarea
                        placeholder="Add notes, links, or details here..."
                        value={newItemNotes}
                        onChange={(e) => setNewItemNotes(e.target.value)}
                        className="min-h-[80px] mt-2"
                      />
                    </div>
                  </div>
                )}

                {/* Add Item Button */}
                <Button onClick={handleAddItem} className="w-full min-h-[44px]">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Item
                </Button>
              </div>
            </div>
          </Card>

          {/* Sort Items Dropdown */}
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-700">Items</h3>
            <Select value={itemSortBy} onValueChange={handleItemSortChange}>
              <SelectTrigger className="w-[180px] h-[40px]">
                <SelectValue placeholder="Sort items by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">Manual</SelectItem>
                <SelectItem value="priority">Priority</SelectItem>
                <SelectItem value="dueDate">Due Date</SelectItem>
                <SelectItem value="alphabetical">Alphabetical</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Items List */}
          <div className="space-y-2">
            {list.items.length === 0 ? (
              <Card className="p-8 sm:p-16 text-center bg-gradient-to-br from-gray-50 to-white">
                <div className="max-w-md mx-auto">
                  <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Package className="w-8 h-8 text-blue-600" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">
                    This list is empty
                  </h3>
                  <p className="text-gray-600 mb-6">
                    Add your first item above to get started.
                  </p>
                </div>
              </Card>
            ) : (
              getSortedItems().map((item, index) => (
                <Card
                  key={item.id}
                  className={`p-3 sm:p-4 hover:shadow-md transition-all ${index % 2 === 1 ? "bg-gray-50" : "bg-white"}`}
                  draggable={itemSortBy === "manual"}
                  onDragStart={() =>
                    itemSortBy === "manual" && handleDragStart(item)
                  }
                  onDragOver={(e) =>
                    itemSortBy === "manual" && handleDragOver(e, item)
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
                      <div className="cursor-move mt-1 hidden sm:block">
                        <GripVertical className="w-5 h-5 text-gray-400" />
                      </div>
                    )}
                    <Checkbox
                      checked={item.completed}
                      onCheckedChange={(checked) =>
                        updateListItem(list.id, item.id, {
                          completed: checked as boolean,
                        })
                      }
                      className="mt-1 h-6 w-6 md:h-[18px] md:w-[18px] rounded md:rounded-[3px] mr-3 md:mr-2 flex-shrink-0"
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
                              className="bg-blue-50 text-blue-700 border-blue-200 text-xs"
                            >
                              Color: {item.attributes.color}
                            </Badge>
                          )}
                          {item.attributes.size && (
                            <Badge
                              variant="outline"
                              className="bg-green-50 text-green-700 border-green-200 text-xs"
                            >
                              Size: {item.attributes.size}
                            </Badge>
                          )}
                          {item.attributes.weight && (
                            <Badge
                              variant="outline"
                              className="bg-orange-50 text-orange-700 border-orange-200 text-xs"
                            >
                              Weight: {item.attributes.weight}
                            </Badge>
                          )}
                          {item.attributes.price && (
                            <Badge
                              variant="outline"
                              className="bg-purple-50 text-purple-700 border-purple-200 text-xs"
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
                            <StickyNote className="w-3 h-3 mr-1" />
                            Note
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
                      {item.links && item.links.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {item.links.map((link, idx) => (
                            <a
                              key={idx}
                              href={link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs sm:text-sm text-blue-600 hover:underline flex items-center gap-1 break-all"
                            >
                              <ExternalLink className="w-3 h-3 flex-shrink-0" />
                              {link}
                            </a>
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
                                <div className="grid grid-cols-2 gap-4">
                                  <div className="space-y-2">
                                    <Label>Text</Label>
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
                                    <Label>Assigned To</Label>
                                    <Input
                                      placeholder="Person's name"
                                      value={editingItem.assignedTo || ""}
                                      onChange={(e) =>
                                        setEditingItem({
                                          ...editingItem,
                                          assignedTo: e.target.value,
                                        })
                                      }
                                    />
                                  </div>
                                </div>

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

                                <div className="space-y-2">
                                  <Label>Attributes</Label>
                                  <div className="grid grid-cols-2 gap-3">
                                    <Input
                                      placeholder="Color"
                                      value={
                                        editingItem.attributes?.color || ""
                                      }
                                      onChange={(e) =>
                                        setEditingItem({
                                          ...editingItem,
                                          attributes: {
                                            ...editingItem.attributes,
                                            color: e.target.value,
                                          },
                                        })
                                      }
                                    />
                                    <Input
                                      placeholder="Size"
                                      value={editingItem.attributes?.size || ""}
                                      onChange={(e) =>
                                        setEditingItem({
                                          ...editingItem,
                                          attributes: {
                                            ...editingItem.attributes,
                                            size: e.target.value,
                                          },
                                        })
                                      }
                                    />
                                    <Input
                                      placeholder="Weight"
                                      value={
                                        editingItem.attributes?.weight || ""
                                      }
                                      onChange={(e) =>
                                        setEditingItem({
                                          ...editingItem,
                                          attributes: {
                                            ...editingItem.attributes,
                                            weight: e.target.value,
                                          },
                                        })
                                      }
                                    />
                                    <Input
                                      type="number"
                                      placeholder="Price"
                                      value={
                                        editingItem.attributes?.price || ""
                                      }
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

                                <div className="space-y-2">
                                  <Label>Links</Label>
                                  <div className="space-y-2">
                                    {editingItem.links &&
                                      editingItem.links.map((link, idx) => (
                                        <div key={idx} className="flex gap-2">
                                          <Input value={link} readOnly />
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() =>
                                              handleRemoveLink(link)
                                            }
                                          >
                                            <X className="w-4 h-4" />
                                          </Button>
                                        </div>
                                      ))}
                                    <div className="flex gap-2">
                                      <Input
                                        placeholder="https://..."
                                        value={newLink}
                                        onChange={(e) =>
                                          setNewLink(e.target.value)
                                        }
                                      />
                                      <Button onClick={handleAddLink}>
                                        Add
                                      </Button>
                                    </div>
                                  </div>
                                </div>

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
                                    updateListItem(
                                      list.id,
                                      editingItem.id,
                                      editingItem,
                                    );
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
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}