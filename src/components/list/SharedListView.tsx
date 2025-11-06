import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/use-toast";
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
} from "lucide-react";
import { format } from "date-fns";
import { isToday, isPast } from "date-fns";
import PurchaseModal from "./PurchaseModal";
import { LinkPreviewCard } from "./LinkPreviewCard";

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

        // Fetch list by share_link
        const { data: listData, error: listError } = await supabase
          .from("lists")
          .select("*")
          .eq("share_link", shareId)
          .eq("is_shared", true)
          .single();

        console.log("SharedListView: List query result:", { listData, listError });

        if (listError || !listData) {
          console.error("SharedListView: List not found or error:", listError);
          setError("List not found or has been removed");
          setIsLoading(false);
          return;
        }

        // Set the show_purchaser_info setting
        setShowPurchaserInfo(listData.show_purchaser_info || false);

        // Fetch items for this list using correct table name
        const { data: itemsData, error: itemsError } = await supabase
          .from("list_items")
          .select("*")
          .eq("list_id", listData.id)
          .order("item_order", { ascending: true });

        console.log("SharedListView: Items query result:", { itemsData, itemsError });

        if (itemsError) {
          console.error("SharedListView: Could not load items:", itemsError);
          setError("Could not load items");
          setIsLoading(false);
          return;
        }

        // Fetch purchases for this list
        const { data: purchasesData, error: purchasesError } = await supabase
          .from("purchases")
          .select("*")
          .eq("list_id", listData.id);

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

  const handlePurchaseComplete = async () => {
    if (!selectedItem || !list) return;

    try {
      // Get the modal values (we'll need to pass them from the modal)
      const purchaserName = (document.getElementById("purchaser-name") as HTMLInputElement)?.value || null;
      const purchaseNote = (document.getElementById("purchase-note") as HTMLTextAreaElement)?.value || null;

      // Insert purchase record
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

      if (purchaseError) throw purchaseError;

      // Update item status to 'Purchased'
      const updatedAttributes = {
        ...selectedItem.attributes,
        purchaseStatus: "Purchased",
      };

      // If quantity_needed > 1, decrement it
      if (selectedItem.attributes?.quantityNeeded && selectedItem.attributes.quantityNeeded > 1) {
        updatedAttributes.quantityNeeded = selectedItem.attributes.quantityNeeded - 1;
      }

      const { error: updateError } = await supabase
        .from("list_items")
        .update({ attributes: updatedAttributes })
        .eq("id", selectedItem.id);

      if (updateError) throw updateError;

      // Update local state
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
        title: "Error",
        description: "Failed to mark item as purchased. Please try again.",
        variant: "destructive",
      });
    }
  };

  const isRegistryOrWishlist = (listType: string) => {
    return listType === "registry-list" || listType === "shopping-list";
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-4" />
          <p className="text-gray-600 text-lg">Loading shared list...</p>
        </div>
      </div>
    );
  }

  if (error || !list) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <Card className="p-8 text-center max-w-md">
          <h2 className="text-xl font-semibold mb-4 text-red-600">
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
    if (isToday(date)) return "text-orange-600 bg-orange-50 border-orange-200";
    if (isPast(date)) return "text-red-600 bg-red-50 border-red-200";
    return "text-gray-600 bg-gray-50 border-gray-200";
  };

  const priorityColors: any = {
    low: "bg-green-100 text-green-700 border-green-200",
    medium: "bg-yellow-100 text-yellow-700 border-yellow-200",
    high: "bg-red-100 text-red-700 border-red-200",
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h1 className="text-lg sm:text-2xl font-bold text-gray-900 truncate">
                {list.title}
              </h1>
              <p className="text-xs sm:text-sm text-gray-600">
                {list.category} · {list.items.length} items · Read-only
              </p>
            </div>
            <Button
              onClick={() => navigate("/")}
              variant="outline"
              size="sm"
              className="flex-shrink-0"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          </div>
        </div>
      </header>

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
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Package className="w-8 h-8 text-blue-600" />
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
                    ? "bg-green-50 border-green-200" 
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
                          <span className="font-semibold text-blue-600">
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
                        {item.attributes.quantityNeeded && (
                          <Badge
                            variant="outline"
                            className="bg-indigo-50 text-indigo-700 border-indigo-200 text-xs"
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
                        {item.links.map((link: string, idx: number) => (
                          <a
                            key={idx}
                            href={link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs sm:text-sm text-blue-600 hover:underline flex items-center gap-1 break-all"
                          >
                            <LinkIcon className="w-3 h-3 flex-shrink-0" />
                            {link}
                          </a>
                        ))}
                      </div>
                    )}

                    {/* Link Preview for registry/wishlist items */}
                    {list.listType && isRegistryOrWishlist(list.listType) && item.attributes?.productLink && (
                      <div className="mt-3">
                        <LinkPreviewCard
                          url={item.attributes.productLink}
                          customTitle={item.attributes.customLinkTitle}
                          customDescription={item.attributes.customLinkDescription}
                          customImage={item.attributes.customLinkImage}
                        />
                      </div>
                    )}

                    {/* Purchase button for registry/wishlist items */}
                    {list.listType && isRegistryOrWishlist(list.listType) && (
                      <div className="mt-3">
                        {purchases[item.id] ? (
                          <div className="flex items-center gap-2">
                            <Badge 
                              variant="outline" 
                              className="bg-green-50 text-green-700 border-green-200 text-sm py-1.5 px-3"
                            >
                              <ShoppingCart className="w-4 h-4 mr-1.5" />
                              {showPurchaserInfo && purchases[item.id].purchaser_name
                                ? `Purchased by ${purchases[item.id].purchaser_name}`
                                : "Purchased"}
                            </Badge>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => handlePurchaseClick(item)}
                            className="bg-blue-600 hover:bg-blue-700 text-white"
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

        <Card className="mt-8 p-6 sm:p-8 bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
          <div className="text-center max-w-md mx-auto">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Like this list?
            </h3>
            <p className="text-gray-600 mb-4">
              Sign up to create your own lists and import this one.
            </p>
            <Button onClick={() => navigate("/auth")} className="w-full">
              Sign Up Free
            </Button>
          </div>
        </Card>
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
    </div>
  );
}