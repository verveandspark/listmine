import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus, ArrowRight, Check, AlertCircle, ListPlus } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";
import { useLists } from "@/contexts/useListsHook";

interface ImportItem {
  name: string;
  text?: string;
  price?: string;
  link?: string;
  image?: string;
  notes?: string;
  priority?: "low" | "medium" | "high";
  dueDate?: Date;
  quantity?: number;
  completed?: boolean;
}

interface CompareResult {
  existingItems: any[];
  newItems: ImportItem[];
  updatedItems: { listMineItem: any; retailerItem: ImportItem }[];
  summary: {
    existingCount: number;
    newCount: number;
    updatedCount: number;
  };
}

interface AddToExistingListModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: ImportItem[];
  sourceType: "csv" | "amazon" | "manual" | "share";
  onSuccess?: () => void;
}

export default function AddToExistingListModal({
  open,
  onOpenChange,
  items,
  sourceType,
  onSuccess,
}: AddToExistingListModalProps) {
  const { lists, addItemToList } = useLists();
  const { toast } = useToast();
  
  const [selectedListId, setSelectedListId] = useState<string>("");
  const [comparing, setComparing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [compareResult, setCompareResult] = useState<CompareResult | null>(null);
  const [error, setError] = useState("");
  const [selectedNewItems, setSelectedNewItems] = useState<Set<number>>(new Set());
  const [selectedUpdates, setSelectedUpdates] = useState<Set<number>>(new Set());

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!open) {
      setSelectedListId("");
      setCompareResult(null);
      setError("");
      setSelectedNewItems(new Set());
      setSelectedUpdates(new Set());
    }
  }, [open]);

  const selectedList = lists.find((l) => l.id === selectedListId);

  const handleCompare = async () => {
    if (!selectedListId) {
      setError("Please select a list");
      return;
    }

    setComparing(true);
    setError("");
    setCompareResult(null);

    try {
      // Transform items to match the compare-merge format
      const retailerList = items.map((item) => ({
        name: item.name || item.text || "",
        price: item.price,
        link: item.link,
        image: item.image,
      }));

      const { data: compareData, error: compareError } = await supabase.functions.invoke(
        "supabase-functions-compare-merge",
        {
          body: {
            listMineListId: selectedListId,
            retailerList,
          },
        }
      );

      if (compareError) {
        throw new Error(compareError.message || "Failed to compare lists");
      }

      setCompareResult(compareData);

      // Select all new items by default
      const newItemIndices = new Set<number>(compareData.newItems.map((_: any, i: number) => i));
      setSelectedNewItems(newItemIndices);

      // Select all updates by default
      const updateIndices = new Set<number>(compareData.updatedItems.map((_: any, i: number) => i));
      setSelectedUpdates(updateIndices);

      if (compareData.summary.newCount === 0 && compareData.summary.updatedCount === 0) {
        toast({
          title: "No changes found",
          description: "All items already exist in the selected list",
        });
      } else {
        toast({
          title: "Comparison complete",
          description: `Found ${compareData.summary.newCount} new items and ${compareData.summary.updatedCount} updates`,
        });
      }
    } catch (err: any) {
      console.error("Compare error:", err);
      setError(err.message || "Failed to compare items. Please try again.");
    } finally {
      setComparing(false);
    }
  };

  const handleApplyChanges = async () => {
    if (!compareResult || !selectedList) return;

    setApplying(true);

    try {
      // Add selected new items one by one
      const newItemsToAdd = compareResult.newItems.filter((_, index) =>
        selectedNewItems.has(index)
      );

      for (let i = 0; i < newItemsToAdd.length; i++) {
        const item = newItemsToAdd[i];
        const originalItem = items.find(
          (it) => (it.name || it.text) === item.name
        );

        await addItemToList(selectedListId, {
          text: item.name,
          completed: originalItem?.completed || false,
          priority: originalItem?.priority,
          dueDate: originalItem?.dueDate,
          notes: originalItem?.notes || (item.price ? `Price: ${item.price}` : undefined),
          quantity: originalItem?.quantity,
          links: item.link ? [item.link] : undefined,
          attributes: {
            price: item.price ? parseFloat(item.price.replace(/[^0-9.]/g, "")) : undefined,
            productLink: item.link,
            linkImage: item.image,
            linkTitle: item.name,
          },
        });
      }

      toast({
        title: "Items added!",
        description: `Added ${newItemsToAdd.length} items to "${selectedList.title}"`,
      });

      onSuccess?.();
      handleClose();
    } catch (err: any) {
      toast({
        title: "❌ Failed to add items",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setApplying(false);
    }
  };

  const handleClose = () => {
    setSelectedListId("");
    setCompareResult(null);
    setError("");
    setSelectedNewItems(new Set());
    setSelectedUpdates(new Set());
    onOpenChange(false);
  };

  const toggleNewItem = (index: number) => {
    setSelectedNewItems((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const toggleAllNewItems = () => {
    if (!compareResult) return;
    if (selectedNewItems.size === compareResult.newItems.length) {
      setSelectedNewItems(new Set<number>());
    } else {
      setSelectedNewItems(new Set<number>(compareResult.newItems.map((_, i) => i)));
    }
  };

  const getSourceLabel = () => {
    switch (sourceType) {
      case "csv":
        return "CSV/TXT file";
      case "amazon":
        return "Amazon wishlist";
      case "manual":
        return "manual entry";
      case "share":
        return "shared list";
      default:
        return "import";
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ListPlus className="w-5 h-5" />
            Add to Existing List
          </DialogTitle>
          <DialogDescription>
            Add {items.length} items from {getSourceLabel()} to an existing list.
            Duplicates will be detected automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          {/* List Selection */}
          {!compareResult && (
            <div className="space-y-2">
              <Label>Select Target List</Label>
              <Select value={selectedListId} onValueChange={setSelectedListId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a list to add items to..." />
                </SelectTrigger>
                <SelectContent>
                  {lists.map((list) => (
                    <SelectItem key={list.id} value={list.id}>
                      <div className="flex items-center gap-2">
                        <span>{list.title}</span>
                        <Badge variant="outline" className="text-xs">
                          {list.items.length} items
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">
                Items will be compared against the selected list to detect duplicates
              </p>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Compare Results */}
          {compareResult && (
            <div className="flex-1 overflow-hidden flex flex-col space-y-4">
              {/* Summary */}
              <div className="flex gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-accent/10 text-accent">
                    <Plus className="w-3 h-3 mr-1" />
                    {compareResult.summary.newCount} new
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-muted text-muted-foreground">
                    <Check className="w-3 h-3 mr-1" />
                    {compareResult.summary.existingCount} already exist
                  </Badge>
                </div>
              </div>

              {/* New Items */}
              {compareResult.newItems.length > 0 && (
                <div className="flex-1 overflow-hidden flex flex-col">
                  <div className="flex items-center justify-between mb-2">
                    <Label className="flex items-center gap-2">
                      <Plus className="w-4 h-4 text-accent" />
                      New Items to Add ({selectedNewItems.size}/{compareResult.newItems.length})
                    </Label>
                    <Button variant="ghost" size="sm" onClick={toggleAllNewItems}>
                      {selectedNewItems.size === compareResult.newItems.length
                        ? "Deselect All"
                        : "Select All"}
                    </Button>
                  </div>
                  <ScrollArea className="flex-1 border rounded-md p-2 max-h-[300px]">
                    <div className="space-y-2">
                      {compareResult.newItems.map((item, index) => (
                        <div
                          key={index}
                          className="flex items-start gap-3 p-2 rounded hover:bg-primary/5"
                        >
                          <Checkbox
                            checked={selectedNewItems.has(index)}
                            onCheckedChange={() => toggleNewItem(index)}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{item.name}</p>
                            {item.price && (
                              <p className="text-xs text-gray-500">{item.price}</p>
                            )}
                          </div>
                          {item.image && (
                            <img
                              src={item.image}
                              alt=""
                              className="w-10 h-10 object-cover rounded"
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}

              {/* Already Existing Items */}
              {compareResult.existingItems.length > 0 && (
                <div className="text-sm text-gray-500">
                  <p className="font-medium mb-1">Already in list (will be skipped):</p>
                  <p className="text-xs">
                    {compareResult.existingItems
                      .slice(0, 5)
                      .map((item) => item.text || item.name)
                      .join(", ")}
                    {compareResult.existingItems.length > 5 &&
                      ` and ${compareResult.existingItems.length - 5} more...`}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          {!compareResult ? (
            <Button
              onClick={handleCompare}
              disabled={!selectedListId || comparing}
            >
              {comparing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Comparing...
                </>
              ) : (
                <>
                  <ArrowRight className="w-4 h-4 mr-2" />
                  Compare & Preview
                </>
              )}
            </Button>
          ) : (
            <Button
              onClick={handleApplyChanges}
              disabled={selectedNewItems.size === 0 || applying}
            >
              {applying ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Add {selectedNewItems.size} Items
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
