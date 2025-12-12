import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/components/ui/use-toast";
import { 
  Eye, 
  Download, 
  Copy, 
  Loader2, 
  Info,
  Link2,
  Link2Off,
} from "lucide-react";
import { ShareMode } from "@/types";

interface ShareSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  list: {
    id: string;
    title: string;
    isShared: boolean;
    shareLink?: string;
    shareMode?: ShareMode;
  };
  onGenerateLink: (shareMode: ShareMode) => Promise<string>;
  onUpdateShareMode: (shareMode: ShareMode) => Promise<void>;
  onUnshare: () => Promise<void>;
}

export default function ShareSettingsModal({
  open,
  onOpenChange,
  list,
  onGenerateLink,
  onUpdateShareMode,
  onUnshare,
}: ShareSettingsModalProps) {
  const { toast } = useToast();
  const [shareMode, setShareMode] = useState<ShareMode>(list.shareMode || 'view_only');
  const [isLoading, setIsLoading] = useState(false);
  const [shareLink, setShareLink] = useState<string | null>(null);

  useEffect(() => {
    if (list.isShared && list.shareLink) {
      setShareLink(`${window.location.origin}/shared/${list.shareLink}`);
    }
    setShareMode(list.shareMode || 'view_only');
  }, [list.isShared, list.shareLink, list.shareMode]);

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
    if (!shareLink) return;
    
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    
    if (isMobile && navigator.share) {
      try {
        await navigator.share({
          title: list.title,
          text: `Check out my list: ${list.title}`,
          url: shareLink,
        });
        toast({
          title: "✅ Link shared!",
          description: "Link shared successfully",
          className: "bg-blue-50 border-blue-200",
        });
        return;
      } catch (shareErr: any) {
        if (shareErr.name === 'AbortError') return;
      }
    }
    
    const copied = await copyToClipboard(shareLink);
    if (copied) {
      toast({
        title: "✅ Link copied!",
        description: "Share link copied to clipboard",
        className: "bg-blue-50 border-blue-200",
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
              value={shareLink} 
              className="bg-gray-100 p-2 rounded text-xs break-all w-full border-0"
              onClick={(e) => {
                (e.target as HTMLInputElement).select();
              }}
            />
          </div>
        ),
        className: "bg-yellow-50 border-yellow-200",
        duration: 15000,
      });
    }
  };

  const handleGenerateOrUpdate = async () => {
    setIsLoading(true);
    try {
      if (list.isShared) {
        // Update share mode
        await onUpdateShareMode(shareMode);
        toast({
          title: "✅ Share settings updated",
          description: `Link is now ${shareMode === 'view_only' ? 'view-only' : shareMode === 'importable' ? 'importable' : 'view and importable'}`,
          className: "bg-green-50 border-green-200",
        });
      } else {
        // Generate new link
        const link = await onGenerateLink(shareMode);
        setShareLink(link);
        
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        if (isMobile && navigator.share) {
          try {
            await navigator.share({
              title: list.title,
              text: `Check out my list: ${list.title}`,
              url: link,
            });
            toast({
              title: "✅ Link created and shared!",
              className: "bg-blue-50 border-blue-200",
            });
            return;
          } catch (shareErr: any) {
            if (shareErr.name !== 'AbortError') {
              // Fall through to copy
            }
          }
        }
        
        const copied = await copyToClipboard(link);
        if (copied) {
          toast({
            title: "✅ Share link created and copied!",
            description: link,
            className: "bg-blue-50 border-blue-200",
          });
        } else {
          toast({
            title: "✅ Share link created",
            description: (
              <div className="flex flex-col gap-2">
                <span>Tap and hold to copy:</span>
                <input 
                  type="text" 
                  readOnly 
                  value={link} 
                  className="bg-gray-100 p-2 rounded text-xs break-all w-full border-0"
                  onClick={(e) => {
                    (e.target as HTMLInputElement).select();
                  }}
                />
              </div>
            ),
            className: "bg-yellow-50 border-yellow-200",
            duration: 15000,
          });
        }
      }
    } catch (error: any) {
      toast({
        title: "❌ Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnshare = async () => {
    setIsLoading(true);
    try {
      await onUnshare();
      setShareLink(null);
      toast({
        title: "✅ List unshared",
        description: "Previous share links will no longer work",
        className: "bg-green-50 border-green-200",
      });
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "❌ Failed to unshare",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="w-5 h-5 text-primary" />
            Share Settings
          </DialogTitle>
          <DialogDescription>
            Control how others can interact with your shared list
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Share Mode Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Share Mode</Label>
            <RadioGroup value={shareMode} onValueChange={(v) => setShareMode(v as ShareMode)}>
              <div className="space-y-3">
                <label className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                  <RadioGroupItem value="view_only" id="view_only" className="mt-1" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Eye className="w-4 h-4 text-blue-600" />
                      <span className="font-medium">View Only</span>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      Others can view your list but cannot import or copy it to their account
                    </p>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                  <RadioGroupItem value="importable" id="importable" className="mt-1" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Download className="w-4 h-4 text-green-600" />
                      <span className="font-medium">Importable Only</span>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      Others can import a copy to their account (they'll be prompted to sign in)
                    </p>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                  <RadioGroupItem value="both" id="both" className="mt-1" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Eye className="w-4 h-4 text-blue-600" />
                      <span className="mr-1">+</span>
                      <Download className="w-4 h-4 text-green-600" />
                      <span className="font-medium">View & Import</span>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      Others can view your list and optionally import a copy to their account
                    </p>
                  </div>
                </label>
              </div>
            </RadioGroup>
          </div>

          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">How sharing works:</p>
                <ul className="list-disc list-inside space-y-1 text-blue-700">
                  <li>Anyone with the link can access based on your settings</li>
                  <li>Imported copies are independent - changes don't sync</li>
                  <li>You can change settings or unshare anytime</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Current Link Display */}
          {list.isShared && shareLink && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Current Share Link</Label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={shareLink}
                  className="flex-1 bg-gray-100 p-2 rounded text-sm break-all border border-gray-200"
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                />
                <Button variant="outline" size="sm" onClick={handleCopyLink} className="min-h-[40px]">
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {list.isShared && (
            <Button
              variant="destructive"
              onClick={handleUnshare}
              disabled={isLoading}
              className="min-h-[44px] w-full sm:w-auto"
            >
              <Link2Off className="w-4 h-4 mr-2" />
              Unshare List
            </Button>
          )}
          <div className="flex-1" />
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="min-h-[44px]"
          >
            Cancel
          </Button>
          <Button
            onClick={handleGenerateOrUpdate}
            disabled={isLoading}
            className="min-h-[44px]"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {list.isShared ? "Updating..." : "Creating..."}
              </>
            ) : list.isShared ? (
              <>
                <Copy className="w-4 h-4 mr-2" />
                Update & Copy Link
              </>
            ) : (
              <>
                <Link2 className="w-4 h-4 mr-2" />
                Create Share Link
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
