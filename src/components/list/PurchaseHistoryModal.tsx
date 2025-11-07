import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Loader2, Trash2, ShoppingCart } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ui/use-toast";

interface Purchase {
  id: string;
  item_id: string;
  purchaser_name: string | null;
  purchase_note: string | null;
  purchase_date: string;
}

interface PurchaseHistoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  listId: string;
  listItems: Array<{ id: string; text: string }>;
  showPurchaserInfo: boolean;
  onTogglePurchaserInfo: (value: boolean) => void;
}

export default function PurchaseHistoryModal({
  open,
  onOpenChange,
  listId,
  listItems,
  showPurchaserInfo,
  onTogglePurchaserInfo,
}: PurchaseHistoryModalProps) {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [purchaseToDelete, setPurchaseToDelete] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      fetchPurchases();
    }
  }, [open, listId]);

  const fetchPurchases = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("purchases")
        .select("*")
        .eq("list_id", listId)
        .order("purchase_date", { ascending: false });

      if (error) throw error;
      setPurchases(data || []);
    } catch (error: any) {
      console.error("Error fetching purchases:", error);
      toast({
        title: "Error",
        description: "Failed to load purchase history",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeletePurchase = async (purchaseId: string, itemId: string) => {
    try {
      // Delete the purchase record
      const { error: deleteError } = await supabase
        .from("purchases")
        .delete()
        .eq("id", purchaseId);

      if (deleteError) throw deleteError;

      // Get the item to restore quantity if needed
      const { data: itemData, error: itemError } = await supabase
        .from("list_items")
        .select("attributes")
        .eq("id", itemId)
        .single();

      if (itemError) throw itemError;

      // Update item status and restore quantity
      const currentAttributes = (itemData.attributes as any) || {};
      const updatedAttributes: any = {
        ...currentAttributes,
        purchaseStatus: "not-purchased",
      };

      // If quantityNeeded exists, increment it back
      if (currentAttributes.quantityNeeded !== undefined) {
        updatedAttributes.quantityNeeded = (currentAttributes.quantityNeeded || 0) + 1;
      }

      const { error: updateError } = await supabase
        .from("list_items")
        .update({ attributes: updatedAttributes })
        .eq("id", itemId);

      if (updateError) throw updateError;

      // Update local state
      setPurchases((prev) => prev.filter((p) => p.id !== purchaseId));
      setPurchaseToDelete(null);

      toast({
        title: "Purchase removed",
        description: "Item quantity has been restored",
      });
    } catch (error: any) {
      console.error("Error deleting purchase:", error);
      toast({
        title: "Error",
        description: "Failed to remove purchase",
        variant: "destructive",
      });
    }
  };

  const getItemName = (itemId: string) => {
    const item = listItems.find((i) => i.id === itemId);
    return item?.text || "Unknown Item";
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5" />
              Purchase History
            </DialogTitle>
            <DialogDescription>
              View and manage purchases made on this registry/wishlist
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            {/* Privacy Toggle */}
            <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="space-y-1">
                <Label className="text-sm font-semibold">Show Purchaser Names</Label>
                <p className="text-xs text-gray-600">
                  When enabled, you can see who purchased each item. When disabled, all purchases show as "Anonymous"
                </p>
              </div>
              <Switch
                checked={showPurchaserInfo}
                onCheckedChange={onTogglePurchaserInfo}
              />
            </div>

            {/* Purchase History Table */}
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              </div>
            ) : purchases.length === 0 ? (
              <div className="text-center py-8">
                <ShoppingCart className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-600">No purchases yet</p>
                <p className="text-sm text-gray-500 mt-1">
                  Purchases will appear here when guests mark items as purchased
                </p>
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead>Purchaser</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Note</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {purchases.map((purchase) => (
                      <TableRow key={purchase.id}>
                        <TableCell className="font-medium">
                          {getItemName(purchase.item_id)}
                        </TableCell>
                        <TableCell>
                          {showPurchaserInfo && purchase.purchaser_name ? (
                            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                              {purchase.purchaser_name}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-gray-50 text-gray-600 border-gray-200">
                              Anonymous
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-gray-600">
                          {format(new Date(purchase.purchase_date), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell className="text-sm text-gray-600 max-w-xs truncate">
                          {purchase.purchase_note || "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setPurchaseToDelete(purchase.id)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!purchaseToDelete}
        onOpenChange={(open) => !open && setPurchaseToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this purchase?</AlertDialogTitle>
            <AlertDialogDescription>
              This will restore the item quantity and remove the purchase record. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const purchase = purchases.find((p) => p.id === purchaseToDelete);
                if (purchase) {
                  handleDeletePurchase(purchase.id, purchase.item_id);
                }
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              Remove Purchase
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}