import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLists } from "@/contexts/useListsHook";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Download } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

interface ImportListModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ImportListModal({
  open,
  onOpenChange,
}: ImportListModalProps) {
  const [shareUrl, setShareUrl] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { importFromShareLink } = useLists();
  const navigate = useNavigate();
  const { toast } = useToast();

  const extractShareId = (url: string): string | null => {
    try {
      // Handle various URL formats
      // https://listmine.vercel.app/shared/abc123
      // /shared/abc123
      // abc123
      const trimmedUrl = url.trim();
      
      if (trimmedUrl.includes("/shared/")) {
        const parts = trimmedUrl.split("/shared/");
        return parts[1]?.split(/[?#]/)[0] || null;
      }
      
      // If it's just the ID
      if (!trimmedUrl.includes("/") && !trimmedUrl.includes("http")) {
        return trimmedUrl;
      }
      
      return null;
    } catch {
      return null;
    }
  };

  const handleImport = async () => {
    if (!shareUrl.trim()) {
      setError("Please enter a share link");
      return;
    }

    const shareId = extractShareId(shareUrl);
    if (!shareId) {
      setError("Invalid share link format. Please paste the full URL or share ID.");
      return;
    }

    setIsImporting(true);
    setError(null);

    try {
      const newListId = await importFromShareLink(shareId);
      
      toast({
        title: "List imported successfully!",
        description: "The list has been added to your account.",
      });
      
      // Navigate to the new list
      navigate(`/list/${newListId}`);
      
      // Close modal and reset
      setShareUrl("");
      onOpenChange(false);
    } catch (err: any) {
      setError(err.message || "Failed to import list");
      setIsImporting(false);
    }
  };

  const handleCancel = () => {
    setShareUrl("");
    setError(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] bg-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="w-5 h-5" />
            Import List from Share Link
          </DialogTitle>
          <DialogDescription>
            Paste a share link from another ListMine user to create a copy in your account.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="share-url">Share Link or ID</Label>
            <Input
              id="share-url"
              placeholder="https://listmine.vercel.app/shared/abc123 or abc123"
              value={shareUrl}
              onChange={(e) => setShareUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !isImporting) {
                  handleImport();
                }
              }}
              autoFocus
            />
            <p className="text-xs text-gray-500">
              You can paste the full URL or just the share ID
            </p>
          </div>
          {error && (
            <div className="text-sm text-red-600 bg-red-50 p-3 rounded border border-red-200">
              {error}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={isImporting}
          >
            Cancel
          </Button>
          <Button onClick={handleImport} disabled={isImporting}>
            {isImporting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                Import
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
