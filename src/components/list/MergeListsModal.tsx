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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Loader2,
  Plus,
  ArrowRight,
  Check,
  AlertCircle,
  Merge,
  Archive,
  Trash2,
  FolderOpen,
  HelpCircle,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/lib/supabase";
import { useLists } from "@/contexts/useListsHook";

interface CompareResult {
  existingItems: any[];
  newItems: any[];
  updatedItems: { listMineItem: any; retailerItem: any }[];
  summary: {
    existingCount: number;
    newCount: number;
    updatedCount: number;
  };
}

type SourceListAction = "keep" | "archive" | "delete";

interface MergeListsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialSourceListId?: string;
  onSuccess?: () => void;
}

export default function MergeListsModal({
  open,
  onOpenChange,
  initialSourceListId,
  onSuccess,
}: MergeListsModalProps) {
  const { lists, addItemToList, deleteList, updateList } = useLists();
  const { toast } = useToast();

  const [step, setStep] = useState<"select" | "compare" | "confirm">("select");
  const [sourceListId, setSourceListId] = useState<string>(initialSourceListId || "");
  const [targetListId, setTargetListId] = useState<string>("");
  const [sourceAction, setSourceAction] = useState<SourceListAction>("archive");
  const [comparing, setComparing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [compareResult, setCompareResult] = useState<CompareResult | null>(null);
  const [error, setError] = useState("");
  const [selectedNewItems, setSelectedNewItems] = useState<Set<number>>(new Set());

  // Reset state when modal opens/closes
  useEffect(() => {
    if (open) {
      setSourceListId(initialSourceListId || "");
      setTargetListId("");
      setStep("select");
      setCompareResult(null);
      setError("");
      setSelectedNewItems(new Set());
      setSourceAction("archive");
    }
  }, [open, initialSourceListId]);

  const sourceList = lists.find((l) => l.id === sourceListId);
  const targetList = lists.find((l) => l.id === targetListId);

  // Filter out the selected source list from target options
  const availableTargetLists = lists.filter((l) => l.id !== sourceListId);
  // Filter out the selected target list from source options
  const availableSourceLists = lists.filter((l) => l.id !== targetListId);

  const handleCompare = async () => {
    if (!sourceListId || !targetListId) {
      setError("Please select both source and target lists");
      return;
    }

    if (sourceListId === targetListId) {
      setError("Source and target lists must be different");
      return;
    }

    setComparing(true);
    setError("");
    setCompareResult(null);

    try {
      // Transform source list items to match the compare-merge format
      const retailerList = sourceList?.items.map((item) => ({
        name: item.text,
        price: item.attributes?.price?.toString(),
        link: item.attributes?.productLink || item.links?.[0],
        image: item.attributes?.linkImage,
      })) || [];

      const { data: compareData, error: compareError } = await supabase.functions.invoke(
        "supabase-functions-compare-merge",
        {
          body: {
            listMineListId: targetListId,
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

      setStep("compare");

      if (compareData.summary.newCount === 0) {
        toast({
          title: "No new items found",
          description: "All items from the source list already exist in the target list",
        });
      } else {
        toast({
          title: "✅ Comparison complete",
          description: `Found ${compareData.summary.newCount} new items and ${compareData.summary.existingCount} duplicates`,
          className: "bg-accent/10 border-accent/20",
        });
      }
    } catch (err: any) {
      console.error("Compare error:", err);
      setError(err.message || "Failed to compare lists. Please try again.");
    } finally {
      setComparing(false);
    }
  };

  const handleApplyMerge = async () => {
    if (!compareResult || !sourceList || !targetList) return;

    setApplying(true);

    try {
      // Add selected new items to target list
      const newItemsToAdd = compareResult.newItems.filter((_, index) =>
        selectedNewItems.has(index)
      );

      for (let i = 0; i < newItemsToAdd.length; i++) {
        const item = newItemsToAdd[i];
        // Find the original item from source list to preserve all attributes
        const originalItem = sourceList.items.find(
          (it) => it.text === item.name
        );

        await addItemToList(targetListId, {
          text: item.name,
          completed: originalItem?.completed || false,
          priority: originalItem?.priority,
          dueDate: originalItem?.dueDate,
          notes: originalItem?.notes,
          quantity: originalItem?.quantity,
          links: originalItem?.links || (item.link ? [item.link] : undefined),
          attributes: originalItem?.attributes || {
            price: item.price ? parseFloat(item.price.replace(/[^0-9.]/g, "")) : undefined,
            productLink: item.link,
            linkImage: item.image,
            linkTitle: item.name,
          },
        });
      }

      // Handle source list based on user's choice
      if (sourceAction === "delete") {
        await deleteList(sourceListId);
        toast({
          title: "✅ Lists merged!",
          description: `Added ${newItemsToAdd.length} items to "${targetList.title}" and deleted "${sourceList.title}"`,
          className: "bg-accent/10 border-accent/20",
        });
      } else if (sourceAction === "archive") {
        // For archive, we'll add a prefix to the title to indicate it's archived
        // Since there's no isArchived field, we'll rename it
        await updateList(sourceListId, {
          title: `[Archived] ${sourceList.title}`,
          description: `Merged into "${targetList.title}" on ${new Date().toLocaleDateString()}. ${sourceList.description || ""}`.trim(),
        });
        toast({
          title: "✅ Lists merged!",
          description: `Added ${newItemsToAdd.length} items to "${targetList.title}" and archived "${sourceList.title}"`,
          className: "bg-accent/10 border-accent/20",
        });
      } else {
        // Keep - do nothing to source list
        toast({
          title: "✅ Lists merged!",
          description: `Added ${newItemsToAdd.length} items to "${targetList.title}"`,
          className: "bg-accent/10 border-accent/20",
        });
      }

      onSuccess?.();
      handleClose();
    } catch (err: any) {
      toast({
        title: "❌ Failed to merge lists",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setApplying(false);
    }
  };

  const handleClose = () => {
    setSourceListId("");
    setTargetListId("");
    setStep("select");
    setCompareResult(null);
    setError("");
    setSelectedNewItems(new Set());
    setSourceAction("archive");
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

  const getSourceActionIcon = (action: SourceListAction) => {
    switch (action) {
      case "keep":
        return <FolderOpen className="w-4 h-4" />;
      case "archive":
        return <Archive className="w-4 h-4" />;
      case "delete":
        return <Trash2 className="w-4 h-4" />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Merge className="w-5 h-5" />
            Merge Lists
          </DialogTitle>
          <DialogDescription>
            {step === "select" && "Select two lists to merge. Items from the source list will be added to the target list."}
            {step === "compare" && "Review the items that will be merged. Duplicates are automatically detected."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          {/* Step 1: List Selection */}
          {step === "select" && (
            <>
              <div className="space-y-4">
                {/* Source List Selection */}
                <div className="space-y-2">
                  <Label>Source List (items will be copied from here)</Label>
                  <Select value={sourceListId} onValueChange={setSourceListId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select source list..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableSourceLists.map((list) => (
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
                </div>

                {/* Arrow indicator */}
                <div className="flex justify-center">
                  <ArrowRight className="w-6 h-6 text-gray-400" />
                </div>

                {/* Target List Selection */}
                <div className="space-y-2">
                  <Label>Target List (items will be added here)</Label>
                  <Select value={targetListId} onValueChange={setTargetListId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select target list..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableTargetLists.map((list) => (
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
                </div>

                {/* Source List Action */}
                <div className="space-y-3 p-4 bg-gray-50 rounded-lg border">
                  <div className="flex items-center gap-2">
                    <Label className="text-sm font-medium">After merging, what should happen to the source list?</Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="w-4 h-4 text-gray-400 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p className="text-xs">
                            <strong>Archive:</strong> Hides the list from your dashboard (can be shown using the "Show archived lists" filter)
                            <br /><br />
                            <strong>Keep:</strong> List remains unchanged
                            <br /><br />
                            <strong>Delete:</strong> Permanently removes the list
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <RadioGroup
                    value={sourceAction}
                    onValueChange={(value) => setSourceAction(value as SourceListAction)}
                    className="flex flex-col gap-2"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="archive" id="action-archive" />
                      <Label htmlFor="action-archive" className="font-normal cursor-pointer flex items-center gap-2">
                        <Archive className="w-4 h-4 text-accent" />
                        Archive (rename with [Archived] prefix)
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="keep" id="action-keep" />
                      <Label htmlFor="action-keep" className="font-normal cursor-pointer flex items-center gap-2">
                        <FolderOpen className="w-4 h-4 text-primary" />
                        Keep as-is (no changes)
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="delete" id="action-delete" />
                      <Label htmlFor="action-delete" className="font-normal cursor-pointer flex items-center gap-2">
                        <Trash2 className="w-4 h-4 text-red-600" />
                        Delete permanently
                      </Label>
                    </div>
                  </RadioGroup>
                </div>
              </div>
            </>
          )}

          {/* Error Message */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Step 2: Compare Results */}
          {step === "compare" && compareResult && (
            <div className="flex-1 overflow-hidden flex flex-col space-y-4">
              {/* Summary */}
              <div className="flex gap-4 text-sm flex-wrap">
                <Badge variant="outline" className="bg-accent/10 text-accent">
                  <Plus className="w-3 h-3 mr-1" />
                  {compareResult.summary.newCount} new items
                </Badge>
                <Badge variant="outline" className="bg-muted text-muted-foreground">
                  <Check className="w-3 h-3 mr-1" />
                  {compareResult.summary.existingCount} duplicates (will be skipped)
                </Badge>
              </div>

              {/* Merge Preview */}
              <div className="p-3 bg-accent/10 rounded-lg border border-accent/30">
                <p className="text-sm text-accent">
                  <strong>Merge Preview:</strong> {selectedNewItems.size} items from "{sourceList?.title}" 
                  → "{targetList?.title}"
                </p>
                <p className="text-xs text-accent mt-1">
                  Source list will be: {sourceAction === "archive" ? "archived" : sourceAction === "delete" ? "deleted" : "kept unchanged"}
                </p>
              </div>

              {/* New Items */}
              {compareResult.newItems.length > 0 && (
                <div className="flex-1 overflow-hidden flex flex-col">
                  <div className="flex items-center justify-between mb-2">
                    <Label className="flex items-center gap-2">
                      <Plus className="w-4 h-4 text-accent" />
                      Items to Add ({selectedNewItems.size}/{compareResult.newItems.length})
                    </Label>
                    <Button variant="ghost" size="sm" onClick={toggleAllNewItems}>
                      {selectedNewItems.size === compareResult.newItems.length
                        ? "Deselect All"
                        : "Select All"}
                    </Button>
                  </div>
                  <ScrollArea className="flex-1 border rounded-md p-2 max-h-[250px]">
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
                  <p className="font-medium mb-1">Duplicates (will be skipped):</p>
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
          {step === "compare" && (
            <Button variant="outline" onClick={() => setStep("select")}>
              Back
            </Button>
          )}
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          {step === "select" ? (
            <Button
              onClick={handleCompare}
              disabled={!sourceListId || !targetListId || comparing}
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
              onClick={handleApplyMerge}
              disabled={selectedNewItems.size === 0 || applying}
            >
              {applying ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Merging...
                </>
              ) : (
                <>
                  <Merge className="w-4 h-4 mr-2" />
                  Merge {selectedNewItems.size} Items
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
