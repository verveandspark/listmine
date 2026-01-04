import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Loader2,
  ArrowLeft,
  Package,
  Calendar,
  Flag,
  StickyNote,
  Link as LinkIcon,
  User as UserIcon,
  ShoppingCart,
  ExternalLink,
  Eye,
  Download,
  Copy,
  Info,
} from "lucide-react";
import { format } from "date-fns";
import { isToday, isPast } from "date-fns";
import PurchaseModal from "./PurchaseModal";

export default function SharedListView() {
  const { shareId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [list, setList] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [purchases, setPurchases] = useState<Record<string, any>>({});
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
  const [showPurchaserInfo, setShowPurchaserInfo] = useState(false);
  const [shareMode, setShareMode] = useState<string>('view_only');
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // Check if user is logged in
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setIsLoggedIn(!!session);
    };
    checkAuth();
    
    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setIsLoggedIn(!!session);
    });
    
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const fetchSharedList = async () => {
      try {
        if (!shareId) {
          console.error("SharedListView: No shareId in URL params");
          setError("Invalid share link");
          setIsLoading(false);
          return;
        }

        console.log("SharedListView: Fetching list with shareId:", shareId);
        console.log("SharedListView: Full URL:", window.location.href);
        console.log("SharedListView: shareId from URL params:", new URLSearchParams(window.location.search).get('shareId'));

        // Use RPC function to fetch shared list (bypasses RLS issues)
        const { data: listDataArray, error: listError } = await supabase
          .rpc("get_shared_list_by_share_link", { p_share_link: shareId });

        console.log("SharedListView: List query result:", { listDataArray, listError });
        console.log("SharedListView: RPC called with shareId:", shareId);

        if (listError || !listDataArray || listDataArray.length === 0) {
          console.error("SharedListView: List not found or error:", listError);
          setError("This list is no longer shared or has been removed");
          setIsLoading(false);
          return;
        }

        const listData = listDataArray[0];

        // Set the show_purchaser_info setting
        setShowPurchaserInfo(listData.show_purchaser_info || false);
        
        // Set the share mode
        setShareMode(listData.share_mode || 'view_only');

        // Use RPC function to fetch items for shared list
        const { data: itemsData, error: itemsError } = await supabase
          .rpc("get_shared_list_items", { p_list_id: listData.id });

        console.log("SharedListView: Items query result:", { itemsData, itemsError });

        if (itemsError) {
          console.error("SharedListView: Could not load items:", itemsError);
          setError("Could not load items");
          setIsLoading(false);
          return;
        }

        // Fetch purchases for this list using RPC function
        const { data: purchasesData, error: purchasesError } = await supabase
          .rpc("get_shared_list_purchases", { p_list_id: listData.id });

        console.log("SharedListView: Purchases query result:", { purchasesData, purchasesError });

        // Create a map of item_id to purchase data
        const purchasesMap: Record<string, any> = {};
        if (purchasesData) {
          purchasesData.forEach((purchase: any) => {
            purchasesMap[purchase.item_id] = purchase;
          });
        }
        setPurchases(purchasesMap);

        setList({
          id: listData.id,
          title: listData.title,
          category: listData.category,
          listType: listData.list_type,
          items: (itemsData || []).map((item: any) => ({
            id: item.id,
            text: item.text,
            quantity: item.quantity,
            priority: item.priority,
            dueDate: item.due_date,
            notes: item.notes,
            assignedTo: item.assigned_to,
            links: item.links || [],
            completed: item.completed,
            order: item.item_order,
            attributes: item.attributes || {},
          })),
          tags: listData.tags || [],
          lastEditedAt: listData.last_edited_at || listData.updated_at,
          lastEditedByEmail: listData.last_edited_by_email,
        });
        setIsLoading(false);
        console.log("SharedListView: Successfully loaded list with", itemsData?.length || 0, "items");
      } catch (err: any) {
        console.error("SharedListView: Unexpected error:", err);
        setError(err.message || "An error occurred");
        setIsLoading(false);
      }
    };

    fetchSharedList();
  }, [shareId]);

  // Set up real-time subscriptions for purchases and items
  useEffect(() => {
    if (!list?.id) return;

    // Subscribe to purchases changes
    const purchasesChannel = supabase
      .channel(`purchases:${list.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'purchases',
          filter: `list_id=eq.${list.id}`,
        },
        (payload) => {
          console.log('Purchase change received:', payload);
          
          if (payload.eventType === 'INSERT') {
            setPurchases((prev) => ({
              ...prev,
              [payload.new.item_id]: payload.new,
            }));
          } else if (payload.eventType === 'DELETE') {
            setPurchases((prev) => {
              const updated = { ...prev };
              delete updated[payload.old.item_id];
              return updated;
            });
          }
        }
      )
      .subscribe();

    // Subscribe to list_items changes (for quantity updates)
    const itemsChannel = supabase
      .channel(`list_items:${list.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'list_items',
          filter: `list_id=eq.${list.id}`,
        },
        (payload) => {
          console.log('Item change received:', payload);
          
          setList((prevList: any) => ({
            ...prevList,
            items: prevList.items.map((item: any) =>
              item.id === payload.new.id
                ? {
                    ...item,
                    attributes: payload.new.attributes || {},
                  }
                : item
            ),
          }));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(purchasesChannel);
      supabase.removeChannel(itemsChannel);
    };
  }, [list?.id]);

  const handlePurchaseClick = (item: any) => {
    // Check if item is already purchased
    if (purchases[item.id]) {
      toast({
        title: "Already Purchased",
        description: "This item is already being purchased",
        variant: "destructive",
      });
      return;
    }

    setSelectedItem(item);
    setIsPurchaseModalOpen(true);
  };

  const handlePurchaseComplete = async (purchaserName: string | null, purchaseNote: string | null) => {
    if (!selectedItem || !list) return;

    try {
      console.log("Starting purchase process for item:", selectedItem.id);
      
      // Update item status to 'Purchased' FIRST
      const updatedAttributes = {
        ...selectedItem.attributes,
        purchaseStatus: "purchased",
      };

      // If quantity_needed > 1, decrement it
      if (selectedItem.attributes?.quantityNeeded && selectedItem.attributes.quantityNeeded > 1) {
        updatedAttributes.quantityNeeded = selectedItem.attributes.quantityNeeded - 1;
      }

      const { error: updateError } = await supabase
        .from("list_items")
        .update({ attributes: updatedAttributes })
        .eq("id", selectedItem.id);

      if (updateError) {
        console.error("Item update error:", updateError);
        throw updateError;
      }

      console.log("Item attributes updated successfully with purchaseStatus:", updatedAttributes);

      // Then insert purchase record
      const { data: purchaseData, error: purchaseError } = await supabase
        .from("purchases")
        .insert({
          list_id: list.id,
          item_id: selectedItem.id,
          purchaser_name: purchaserName,
          purchase_note: purchaseNote,
        })
        .select()
        .single();

      if (purchaseError) {
        console.error("Purchase insert error:", purchaseError);
        throw purchaseError;
      }

      console.log("Purchase record created:", purchaseData);

      // Update local state immediately
      setPurchases((prev) => ({
        ...prev,
        [selectedItem.id]: purchaseData,
      }));

      setList((prevList: any) => ({
        ...prevList,
        items: prevList.items.map((item: any) =>
          item.id === selectedItem.id
            ? { ...item, attributes: updatedAttributes }
            : item
        ),
      }));

      toast({
        title: "Thank you!",
        description: "Item marked as purchased",
      });

      setIsPurchaseModalOpen(false);
      setSelectedItem(null);
    } catch (error: any) {
      console.error("Error completing purchase:", error);
      toast({
        title: "❌ Failed to mark item as purchased",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    }
  };

  // Use the centralized normalizeListType from lib
  const normalizeListTypeLocal = (listType: string | undefined): string => {
    if (!listType) return "Custom";
    const normalizations: Record<string, string> = {
      "todo-list": "To-Do",
      "todo": "To-Do",
      "task-list": "To-Do",
      "checklist": "To-Do",
      "idea-list": "Idea",
      "idea": "Idea",
      "registry-list": "Registry",
      "registry": "Registry",
      "wishlist": "Wishlist",
      "shopping-list": "Shopping List",
      "grocery-list": "Shopping List",
      "grocery": "Shopping List",
    };
    return normalizations[listType.toLowerCase()] || "Custom";
  };

  const isRegistryOrWishlist = (listType: string | undefined): boolean => {
    const normalized = normalizeListTypeLocal(listType);
    return normalized === "Registry" || normalized === "Wishlist";
  };

  const canImport = shareMode === 'importable';
  const canPurchase = shareMode === 'registry_buyer';

  const handleImportClick = () => {
    setShowImportDialog(true);
  };

  const handleConfirmImport = async () => {
    if (!shareId) return;
    
    setIsImporting(true);
    try {
      // Check if user is already logged in
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        // User is logged in, navigate directly to dashboard with import action
        navigate(`/dashboard?importShareId=${shareId}`);
      } else {
        // User not logged in, redirect to auth with import intent
        navigate(`/auth?redirect=/dashboard&importShareId=${shareId}`);
      }
    } catch (error: any) {
      toast({
        title: "❌ Import failed",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
      setShowImportDialog(false);
    }
  };

  // Fallback clipboard function for environments where Clipboard API is blocked
  const copyToClipboard = async (text: string): Promise<boolean> => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (err) {
        console.warn("Clipboard API failed:", err);
      }
    }
    
    try {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.setAttribute("readonly", "");
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
      textArea.setSelectionRange(0, text.length);
      const success = document.execCommand("copy");
      document.body.removeChild(textArea);
      return success;
    } catch (err) {
      console.warn("execCommand fallback failed:", err);
      return false;
    }
  };

  const handleCopyLink = async () => {
    const link = window.location.href;
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    
    if (isMobile && navigator.share) {
      try {
        await navigator.share({
          title: list.title,
          text: `Check out this list: ${list.title}`,
          url: link,
        });
        toast({
          title: "Link shared!",
          description: "Link shared successfully",
        });
        return;
      } catch (shareErr: any) {
        if (shareErr.name === 'AbortError') return;
      }
    }
    
    const copied = await copyToClipboard(link);
    if (copied) {
      toast({
        title: "Link copied!",
        description: "Share link copied to clipboard",
      });
    } else {
      toast({
        title: "📋 Share link",
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
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/10 via-white to-secondary/10 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-4" />
          <p className="text-gray-600 text-lg">Loading shared list...</p>
        </div>
      </div>
    );
  }

  if (error || !list) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/10 via-white to-secondary/10 flex items-center justify-center">
        <Card className="p-8 text-center max-w-md">
          <h2 className="text-xl font-semibold mb-4 text-destructive">
            {error || "List not found"}
          </h2>
          <p className="text-gray-600 mb-6">
            This list may have been removed or the link is invalid.
          </p>
          <Button onClick={() => navigate("/")} variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Go Home
          </Button>
        </Card>
      </div>
    );
  }

  const getDueDateColor = (dueDate: any) => {
    if (!dueDate) return "";
    const date = new Date(dueDate);
    if (isToday(date)) return "text-accent bg-accent/10 border-accent/20";
    if (isPast(date)) return "text-red-600 bg-red-50 border-red-200";
    return "text-muted-foreground bg-muted border-border";
  };

  const priorityColors: any = {
    low: "bg-success/10 text-success border-success/20",
    medium: "bg-warning/10 text-warning border-warning/20",
    high: "bg-destructive/10 text-destructive border-destructive/20",
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-white to-secondary/10">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg sm:text-2xl font-bold text-gray-900 truncate">
                  {list.title}
                </h1>
                {shareMode === 'view_only' && (
                  <Badge variant="outline" className="bg-[#c7d8e3] text-[#1f628e] border-[#8fb1c7] flex items-center gap-1">
                    <Eye className="w-3 h-3" />
                    View Only
                  </Badge>
                )}
                {canImport && (
                  <Badge variant="outline" className="bg-[#bfe9e9] text-[#00a8a8] border-[#80d4d4] flex items-center gap-1">
                    <Download className="w-3 h-3" />
                    Importable
                  </Badge>
                )}
                {canPurchase && (
                  <Badge variant="outline" className="bg-[#fce4ec] text-[#e879a0] border-[#f8bbd9] flex items-center gap-1">
                    <ShoppingCart className="w-3 h-3" />
                    Registry Mode
                  </Badge>
                )}
              </div>
              <p className="text-xs sm:text-sm text-gray-600 mt-1">
                {list.category} · {list.items.length} items · 
                {normalizeListTypeLocal(list.listType) === "Registry" ? " Shared Registry" : 
                 normalizeListTypeLocal(list.listType) === "Wishlist" ? " Shared Wishlist" : 
                 " Shared List"}
                {list.lastEditedAt && (
                  <span className="ml-1">
                    · Last updated {new Date(list.lastEditedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                onClick={handleCopyLink}
                variant="outline"
                size="sm"
                className="min-h-[40px]"
              >
                <Copy className="w-4 h-4 mr-2" />
                Copy Link
              </Button>
              {canImport && (
                <Button
                  onClick={handleImportClick}
                  variant="default"
                  size="sm"
                  className="min-h-[40px] bg-[#00a8a8] hover:bg-[#008888]"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Import to My Lists
                </Button>
              )}
              <Button
                onClick={() => navigate("/")}
                variant="ghost"
                size="sm"
                className="min-h-[40px]"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Info Banner */}
      <div className="bg-[#c7d8e3] border-b border-[#8fb1c7] px-4 sm:px-6 lg:px-8 py-3">
        <div className="max-w-4xl mx-auto flex items-start sm:items-center gap-3">
          <Info className="w-5 h-5 text-[#1f628e] flex-shrink-0 mt-0.5 sm:mt-0" />
          <div className="flex-1 text-sm text-[#174a6b]">
            <span className="font-medium">You're viewing a shared list.</span>{" "}
            {canPurchase ? (
              <span>
                This is a gift registry. Click "I'm buying this" on items you plan to purchase so the owner knows!
              </span>
            ) : canImport ? (
              <span>
                You can browse items here or <button onClick={handleImportClick} className="underline font-medium hover:text-[#1f628e]">import a copy</button> to your account.
              </span>
            ) : (
              <span>This list is view-only and cannot be imported.</span>
            )}
          </div>
        </div>
      </div>

      <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-8 max-w-4xl mx-auto">
        {list.tags && list.tags.length > 0 && (
          <Card className="p-3 sm:p-4 mb-6">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Tags</h3>
            <div className="flex flex-wrap gap-2">
              {list.tags.map((tag: string) => (
                <Badge key={tag} variant="outline" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          </Card>
        )}

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
                <p className="text-gray-600">
                  No items have been added to this list yet.
                </p>
              </div>
            </Card>
          ) : (
            list.items.map((item: any, index: number) => {
              const isPurchased = !!purchases[item.id];
              
              return (
              <Card
                key={item.id}
                className={`p-3 sm:p-4 transition-all ${
                  isPurchased 
                    ? "bg-success/10 border-success/20" 
                    : index % 2 === 1 
                    ? "bg-gray-50" 
                    : "bg-white"
                }`}
              >
                <div className="flex items-start gap-2 sm:gap-3">
                  <Checkbox
                    checked={item.completed || isPurchased}
                    disabled
                    className="mt-1 h-6 w-6 md:h-[18px] md:w-[18px] rounded md:rounded-[3px] mr-3 md:mr-2 flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p
                        className={`text-sm sm:text-base text-gray-900 transition-all duration-200 ${
                          item.completed || isPurchased ? "line-through opacity-60" : ""
                        } break-words`}
                      >
                        {item.quantity && (
                          <span className="font-semibold text-primary">
                            {item.quantity}× {" "}
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
                            className="bg-muted text-muted-foreground border-border text-xs"
                          >
                            ${item.attributes.price}
                          </Badge>
                        )}
                        {item.attributes.quantityNeeded && (
                          <Badge
                            variant="outline"
                            className="bg-secondary/10 text-secondary border-secondary/20 text-xs"
                          >
                            Quantity needed: {item.attributes.quantityNeeded}
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
                      {item.notes && 
                        !item.text.match(/^(Main idea|Supporting details|Action items|Follow-up needed|Resources\/links|Breakfast|Lunch|Dinner|Snack|Notes)$/) &&
                        !item.notes.match(/^(Add meal|Add snack|Add idea|Add item|Ideas for next week)/) && (
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
                        {item.links.map((link: string, idx: number) => (
                          <a
                            key={idx}
                            href={link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs sm:text-sm text-primary hover:text-primary/80 underline flex items-center gap-1 break-all"
                          >
                            <LinkIcon className="w-3 h-3 flex-shrink-0" />
                            {link}
                          </a>
                        ))}
                      </div>
                    )}

                    {/* Link Preview for registry/wishlist items */}
                    {isRegistryOrWishlist(list.listType) && item.attributes?.productLink && (
                      <div className="mt-3">
                        <a
                          href={item.attributes.productLink}
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
                              {item.attributes.customLinkTitle || new URL(item.attributes.productLink).hostname}
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
                              {new URL(item.attributes.productLink).hostname}
                            </p>
                          </div>
                        </a>
                      </div>
                    )}

                    {/* Purchase button for registry/wishlist items - ONLY in registry_buyer mode */}
                    {isRegistryOrWishlist(list.listType) && canPurchase && (
                      <div className="mt-3">
                        {purchases[item.id] ? (
                          <div className="flex items-center gap-2">
                            <Badge 
                              variant="outline" 
                              className="bg-success/10 text-success border-success/20 text-sm py-1.5 px-3"
                            >
                              <ShoppingCart className="w-4 h-4 mr-1.5" />
                              ✓ Purchased
                            </Badge>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => handlePurchaseClick(item)}
                            className="bg-primary hover:bg-primary/90 text-white"
                          >
                            <ShoppingCart className="w-4 h-4 mr-2" />
                            I'm buying this
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </Card>
              )
            })
          )}
        </div>

        {/* Only show sign-up promo for view-only and importable lists (not registry_buyer) */}
        {(shareMode === 'view_only' || shareMode === 'importable') && (
        <Card className="mt-8 p-6 sm:p-8 bg-gradient-to-r from-primary/10 to-secondary/10 border-primary/20">
          <div className="max-w-lg mx-auto">
            <h3 className="text-lg font-semibold text-gray-900 mb-2 text-center">
              Like this list?
            </h3>
            <p className="text-gray-600 mb-4 text-center">
              Create a free account to start organizing your own lists!
            </p>
            <ul className="text-sm text-gray-600 mb-4 space-y-1.5">
              <li className="flex items-center gap-2">
                <span className="text-accent">✓</span> Up to 5 lists (To-Do and Custom only)
              </li>
              <li className="flex items-center gap-2">
                <span className="text-accent">✓</span> 20 items per list
              </li>
              <li className="flex items-center gap-2">
                <span className="text-accent">✓</span> Categorize, search, and filter lists
              </li>
              <li className="flex items-center gap-2">
                <span className="text-accent">✓</span> Import from multiple sources
              </li>
              <li className="flex items-center gap-2">
                <span className="text-accent">✓</span> Print lists
              </li>
              <li className="flex items-center gap-2">
                <span className="text-accent">✓</span> Share read-only links
              </li>
              <li className="flex items-center gap-2">
                <span className="text-accent">✓</span> No credit card required
              </li>
            </ul>
            <Button onClick={() => navigate("/auth")} className="w-full">
              Sign Up Free
            </Button>
            <p className="text-xs text-gray-500 mt-3 text-center">
              Upgrade anytime for additional list types, export formats, collaboration, and advanced templates.
            </p>
          </div>
        </Card>
        )}
      </div>

      {/* Purchase Modal */}
      {selectedItem && (
        <PurchaseModal
          open={isPurchaseModalOpen}
          onOpenChange={setIsPurchaseModalOpen}
          item={selectedItem}
          listId={list.id}
          onPurchaseComplete={handlePurchaseComplete}
        />
      )}

      {/* Import Confirmation Dialog */}
      <AlertDialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Download className="w-5 h-5 text-[#00a8a8]" />
              Import This List?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                You're about to create a <strong>copy</strong> of "{list.title}" in your account.
              </p>
              <div className="bg-[#c7d8e3] border border-[#8fb1c7] rounded-lg p-3 text-sm">
                <div className="flex items-start gap-2">
                  <Info className="w-4 h-4 text-[#1f628e] mt-0.5 flex-shrink-0" />
                  <div className="text-[#174a6b]">
                    <p className="font-medium mb-1">What happens when you import:</p>
                    <ul className="list-disc list-inside space-y-1 text-[#174a6b]">
                      <li>A new list is created in your account</li>
                      <li>All items are copied to your new list</li>
                      <li>Changes you make won't affect the original</li>
                      <li>The original owner won't see your changes</li>
                    </ul>
                  </div>
                </div>
              </div>
              {!isLoggedIn && (
                <p className="text-sm text-gray-500">
                  You'll need to sign in or create an account to import this list.
                </p>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel className="min-h-[44px]">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmImport}
              disabled={isImporting}
              className="min-h-[44px] bg-[#00a8a8] hover:bg-[#008888]"
            >
              {isImporting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-2" />
                  {isLoggedIn ? "Import Now" : "Continue to Import"}
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}