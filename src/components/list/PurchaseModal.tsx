import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

interface PurchaseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: {
    id: string;
    text: string;
    quantity?: number;
    attributes?: {
      price?: number;
      quantityNeeded?: number;
      custom?: {
        price?: string;
        image?: string;
      };
    };
  };
  listId: string;
  onPurchaseComplete: (purchaserName: string | null, purchaseNote: string | null) => void;
}

export default function PurchaseModal({
  open,
  onOpenChange,
  item,
  listId,
  onPurchaseComplete,
}: PurchaseModalProps) {
  const [purchaserName, setPurchaserName] = useState("");
  const [purchaseNote, setPurchaseNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      // Call the purchase confirmation handler with the form data
      await onPurchaseComplete(
        purchaserName.trim() || null,
        purchaseNote.trim() || null
      );
      
      // Reset form
      setPurchaserName("");
      setPurchaseNote("");
      onOpenChange(false);
    } catch (error) {
      console.error("Error confirming purchase:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] bg-white">
        <DialogHeader>
          <DialogTitle>Confirm Purchase</DialogTitle>
          <DialogDescription>
            Let the list owner know you're purchasing this item
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-semibold text-gray-900 mb-2">Item Details</h4>
            <p className="text-gray-700">
              {item.quantity && <span className="font-semibold">{item.quantity}× </span>}
              {item.text}
            </p>
            {(item.attributes?.custom?.price || item.attributes?.price) && (
              <p className="text-sm text-gray-600 mt-1">
                Price: ${item.attributes?.custom?.price ?? item.attributes?.price}
              </p>
            )}
            {item.attributes?.quantityNeeded && item.attributes.quantityNeeded > 1 && (
              <p className="text-sm text-gray-600 mt-1">
                Quantity needed: {item.attributes.quantityNeeded}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="purchaser-name">
              Your name (optional - leave blank to stay anonymous)
            </Label>
            <Input
              id="purchaser-name"
              placeholder="e.g., John Smith"
              value={purchaserName}
              onChange={(e) => setPurchaserName(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="purchase-note">
              Add a note (optional)
            </Label>
            <Textarea
              id="purchase-note"
              placeholder='e.g., "Engraved with initials"'
              value={purchaseNote}
              onChange={(e) => setPurchaseNote(e.target.value)}
              disabled={isSubmitting}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Confirming...
              </>
            ) : (
              "Confirm Purchase"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}