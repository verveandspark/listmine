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
import { Loader2, ExternalLink, ShoppingCart, AlertCircle, ListPlus, Plus } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase } from "@/lib/supabase";
import AddToExistingListModal from "./AddToExistingListModal";

interface ScrapedItem {
  name: string;
  price?: string;
  link?: string;
  image?: string;
  selected?: boolean;
}

interface ScrapeWishlistModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (items: ScrapedItem[], retailer: string) => Promise<void>;
}

export default function ScrapeWishlistModal({
  open,
  onOpenChange,
  onImport,
}: ScrapeWishlistModalProps) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [scrapedItems, setScrapedItems] = useState<ScrapedItem[]>([]);
  const [retailer, setRetailer] = useState("");
  const [error, setError] = useState("");
  const [listName, setListName] = useState("");
  const [importDestination, setImportDestination] = useState<"new" | "existing">("new");
  const [addToExistingModalOpen, setAddToExistingModalOpen] = useState(false);
  const { toast } = useToast();

  const handleScrape = async () => {
    if (!url.trim()) {
      setError("Please enter a wishlist URL");
      return;
    }

    setLoading(true);
    setError("");
    setScrapedItems([]);

    try {
      const { data, error } = await supabase.functions.invoke(
        "supabase-functions-scrape-wishlist",
        {
          body: { url: url.trim() },
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
      setListName(`${data.retailer} Wishlist`);

      toast({
        title: "Wishlist scraped successfully",
        description: `Found ${data.items.length} items from ${data.retailer}`,
      });
    } catch (err: any) {
      console.error("Error:", err);
      setError(
        err.message || "Failed to scrape wishlist. Please check the URL and try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
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
    if (importDestination === "existing") {
      setAddToExistingModalOpen(true);
      return;
    }

    if (!listName.trim()) {
      toast({
        title: "⚠️ List name required",
        description: "Please enter a name for your list",
        variant: "destructive",
      });
      return;
    }

    try {
      // Transform scraped items to match edge function format
      const retailerList = selectedItems.map((item) => ({
        name: item.name,
        price: item.price,
        link: item.link,
        image: item.image,
      }));

      // Call the compare-merge edge function for validation
      const { data, error } = await supabase.functions.invoke(
        "supabase-functions-compare-merge",
        {
          body: {
            listMineListId: null,
            retailerList,
          },
        }
      );

      if (error) {
        throw new Error(error.message || "Failed to process items");
      }

      await onImport(selectedItems, listName);
      handleClose();
    } catch (err: any) {
      toast({
        title: "❌ Import failed",
        description: err.message,
        variant: "destructive",
      });
    }
  };

  const handleClose = () => {
    setUrl("");
    setScrapedItems([]);
    setRetailer("");
    setError("");
    setListName("");
    setImportDestination("new");
    onOpenChange(false);
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

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5" />
            Import from Public List
          </DialogTitle>
          <DialogDescription className="space-y-2">
            <p>Paste a public list URL from any retailer site*.</p>
            <p className="text-xs text-gray-600">
              *Currently supports: Amazon wishlists. More retailers coming soon!
            </p>
            <p className="text-xs text-gray-500">
              Disclaimer: Imports public wishlists, registries, and shopping lists from third-party sites. Not affiliated with any retailer. You're responsible for data you import.{" "}
              <a 
                href="https://listmine.vervesites.com/terms-of-use" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Learn More
              </a>
            </p>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          {/* URL Input */}
          <div className="space-y-2">
            <Label htmlFor="wishlist-url">Wishlist URL</Label>
            <div className="flex gap-2">
              <Input
                id="wishlist-url"
                placeholder="Paste public list URL"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !loading) {
                    handleScrape();
                  }
                }}
                disabled={loading || scrapedItems.length > 0}
                className="flex-1"
              />
              {scrapedItems.length === 0 && (
                <Button onClick={handleScrape} disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Scraping...
                    </>
                  ) : (
                    "Scrape"
                  )}
                </Button>
              )}
            </div>
            <p className="text-xs text-gray-500">
              Currently supports: Amazon wishlists. More retailers coming soon!
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Scraped Items */}
          {scrapedItems.length > 0 && (
            <>
              {/* Import Destination Choice */}
              <div className="space-y-3 p-4 bg-gray-50 rounded-lg border">
                <Label className="text-sm font-medium">Import Destination</Label>
                <RadioGroup
                  value={importDestination}
                  onValueChange={(value) => setImportDestination(value as "new" | "existing")}
                  className="flex flex-col gap-2"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="new" id="scrape-new" />
                    <Label htmlFor="scrape-new" className="font-normal cursor-pointer flex items-center gap-2">
                      <Plus className="w-4 h-4" />
                      Create new list
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="existing" id="scrape-existing" />
                    <Label htmlFor="scrape-existing" className="font-normal cursor-pointer flex items-center gap-2">
                      <ListPlus className="w-4 h-4" />
                      Add to existing list
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {importDestination === "new" && (
                <div className="space-y-2">
                  <Label htmlFor="list-name">List Name</Label>
                  <Input
                    id="list-name"
                    value={listName}
                    onChange={(e) => setListName(e.target.value)}
                    placeholder="Enter list name"
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
                    setError("");
                  }}
                >
                  Clear
                </Button>
              </div>

              <ScrollArea className="flex-1 border rounded-lg">
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

              <div className="flex gap-2 pt-2">
                <Button variant="outline" onClick={handleClose} className="flex-1">
                  Cancel
                </Button>
                <Button onClick={handleImport} className="flex-1">
                  {importDestination === "existing" ? (
                    <>
                      <ListPlus className="w-4 h-4 mr-2" />
                      Add to Existing List ({selectedCount})
                    </>
                  ) : (
                    <>
                      <ShoppingCart className="w-4 h-4 mr-2" />
                      Create New List ({selectedCount})
                    </>
                  )}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>

      {/* Add to Existing List Modal */}
      <AddToExistingListModal
        open={addToExistingModalOpen}
        onOpenChange={setAddToExistingModalOpen}
        items={scrapedItems.filter((item) => item.selected)}
        sourceType="amazon"
        onSuccess={() => {
          handleClose();
        }}
      />
    </Dialog>
  );
}