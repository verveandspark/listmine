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
import { Loader2, ExternalLink, ShoppingCart, AlertCircle } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";

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
      console.log('Calling API with URL:', url.trim());
      
      const response = await fetch('/api/scrape-wishlist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: url.trim() }),
      });

      console.log('Response status:', response.status);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('API response:', data);

      if (!data.success) {
        throw new Error(data.error || 'Failed to scrape wishlist');
      }

      const itemsWithSelection = data.items.map((item: ScrapedItem) => ({
        ...item,
        selected: true,
      }));

      setScrapedItems(itemsWithSelection);
      setRetailer(data.retailer);
      setListName(`${data.retailer} Wishlist`);

      toast({
        title: "✅ Wishlist scraped successfully",
        description: `Found ${data.items.length} items from ${data.retailer}`,
        className: "bg-green-50 border-green-200",
      });
    } catch (err: any) {
      console.error('Error:', err);
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

    if (!listName.trim()) {
      toast({
        title: "⚠️ List name required",
        description: "Please enter a name for your list",
        variant: "destructive",
      });
      return;
    }

    try {
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
            Import from Retailer Wishlist
          </DialogTitle>
          <DialogDescription>
            Paste an Amazon, Target, or Walmart wishlist URL to import items
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          {/* URL Input */}
          <div className="space-y-2">
            <Label htmlFor="wishlist-url">Wishlist URL</Label>
            <div className="flex gap-2">
              <Input
                id="wishlist-url"
                placeholder="https://www.amazon.com/hz/wishlist/ls/..."
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
              Supported: Amazon Wishlists, Target Lists, Walmart Lists
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
              <div className="space-y-2">
                <Label htmlFor="list-name">List Name</Label>
                <Input
                  id="list-name"
                  value={listName}
                  onChange={(e) => setListName(e.target.value)}
                  placeholder="Enter list name"
                />
              </div>

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
                      className="flex items-start gap-3 p-3 border rounded-lg hover:bg-gray-50 transition-colors"
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
                    </div>
                  ))}
                </div>
              </ScrollArea>

              <div className="flex gap-2 pt-2">
                <Button variant="outline" onClick={handleClose} className="flex-1">
                  Cancel
                </Button>
                <Button onClick={handleImport} className="flex-1">
                  Create List ({selectedCount} items)
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}