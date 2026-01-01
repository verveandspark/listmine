import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { useLists } from "@/contexts/useListsHook";
import { useAuth } from "@/contexts/useAuthHook";
import { useAccount } from "@/contexts/AccountContext";
import { supabase } from "@/lib/supabase";
import { canExportLists, canImportLists, canPrintLists, getAvailableExportFormats, type UserTier } from "@/lib/tierUtils";
import { ListCategory, ListType } from "@/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  Upload,
  Download,
  FileText,
  FileSpreadsheet,
  HelpCircle,
  Link2,
  Loader2,
  ShoppingCart,
  ExternalLink,
  AlertCircle,
  ListPlus,
  Plus,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { validateImportData, validateCategory } from "@/lib/validation";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import AddToExistingListModal from "./AddToExistingListModal";

const listTypes: { value: ListType; label: string }[] = [
  { value: "task-list", label: "Task List" },
  { value: "todo-list", label: "To-Do List" },
  { value: "registry-list", label: "Registry List" },
  { value: "checklist", label: "Checklist" },
  { value: "grocery-list", label: "Grocery List" },
  { value: "shopping-list", label: "Shopping List" },
  { value: "idea-list", label: "Idea List" },
  { value: "multi-topic", label: "Multi-Topic" },
  { value: "compare-contrast", label: "Compare & Contrast" },
  { value: "pro-con", label: "Pro/Con List" },
  { value: "multi-option", label: "Multi-Option" },
  { value: "custom", label: "Custom" },
];

interface ScrapedItem {
  name: string;
  price?: string;
  link?: string;
  image?: string;
  selected?: boolean;
}

export default function ImportExport() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { importList, exportList, lists, importFromShareLink, importFromWishlist } = useLists();
  const { user } = useAuth();
  const { toast } = useToast();
  
  // Get where the user came from for navigation back - use native history
  const handleBack = () => {
    // Use browser native back navigation with replace to avoid ping-pong
    const stateFrom = (location.state as any)?.from;
    if (stateFrom && stateFrom !== '/import-export') {
      navigate(stateFrom, { replace: true });
    } else if (window.history.length > 1) {
      window.history.back();
    } else {
      navigate('/dashboard', { replace: true });
    }
  };
  
  // Use global account context
  const { isTeamContext, effectiveTier, currentAccount } = useAccount();
  
  // Get the account ID to use for imports (null for personal, team account ID for team)
  const importAccountId = currentAccount?.type === 'team' ? currentAccount.id : null;
  
  const canImport = canImportLists(effectiveTier);
  const canExport = canExportLists(effectiveTier);
  const canPrint = canPrintLists(effectiveTier);
  const availableFormats = getAvailableExportFormats(effectiveTier);
  
  // Show import gating message only for free personal users (not in team context)
  const showImportGatingMessage = !canImport && !isTeamContext;
  // Show export gating message only for free personal users (not in team context)
  const showExportGatingMessage = !canExport && !isTeamContext;
  
  const [importData, setImportData] = useState("");
  const [importCategory, setImportCategory] = useState<ListCategory>("Tasks");
  const [importListType, setImportListType] = useState<ListType>("custom");
  const [importFormat, setImportFormat] = useState<"csv" | "txt">("txt");
  const [selectedListId, setSelectedListId] = useState("");
  const [exportFormat, setExportFormat] = useState<"csv" | "txt" | "pdf">(
    "txt",
  );
  const [shareUrl, setShareUrl] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  
  // Handle pre-filled share ID from URL
  useEffect(() => {
    const shareId = searchParams.get('shareId');
    if (shareId) {
      setShareUrl(shareId);
      // Clear the URL parameter
      setSearchParams({});
    }
  }, [searchParams, setSearchParams]);
  
  // Wishlist scraping state
  const [wishlistUrl, setWishlistUrl] = useState("");
  const [wishlistLoading, setWishlistLoading] = useState(false);
  const [scrapedItems, setScrapedItems] = useState<ScrapedItem[]>([]);
  const [retailer, setRetailer] = useState("");
  const [wishlistError, setWishlistError] = useState("");
  const [wishlistName, setWishlistName] = useState("");
  
  // Import destination state (new list vs existing list)
  const [importDestination, setImportDestination] = useState<"new" | "existing">("new");
  const [wishlistDestination, setWishlistDestination] = useState<"new" | "existing">("new");
  const [fileDestination, setFileDestination] = useState<"new" | "existing">("new");
  
  // Add to existing list modal state
  const [addToExistingModalOpen, setAddToExistingModalOpen] = useState(false);
  const [itemsForExistingList, setItemsForExistingList] = useState<ScrapedItem[]>([]);
  const [existingListSourceType, setExistingListSourceType] = useState<"csv" | "amazon" | "manual" | "share">("csv");

  const handleImport = () => {
    // Validate import data
    const dataValidation = validateImportData(importData);
    if (!dataValidation.valid) {
      toast({
        title: "⚠️ Invalid import data",
        description: dataValidation.error,
        variant: "destructive",
      });
      return;
    }

    // Validate category
    const categoryValidation = validateCategory(importCategory);
    if (!categoryValidation.valid) {
      toast({
        title: "⚠️ Invalid category",
        description: categoryValidation.error,
        variant: "destructive",
      });
      return;
    }

    // If adding to existing list, open the modal
    if (fileDestination === "existing") {
      // Parse the import data into items
      const lines = dataValidation.value!.split("\n").filter((line) => line.trim());
      const parsedItems: ScrapedItem[] = lines.map((line) => ({
        name: line.trim(),
        selected: true,
      }));
      
      setItemsForExistingList(parsedItems);
      setExistingListSourceType(importFormat === "csv" ? "csv" : "manual");
      setAddToExistingModalOpen(true);
      return;
    }

    try {
      importList(
        dataValidation.value!,
        importFormat,
        importCategory,
        importListType,
        importAccountId, // Pass account ID for team imports
      );
      toast({
        title: "List imported successfully!",
        description: "Your list has been added to your dashboard",
      });
      setImportData("");
      navigate("/dashboard");
    } catch (error: any) {
      toast({
        title: "❌ Import failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const extractShareId = (url: string): string | null => {
    try {
      const trimmedUrl = url.trim();
      
      if (trimmedUrl.includes("/shared/")) {
        const parts = trimmedUrl.split("/shared/");
        return parts[1]?.split(/[?#]/)[0] || null;
      }
      
      if (!trimmedUrl.includes("/") && !trimmedUrl.includes("http")) {
        return trimmedUrl;
      }
      
      return null;
    } catch {
      return null;
    }
  };

  const handleImportFromShareLink = async () => {
    if (!shareUrl.trim()) {
      toast({
        title: "⚠️ Invalid share link",
        description: "Please enter a share link or ID",
        variant: "destructive",
      });
      return;
    }

    const shareId = extractShareId(shareUrl);
    if (!shareId) {
      toast({
        title: "⚠️ Invalid share link format",
        description: "Please paste the full URL or share ID.",
        variant: "destructive",
      });
      return;
    }

    setIsImporting(true);

    try {
      const result = await importFromShareLink(shareId, importAccountId);
      
      if (!result) {
        throw new Error("Failed to import list");
      }
      
      // Check if result contains skipped items info
      const importResult = result as { listId: string; skippedItems: number } | string;
      const listId = typeof importResult === 'object' && 'listId' in importResult ? importResult.listId : importResult;
      const skippedItems = typeof importResult === 'object' && 'skippedItems' in importResult ? importResult.skippedItems : 0;
      
      if (skippedItems > 0) {
        toast({
          title: "⚠️ List imported with warnings",
          description: `${skippedItems} item${skippedItems > 1 ? 's were' : ' was'} skipped because ${skippedItems > 1 ? 'they had' : 'it had'} no text.`,
        });
      } else {
        toast({
          title: "List imported successfully!",
          description: "The list has been added to your account.",
        });
      }
      
      setShareUrl("");
      navigate(`/list/${listId}`);
    } catch (err: any) {
      toast({
        title: "❌ Import failed",
        description: err.message || "Failed to import list",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validExtensions = [".txt", ".csv"];
    const fileExtension = file.name
      .substring(file.name.lastIndexOf("."))
      .toLowerCase();
    if (!validExtensions.includes(fileExtension)) {
      toast({
        title: "⚠️ Invalid file type",
        description:
          "We couldn't read this file. Make sure it's a valid CSV or TXT file.",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 1MB)
    if (file.size > 1024 * 1024) {
      toast({
        title: "⚠️ File too large",
        description: "File must be less than 1MB",
        variant: "destructive",
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;

      // Validate content
      const validation = validateImportData(content);
      if (!validation.valid) {
        toast({
          title: "⚠️ Invalid file content",
          description: validation.error,
          variant: "destructive",
        });
        return;
      }

      setImportData(content);
    };
    reader.onerror = () => {
      toast({
        title: "❌ Failed to read file",
        description:
          "We couldn't read this file. Try again, or contact support if the problem continues.",
        variant: "destructive",
      });
    };
    reader.readAsText(file);
  };

  const handleExport = () => {
    if (!selectedListId) {
      toast({
        title: "⚠️ No list selected",
        description: "Please select a list to export",
        variant: "destructive",
      });
      return;
    }

    try {
      exportList(selectedListId, exportFormat);
      toast({
        title: "List exported successfully!",
        description: `${exportFormat.toUpperCase()} file downloaded`,
      });
    } catch (error: any) {
      toast({
        title: "❌ Export failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleWishlistScrape = async () => {
    if (!wishlistUrl.trim()) {
      setWishlistError("Please enter a wishlist URL");
      return;
    }

    setWishlistLoading(true);
    setWishlistError("");
    setScrapedItems([]);

    try {
      const { data, error } = await supabase.functions.invoke(
        "supabase-functions-scrape-wishlist",
        {
          body: { url: wishlistUrl.trim() },
        }
      );

      if (error) {
        throw new Error(error.message || "Failed to scrape wishlist");
      }

      if (!data.success) {
        throw new Error(data.error || "Failed to scrape wishlist");
      }

      const itemsWithSelection = data.items.map((item: ScrapedItem) => ({
        ...item,
        selected: true,
      }));

      setScrapedItems(itemsWithSelection);
      setRetailer(data.retailer);
      setWishlistName(`${data.retailer} Wishlist`);

      toast({
        title: "Wishlist scraped successfully",
        description: `Found ${data.items.length} items from ${data.retailer}`,
      });
    } catch (err: any) {
      console.error("Error:", err);
      setWishlistError(
        err.message || "Failed to scrape wishlist. Please check the URL and try again."
      );
    } finally {
      setWishlistLoading(false);
    }
  };

  const handleWishlistImport = async () => {
    const selectedItems = scrapedItems.filter((item) => item.selected);

    if (selectedItems.length === 0) {
      toast({
        title: "⚠️ No items selected",
        description: "Please select at least one item to import",
        variant: "destructive",
      });
      return;
    }

    // If adding to existing list, open the modal
    if (wishlistDestination === "existing") {
      setItemsForExistingList(selectedItems);
      setExistingListSourceType("amazon");
      setAddToExistingModalOpen(true);
      return;
    }

    if (!wishlistName.trim()) {
      toast({
        title: "⚠️ List name required",
        description: "Please enter a name for your list",
        variant: "destructive",
      });
      return;
    }

    try {
      const newListId = await importFromWishlist(selectedItems, wishlistName, "Shopping", importAccountId);
      
      toast({
        title: "Wishlist imported successfully!",
        description: `Created "${wishlistName}" with ${selectedItems.length} items`,
      });
      
      // Reset state
      setWishlistUrl("");
      setScrapedItems([]);
      setRetailer("");
      setWishlistError("");
      setWishlistName("");
      
      navigate(`/list/${newListId}`);
    } catch (err: any) {
      toast({
        title: "❌ Import failed",
        description: err.message,
        variant: "destructive",
      });
    }
  };

  const toggleItemSelection = (index: number) => {
    setScrapedItems((items) =>
      items.map((item, i) =>
        i === index ? { ...item, selected: !item.selected } : item
      )
    );
  };

  const toggleAllItems = () => {
    const allSelected = scrapedItems.every((item) => item.selected);
    setScrapedItems((items) =>
      items.map((item) => ({ ...item, selected: !allSelected }))
    );
  };

  const selectedCount = scrapedItems.filter((item) => item.selected).length;

  const categories: ListCategory[] = [
    "Tasks",
    "Shopping",
    "Meals",
    "Household",
    "Planning",
    "School",
    "Work",
    "Other",
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-white to-secondary/10 animate-in fade-in duration-200">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleBack}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Import & Export
              </h1>
              <p className="text-sm text-gray-600">Manage your list data</p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs defaultValue="import" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="import">
              <Upload className="w-4 h-4 mr-2" />
              Import
            </TabsTrigger>
            <TabsTrigger value="export">
              <Download className="w-4 h-4 mr-2" />
              Export
            </TabsTrigger>
          </TabsList>

          <TabsContent value="import" className="mt-6 space-y-6">
            <Card className="p-4 sm:p-6">
              <div className="flex items-center gap-2 mb-4">
                <Link2 className="w-5 h-5 text-primary" />
                <h2 className="text-xl font-semibold text-gray-900">
                  Import from ListMine Share Link
                </h2>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="w-5 h-5 text-gray-400 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">
                        Paste a share link from another ListMine user to create a copy in your account
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                Copy lists shared by other ListMine users
              </p>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="share-url">Share Link or ID</Label>
                  <Input
                    id="share-url"
                    placeholder="https://app.listmine.com/shared/abc123 or abc123"
                    value={shareUrl}
                    onChange={(e) => setShareUrl(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !isImporting) {
                        handleImportFromShareLink();
                      }
                    }}
                    className="min-h-[44px] mt-2"
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    You can paste the full URL or just the share ID
                  </p>
                </div>

                <Button 
                  onClick={handleImportFromShareLink} 
                  className="w-full min-h-[44px]"
                  disabled={isImporting}
                >
                  {isImporting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4 mr-2" />
                      Import from Share Link
                    </>
                  )}
                </Button>
              </div>
            </Card>

            <Card className="p-4 sm:p-6">
              <div className="flex items-center gap-2 mb-4">
                <ShoppingCart className="w-5 h-5 text-accent" />
                <h2 className="text-xl font-semibold text-gray-900">
                  Import from Public List
                </h2>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="w-5 h-5 text-gray-400 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">
                        Import items from public wishlists, registries, and shopping lists from retailer sites
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              
              <div className="space-y-3 mb-4">
                <p className="text-sm text-gray-600">
                  Paste a public list URL from any retailer site to import items. Currently supports: Amazon wishlists. More retailers coming soon!
                </p>
                <p className="text-xs text-gray-500">
                  Disclaimer: Imports public wishlists, registries, and shopping lists from third-party sites. Not affiliated with any retailer. You're responsible for data you import.{" "}
                  <a 
                    href="https://listmine.com/terms-of-use" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    Learn More
                  </a>
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="wishlist-url">List URL</Label>
                  <div className="flex gap-2 mt-2">
                    <Input
                      id="wishlist-url"
                      placeholder="Paste public list URL"
                      value={wishlistUrl}
                      onChange={(e) => setWishlistUrl(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !wishlistLoading) {
                          handleWishlistScrape();
                        }
                      }}
                      disabled={wishlistLoading || scrapedItems.length > 0}
                      className="flex-1 min-h-[44px]"
                    />
                    {scrapedItems.length === 0 && (
                      <Button onClick={handleWishlistScrape} disabled={wishlistLoading}>
                        {wishlistLoading ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Importing...
                          </>
                        ) : (
                          "Import"
                        )}
                      </Button>
                    )}
                  </div>
                </div>

                {wishlistError && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{wishlistError}</AlertDescription>
                  </Alert>
                )}

                {scrapedItems.length > 0 && (
                  <>
                    {/* Import Destination Choice */}
                    <div className="space-y-3 p-4 bg-gray-50 rounded-lg border">
                      <Label className="text-sm font-medium">Import Destination</Label>
                      <RadioGroup
                        value={wishlistDestination}
                        onValueChange={(value) => setWishlistDestination(value as "new" | "existing")}
                        className="flex flex-col gap-2"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="new" id="wishlist-new" />
                          <Label htmlFor="wishlist-new" className="font-normal cursor-pointer flex items-center gap-2">
                            <Plus className="w-4 h-4" />
                            Create new list
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="existing" id="wishlist-existing" />
                          <Label htmlFor="wishlist-existing" className="font-normal cursor-pointer flex items-center gap-2">
                            <ListPlus className="w-4 h-4" />
                            Add to existing list
                          </Label>
                        </div>
                      </RadioGroup>
                    </div>

                    {wishlistDestination === "new" && (
                      <div>
                        <Label htmlFor="wishlist-name">List Name</Label>
                        <Input
                          id="wishlist-name"
                          value={wishlistName}
                          onChange={(e) => setWishlistName(e.target.value)}
                          placeholder="Enter list name"
                          className="mt-2 min-h-[44px]"
                        />
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={scrapedItems.every((item) => item.selected)}
                          onCheckedChange={toggleAllItems}
                        />
                        <Label className="text-sm font-medium">
                          Select All ({selectedCount} of {scrapedItems.length} selected)
                        </Label>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setScrapedItems([]);
                          setRetailer("");
                          setWishlistError("");
                        }}
                      >
                        Clear
                      </Button>
                    </div>

                    <ScrollArea className="h-[300px] border rounded-lg">
                      <div className="p-4 space-y-3">
                        {scrapedItems.map((item, index) => (
                          <div
                            key={index}
                            className="flex items-start gap-3 p-3 border rounded-lg hover:bg-primary/5 transition-colors"
                          >
                            <Checkbox
                              checked={item.selected}
                              onCheckedChange={() => toggleItemSelection(index)}
                              className="mt-1"
                            />
                            {item.image && (
                              <img
                                src={item.image}
                                alt={item.name}
                                className="w-16 h-16 object-cover rounded"
                              />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm line-clamp-2">
                                {item.name}
                              </p>
                              {item.price && (
                                <p className="text-sm text-accent font-semibold mt-1">
                                  {item.price}
                                </p>
                              )}
                              {item.link && (
                                <a
                                  href={item.link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-primary hover:underline flex items-center gap-1 mt-1"
                                >
                                  View on {retailer}
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>

                    <Button onClick={handleWishlistImport} className="w-full min-h-[44px]">
                      {wishlistDestination === "existing" ? (
                        <>
                          <ListPlus className="w-4 h-4 mr-2" />
                          Add to Existing List ({selectedCount} items)
                        </>
                      ) : (
                        <>
                          <ShoppingCart className="w-4 h-4 mr-2" />
                          Create New List ({selectedCount} items)
                        </>
                      )}
                    </Button>
                  </>
                )}
              </div>
            </Card>

            <Card className="p-4 sm:p-6">
              <div className="flex items-center gap-2 mb-4">
                <h2 className="text-xl font-semibold text-gray-900">
                  Import List from File
                </h2>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="w-5 h-5 text-gray-400 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">
                        Import items from a CSV or TXT file, or paste them
                        directly
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              
              {/* Show import gating message for free tier */}
              {showImportGatingMessage ? (
                <Alert className="mb-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="flex items-center justify-between">
                    <span>File import is available on Good and above plans.</span>
                    <Button
                      variant="link"
                      className="p-0 h-auto"
                      onClick={() => navigate('/upgrade', { state: { from: location.pathname } })}
                    >
                      Upgrade now
                    </Button>
                  </AlertDescription>
                </Alert>
              ) : (
                <p className="text-sm text-gray-600 mb-4">
                  Upload a file or paste your list below
                </p>
              )}

              <div className={`space-y-4 ${showImportGatingMessage ? 'opacity-50 pointer-events-none' : ''}`}>
                <div>
                  <Label>Upload File</Label>
                  <Input
                    type="file"
                    accept=".txt,.csv"
                    onChange={handleFileUpload}
                    className="min-h-[44px] mt-2"
                  />
                </div>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-white px-2 text-gray-500">
                      Or paste text
                    </span>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label>Paste Items</Label>
                    <p className="text-xs text-gray-500">
                      Paste one item per line. We'll create them all at once.
                    </p>
                  </div>
                  <Textarea
                    placeholder="Example:&#10;Buy milk&#10;Call dentist&#10;Pack sunscreen"
                    value={importData}
                    onChange={(e) => setImportData(e.target.value)}
                    className="min-h-[200px] font-mono text-sm"
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    <strong>Example:</strong>
                    <br />
                    Buy milk
                    <br />
                    Call dentist
                    <br />
                    Pack sunscreen
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label>Format</Label>
                    <Select
                      value={importFormat}
                      onValueChange={(value) =>
                        setImportFormat(value as "csv" | "txt")
                      }
                    >
                      <SelectTrigger className="min-h-[44px] mt-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="txt">Text (.txt)</SelectItem>
                        <SelectItem value="csv">CSV (.csv)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Category</Label>
                    <Select
                      value={importCategory}
                      onValueChange={(value) =>
                        setImportCategory(value as ListCategory)
                      }
                    >
                      <SelectTrigger className="min-h-[44px] mt-2">
                        <SelectValue />
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
                </div>

                <div>
                  <Label>List Type</Label>
                  <Select
                    value={importListType}
                    onValueChange={(value) =>
                      setImportListType(value as ListType)
                    }
                  >
                    <SelectTrigger className="min-h-[44px] mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {listTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Import Destination Choice */}
                <div className="space-y-3 p-4 bg-gray-50 rounded-lg border">
                  <Label className="text-sm font-medium">Import Destination</Label>
                  <RadioGroup
                    value={fileDestination}
                    onValueChange={(value) => setFileDestination(value as "new" | "existing")}
                    className="flex flex-col gap-2"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="new" id="file-new" />
                      <Label htmlFor="file-new" className="font-normal cursor-pointer flex items-center gap-2">
                        <Plus className="w-4 h-4" />
                        Create new list
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="existing" id="file-existing" />
                      <Label htmlFor="file-existing" className="font-normal cursor-pointer flex items-center gap-2">
                        <ListPlus className="w-4 h-4" />
                        Add to existing list
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                <Button onClick={handleImport} className="w-full min-h-[44px]">
                  {fileDestination === "existing" ? (
                    <>
                      <ListPlus className="w-4 h-4 mr-2" />
                      Add to Existing List
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Create New List
                    </>
                  )}
                </Button>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="export" className="mt-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Export List</CardTitle>
                  {isTeamContext && canExport && (
                    <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                      Based on team plan
                    </span>
                  )}
                </div>
                <CardDescription>
                  Export your list to CSV, TXT, or PDF format for backup or
                  sharing.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {showExportGatingMessage ? (
                  <div className="space-y-4">
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        <strong>Export is available on paid plans.</strong>
                        <br />
                        Free tier users can print lists directly from the list view.
                        Upgrade to export your lists to CSV, TXT, or PDF.
                      </AlertDescription>
                    </Alert>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => navigate("/upgrade")}
                    >
                      Upgrade to Export
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label>Select List</Label>
                      <Select
                        value={selectedListId}
                        onValueChange={setSelectedListId}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Choose a list to export" />
                        </SelectTrigger>
                        <SelectContent>
                          {lists.map((list) => (
                            <SelectItem key={list.id} value={list.id}>
                              {list.title} ({list.category}) - {list.items.length}{" "}
                              items
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Format</Label>
                      <Select
                        value={exportFormat}
                        onValueChange={(value) =>
                          setExportFormat(value as "csv" | "txt" | "pdf")
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {availableFormats.includes("txt") && (
                            <SelectItem value="txt">
                              <div className="flex items-center">
                                <FileText className="w-4 h-4 mr-2" />
                                Text File (.txt)
                              </div>
                            </SelectItem>
                          )}
                          {availableFormats.includes("csv") && (
                            <SelectItem value="csv">
                              <div className="flex items-center">
                                <FileSpreadsheet className="w-4 h-4 mr-2" />
                                CSV File (.csv)
                              </div>
                            </SelectItem>
                          )}
                          {availableFormats.includes("pdf") && (
                            <SelectItem value="pdf">
                              <div className="flex items-center">
                                <FileText className="w-4 h-4 mr-2" />
                                PDF File (.pdf)
                              </div>
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>

                    {selectedListId && (
                      <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
                        <p className="text-sm text-primary">
                          <strong>Preview:</strong> The selected list will be
                          exported with all items, quantities, links, and
                          attributes.
                        </p>
                      </div>
                    )}

                    <Button
                      onClick={handleExport}
                      className="w-full"
                      disabled={!selectedListId}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Export List
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Add to Existing List Modal */}
      <AddToExistingListModal
        open={addToExistingModalOpen}
        onOpenChange={setAddToExistingModalOpen}
        items={itemsForExistingList}
        sourceType={existingListSourceType}
        onSuccess={() => {
          // Reset state after successful add
          setImportData("");
          setScrapedItems([]);
          setWishlistUrl("");
          setWishlistName("");
          setRetailer("");
          setWishlistError("");
          setFileDestination("new");
          setWishlistDestination("new");
          navigate("/dashboard");
        }}
      />
    </div>
  );
}