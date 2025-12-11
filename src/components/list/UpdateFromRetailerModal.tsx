import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ExternalLink, RefreshCw, AlertCircle, Plus, ArrowRight, Check } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";
import { List, ListItem } from "@/types";

interface ScrapedItem {
  name: string;
  price?: string;
  link?: string;
  image?: string;
  selected?: boolean;
}

interface CompareResult {
  existingItems: any[];
  newItems: ScrapedItem[];
  updatedItems: { listMineItem: any; retailerItem: ScrapedItem }[];
  summary: {
    existingCount: number;
    newCount: number;
    updatedCount: number;
  };
}

interface UpdateFromRetailerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  list: List;
  onAddItems: (items: Partial<ListItem>[]) => Promise<void>;
  onUpdateItems?: (updates: { id: string; updates: Partial<ListItem> }[]) => Promise<void>;
}

export default function UpdateFromRetailerModal({
  open,
  onOpenChange,
  list,
  onAddItems,
  onUpdateItems,
}: UpdateFromRetailerModalProps) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [comparing, setComparing] = useState(false);
  const [compareResult, setCompareResult] = useState<CompareResult | null>(null);
  const [retailer, setRetailer] = useState("");
  const [error, setError] = useState("");
  const [selectedNewItems, setSelectedNewItems] = useState<Set<number>>(new Set());
  const [selectedUpdates, setSelectedUpdates] = useState<Set<number>>(new Set());
  const { toast } = useToast();

  const handleScrapeAndCompare = async () => {
    if (!url.trim()) {
      setError("Please enter a wishlist URL");
      return;
    }

    setLoading(true);
    setError("");
    setCompareResult(null);

    try {
      // Step 1: Scrape the retailer wishlist
      const { data: scrapeData, error: scrapeError } = await supabase.functions.invoke(
        "supabase-functions-scrape-wishlist",
        {
          body: { url: url.trim() },
        }
      );

      if (scrapeError) {
        throw new Error(scrapeError.message || "Failed to scrape wishlist");
      }

      if (!scrapeData.success) {
        throw new Error(scrapeData.error || "Failed to scrape wishlist");
      }

      setRetailer(scrapeData.retailer);

      // Step 2: Compare with existing list
      setComparing(true);
      const retailerList = scrapeData.items.map((item: ScrapedItem) => ({
        name: item.name,
        price: item.price,
        link: item.link,
        image: item.image,
      }));

      const { data: compareData, error: compareError } = await supabase.functions.invoke(
        "supabase-functions-compare-merge",
        {
          body: {
            listMineListId: list.id,
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

      toast({
        title: "✅ Comparison complete",
        description: `Found ${compareData.summary.newCount} new items and ${compareData.summary.updatedCount} updates`,
        className: "bg-green-50 border-green-200",
      });
    } catch (err: any) {
      console.error("Error:", err);
      setError(
        err.message || "Failed to scrape and compare. Please check the URL and try again."
      );
    } finally {
      setLoading(false);
      setComparing(false);
    }
  };

  const handleApplyChanges = async () => {
    if (!compareResult) return;

    try {
      // Add selected new items
      const newItemsToAdd = compareResult.newItems
        .filter((_, index) => selectedNewItems.has(index))
        .map((item) => ({
          text: item.name,
          completed: false,
          order: list.items.length,
          attributes: {
            price: item.price ? parseFloat(item.price.replace(/[^0-9.]/g, "")) : undefined,
            productLink: item.link,
            linkImage: item.image,
            linkTitle: item.name,
          },
        }));

      if (newItemsToAdd.length > 0) {
        await onAddItems(newItemsToAdd);
      }

      // Update selected items (if handler provided)
      if (onUpdateItems && selectedUpdates.size > 0) {
        const updatesToApply = compareResult.updatedItems
          .filter((_, index) => selectedUpdates.has(index))
          .map((update) => ({
            id: update.listMineItem.id,
            updates: {
              attributes: {
                ...update.listMineItem.attributes,
                price: update.retailerItem.price 
                  ? parseFloat(update.retailerItem.price.replace(/[^0-9.]/g, "")) 
                  : update.listMineItem.attributes?.price,
                productLink: update.retailerItem.link || update.listMineItem.attributes?.productLink,
                linkImage: update.retailerItem.image || update.listMineItem.attributes?.linkImage,
              },
            },
          }));

        await onUpdateItems(updatesToApply);
      }

      toast({
        title: "✅ List updated!",
        description: `Added ${newItemsToAdd.length} new items${selectedUpdates.size > 0 ? ` and updated ${selectedUpdates.size} items` : ""}`,
        className: "bg-green-50 border-green-200",
      });

      handleClose();
    } catch (err: any) {
      toast({
        title: "❌ Update failed",
        description: err.message,
        variant: "destructive",
      });
    }
  };

  const handleClose = () => {
    setUrl("");
    setCompareResult(null);
    setRetailer("");
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

  const toggleUpdate = (index: number) => {
    setSelectedUpdates((prev) => {
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

  const toggleAllUpdates = () => {
    if (!compareResult) return;
    if (selectedUpdates.size === compareResult.updatedItems.length) {
      setSelectedUpdates(new Set<number>());
    } else {
      setSelectedUpdates(new Set<number>(compareResult.updatedItems.map((_, i) => i)));
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5" />
            Update from Retailer
          </DialogTitle>
          <DialogDescription className="space-y-2">
            <p>Re-scrape a retailer wishlist to find new items or price changes.</p>
            <p className="text-xs text-gray-600">
              Currently supports: Amazon wishlists. More retailers coming soon!
            </p>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          {/* URL Input */}
          <div className="space-y-2">
            <Label htmlFor="retailer-url">Retailer Wishlist URL</Label>
            <div className="flex gap-2">
              <Input
                id="retailer-url"
                placeholder="Paste retailer wishlist URL"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !loading && !comparing) {
                    handleScrapeAndCompare();
                  }
                }}
                disabled={loading || comparing || !!compareResult}
                className="flex-1"
              />
              {!compareResult && (
                <Button onClick={handleScrapeAndCompare} disabled={loading || comparing}>
                  {loading || comparing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {comparing ? "Comparing..." : "Scraping..."}
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Compare
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Comparison Results */}
          {compareResult && (
            <>
              {/* Summary */}
              <div className="flex gap-4 p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                    <Plus className="w-3 h-3 mr-1" />
                    {compareResult.summary.newCount} New
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                    <ArrowRight className="w-3 h-3 mr-1" />
                    {compareResult.summary.updatedCount} Updated
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-gray-100 text-gray-600">
                    <Check className="w-3 h-3 mr-1" />
                    {compareResult.summary.existingCount} Unchanged
                  </Badge>
                </div>
              </div>

              <ScrollArea className="flex-1 border rounded-lg">
                <div className="p-4 space-y-6">
                  {/* New Items Section */}
                  {compareResult.newItems.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={selectedNewItems.size === compareResult.newItems.length}
                            onCheckedChange={toggleAllNewItems}
                          />
                          <h4 className="font-semibold text-green-700">
                            New Items ({selectedNewItems.size} of {compareResult.newItems.length} selected)
                          </h4>
                        </div>
                      </div>
                      {compareResult.newItems.map((item, index) => (
                        <div
                          key={index}
                          className="flex items-start gap-3 p-3 border rounded-lg hover:bg-green-50/50 transition-colors border-green-200"
                        >
                          <Checkbox
                            checked={selectedNewItems.has(index)}
                            onCheckedChange={() => toggleNewItem(index)}
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
                            <p className="font-medium text-sm line-clamp-2">{item.name}</p>
                            {item.price && (
                              <p className="text-sm text-green-600 font-semibold mt-1">
                                {item.price}
                              </p>
                            )}
                            {item.link && (
                              <a
                                href={item.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-blue-600 hover:underline flex items-center gap-1 mt-1"
                              >
                                View on {retailer}
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                          <Badge className="bg-green-100 text-green-700 border-green-200">New</Badge>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Updated Items Section */}
                  {compareResult.updatedItems.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={selectedUpdates.size === compareResult.updatedItems.length}
                            onCheckedChange={toggleAllUpdates}
                          />
                          <h4 className="font-semibold text-blue-700">
                            Updated Items ({selectedUpdates.size} of {compareResult.updatedItems.length} selected)
                          </h4>
                        </div>
                      </div>
                      {compareResult.updatedItems.map((update, index) => (
                        <div
                          key={index}
                          className="flex items-start gap-3 p-3 border rounded-lg hover:bg-blue-50/50 transition-colors border-blue-200"
                        >
                          <Checkbox
                            checked={selectedUpdates.has(index)}
                            onCheckedChange={() => toggleUpdate(index)}
                            className="mt-1"
                          />
                          {update.retailerItem.image && (
                            <img
                              src={update.retailerItem.image}
                              alt={update.retailerItem.name}
                              className="w-16 h-16 object-cover rounded"
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm line-clamp-2">
                              {update.retailerItem.name}
                            </p>
                            {update.retailerItem.price && (
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-sm text-gray-400 line-through">
                                  {update.listMineItem.attributes?.price 
                                    ? `$${update.listMineItem.attributes.price}` 
                                    : "No price"}
                                </span>
                                <ArrowRight className="w-3 h-3 text-gray-400" />
                                <span className="text-sm text-green-600 font-semibold">
                                  {update.retailerItem.price}
                                </span>
                              </div>
                            )}
                          </div>
                          <Badge className="bg-blue-100 text-blue-700 border-blue-200">Updated</Badge>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* No Changes */}
                  {compareResult.newItems.length === 0 && compareResult.updatedItems.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      <Check className="w-12 h-12 mx-auto mb-3 text-green-500" />
                      <p className="font-medium">Your list is up to date!</p>
                      <p className="text-sm">No new items or changes found.</p>
                    </div>
                  )}
                </div>
              </ScrollArea>

              <div className="flex gap-2 pt-2">
                <Button variant="outline" onClick={handleClose} className="flex-1">
                  Cancel
                </Button>
                <Button
                  onClick={handleApplyChanges}
                  className="flex-1"
                  disabled={selectedNewItems.size === 0 && selectedUpdates.size === 0}
                >
                  Apply Changes ({selectedNewItems.size + selectedUpdates.size} items)
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
