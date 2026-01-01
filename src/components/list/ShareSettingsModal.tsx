import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Eye, 
  Download, 
  Copy, 
  Loader2, 
  Info,
  Link2,
  Link2Off,
  AlertCircle,
  Lock,
} from "lucide-react";
import { ShareMode } from "@/types";
import { useAuth } from "@/contexts/useAuthHook";
import { canShareLists, getTierDisplayName, canUsePurchaseTracking, type UserTier } from "@/lib/tierUtils";
import { ShoppingCart, Gift, Crown } from "lucide-react";

// Helper to normalize listType variations for consistent handling
const normalizeListType = (listType: string | undefined): string => {
  if (!listType) return "custom";
  const normalizations: Record<string, string> = {
    "todo-list": "todo",
    "idea-list": "idea",
    "registry-list": "registry",
  };
  return normalizations[listType] || listType;
};

// Check if listType is a registry or wishlist (for purchaser UI)
const isRegistryOrWishlist = (listType: string | undefined): boolean => {
  const normalized = normalizeListType(listType);
  return normalized === "registry" || normalized === "wishlist";
};

interface ShareSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  list: {
    id: string;
    title: string;
    isShared: boolean;
    shareLink?: string;
    shareMode?: ShareMode;
    listType?: string;
  };
  onGenerateLink: (shareMode: ShareMode) => Promise<string>;
  onUpdateShareMode: (shareMode: ShareMode) => Promise<void>;
  onUnshare: () => Promise<void>;
  effectiveTier?: UserTier; // Optional - if not provided, falls back to user.tier
}

export default function ShareSettingsModal({
  open,
  onOpenChange,
  list,
  onGenerateLink,
  onUpdateShareMode,
  onUnshare,
  effectiveTier: propEffectiveTier,
}: ShareSettingsModalProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [shareMode, setShareMode] = useState<ShareMode>(list.shareMode || 'view_only');
  const [isLoading, setIsLoading] = useState(false);
  const [shareLink, setShareLink] = useState<string | null>(null);
  
  // Use propEffectiveTier if provided, otherwise fall back to user.tier
  const tierToUse = propEffectiveTier ?? (user?.tier as UserTier | undefined);
  const userCanShare = canShareLists(tierToUse);
  const canUseRegistryBuyerMode = canUsePurchaseTracking(tierToUse);
  const showRegistryBuyerOption = isRegistryOrWishlist(list.listType);

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
          title: "Link shared!",
          description: "Link shared successfully",
        });
        return;
      } catch (shareErr: any) {
        if (shareErr.name === 'AbortError') return;
      }
    }
    
    const copied = await copyToClipboard(shareLink);
    if (copied) {
      toast({
        title: "Link copied!",
        duration: 2000,
      });
    } else {
      toast({
        title: "Share link ready",
        description: (
          <div className="flex items-center justify-between gap-2 mt-1">
            <span className="text-sm text-muted-foreground">Tap to copy</span>
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs shrink-0"
              onClick={async () => {
                const success = await copyToClipboard(shareLink);
                if (success) {
                  toast({ title: "Copied!", duration: 1500 });
                }
              }}
            >
              <Copy className="w-3 h-3 mr-1" />
              Copy link
            </Button>
          </div>
        ),
        duration: 8000,
      });
    }
  };

  const handleGenerateOrUpdate = async () => {
    setIsLoading(true);
    try {
      if (list.isShared) {
        // Update share mode
        await onUpdateShareMode(shareMode);
        
        // Also copy the link
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        if (isMobile && navigator.share) {
          try {
            await navigator.share({
              title: list.title,
              text: `Check out my list: ${list.title}`,
              url: shareLink,
            });
            toast({
              title: "Settings saved and link shared!",
            });
            return;
          } catch (shareErr: any) {
            if (shareErr.name !== 'AbortError') {
              // Fall through to copy
            }
          }
        }
        
        const copied = await copyToClipboard(shareLink);
        if (copied) {
          toast({
            title: "Settings saved!",
            description: (
              <div className="flex items-center justify-between gap-2 mt-1">
                <span className="text-sm text-muted-foreground">Link copied ({shareMode === 'view_only' ? 'view-only' : shareMode === 'registry_buyer' ? 'registry/buyer mode' : 'importable'})</span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-xs shrink-0"
                  onClick={async () => {
                    const success = await copyToClipboard(shareLink);
                    if (success) {
                      toast({ title: "Copied!", duration: 1500 });
                    }
                  }}
                >
                  <Copy className="w-3 h-3 mr-1" />
                  Copy link
                </Button>
              </div>
            ),
            duration: 5000,
          });
        } else {
          toast({
            title: "Share settings updated!",
            description: (
              <div className="flex items-center justify-between gap-2 mt-1">
                <span className="text-sm text-muted-foreground">{shareMode === 'view_only' ? 'View-only' : shareMode === 'registry_buyer' ? 'Registry/Buyer Mode' : 'Importable'}</span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-xs shrink-0"
                  onClick={async () => {
                    const success = await copyToClipboard(shareLink);
                    if (success) {
                      toast({ title: "Copied!", duration: 1500 });
                    }
                  }}
                >
                  <Copy className="w-3 h-3 mr-1" />
                  Copy link
                </Button>
              </div>
            ),
            duration: 8000,
          });
        }
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
              title: "Link created and shared!",
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
            title: "Share link created!",
            description: (
              <div className="flex items-center justify-between gap-2 mt-1">
                <span className="text-sm text-muted-foreground">Link copied to clipboard</span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-xs shrink-0"
                  onClick={async () => {
                    const success = await copyToClipboard(link);
                    if (success) {
                      toast({ title: "Copied!", duration: 1500 });
                    }
                  }}
                >
                  <Copy className="w-3 h-3 mr-1" />
                  Copy link
                </Button>
              </div>
            ),
            duration: 5000,
          });
        } else {
          toast({
            title: "Share link created!",
            description: (
              <div className="flex items-center justify-between gap-2 mt-1">
                <span className="text-sm text-muted-foreground">Ready to share</span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-xs shrink-0"
                  onClick={async () => {
                    const success = await copyToClipboard(link);
                    if (success) {
                      toast({ title: "Copied!", duration: 1500 });
                    }
                  }}
                >
                  <Copy className="w-3 h-3 mr-1" />
                  Copy link
                </Button>
              </div>
            ),
            duration: 8000,
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
        title: "List unshared",
        description: "Previous share links will no longer work",
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
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="w-5 h-5 text-[#1f628e]" />
            Share Settings
          </DialogTitle>
          <DialogDescription>
            Control how others can interact with your shared list
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Tier Gating Alert */}
          {!userCanShare && (
            <Alert>
              <Lock className="h-4 w-4" />
              <AlertDescription className="flex items-center justify-between">
                <span>Sharing is available on Good and above plans.</span>
                <Button
                  variant="link"
                  className="p-0 h-auto"
                  onClick={() => {
                    onOpenChange(false);
                    navigate('/upgrade');
                  }}
                >
                  Upgrade now
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* Share Mode Selection */}
          <div className={`space-y-2 ${!userCanShare ? 'opacity-50 pointer-events-none' : ''}`}>
            <Label className="text-sm font-medium">Share Mode</Label>
            <RadioGroup value={shareMode} onValueChange={(v) => setShareMode(v as ShareMode)}>
              <div className="space-y-2">
                <label className="flex items-start gap-3 p-2.5 border rounded-lg cursor-pointer hover:bg-primary/5 transition-colors">
                  <RadioGroupItem value="view_only" id="view_only" className="mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <Eye className="w-4 h-4 text-[#1f628e] flex-shrink-0" />
                      <span className="font-medium text-sm">View Only</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Anyone with the link can view. They can't edit or import.
                    </p>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-2.5 border rounded-lg cursor-pointer hover:bg-primary/5 transition-colors">
                  <RadioGroupItem value="importable" id="importable" className="mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <Download className="w-4 h-4 text-[#00a8a8] flex-shrink-0" />
                      <span className="font-medium text-sm">Importable Only</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Anyone with the link can import a copy to their account (sign-in required). They can't edit your original list.
                    </p>
                  </div>
                </label>

                {/* Registry/Buyer Mode - Only for registry/wishlist list types */}
                {showRegistryBuyerOption && (
                  <label 
                    className={`flex items-start gap-3 p-2.5 border rounded-lg transition-colors ${
                      canUseRegistryBuyerMode 
                        ? 'cursor-pointer hover:bg-primary/5' 
                        : 'opacity-60 cursor-not-allowed bg-gray-50'
                    }`}
                    onClick={(e) => {
                      if (!canUseRegistryBuyerMode) {
                        e.preventDefault();
                      }
                    }}
                  >
                    <RadioGroupItem 
                      value="registry_buyer" 
                      id="registry_buyer" 
                      className="mt-0.5" 
                      disabled={!canUseRegistryBuyerMode}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <Gift className="w-4 h-4 text-[#e879a0] flex-shrink-0" />
                        <span className="font-medium text-sm">Registry / Buyer Mode</span>
                        {!canUseRegistryBuyerMode && (
                          <span className="flex items-center gap-1 text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">
                            <Crown className="w-3 h-3" />
                            Even Better+
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Viewers can mark items as "I'm buying this" and leave their name. Great for gift registries and wishlists.
                      </p>
                      {!canUseRegistryBuyerMode && (
                        <Button
                          variant="link"
                          size="sm"
                          className="h-auto p-0 mt-1 text-xs text-primary"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate("/upgrade");
                            onOpenChange(false);
                          }}
                        >
                          Upgrade to Even Better or Lots More →
                        </Button>
                      )}
                    </div>
                  </label>
                )}
              </div>
            </RadioGroup>
          </div>

          {/* Current Link Display */}
          {list.isShared && shareLink && (
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Share Link</Label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={shareLink}
                  className="flex-1 bg-muted px-3 py-2 rounded-md text-sm border border-border truncate"
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                />
                <Button variant="outline" size="sm" onClick={handleCopyLink} className="min-h-[40px] px-3">
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Info Box - Collapsible on mobile */}
          <details className="bg-[#c7d8e3] border border-[#8fb1c7] rounded-lg">
            <summary className="p-2.5 cursor-pointer text-sm font-medium text-[#1f628e] flex items-center gap-2">
              <Info className="w-4 h-4 text-[#1f628e] flex-shrink-0" />
              How sharing works
            </summary>
            <div className="px-2.5 pb-2.5">
              <ul className="list-disc list-inside space-y-0.5 text-xs text-[#174a6b]">
                <li>Anyone with the link can access based on your settings</li>
                <li>Imported copies are independent - changes don't sync</li>
                <li>You can change settings or unshare anytime</li>
              </ul>
            </div>
          </details>
        </div>

        <DialogFooter className="flex-col-reverse sm:flex-row gap-2 pt-2">
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            {list.isShared && (
              <Button
                variant="destructive"
                onClick={handleUnshare}
                disabled={isLoading}
                className="min-h-[44px] w-full sm:w-auto"
              >
                <Link2Off className="w-4 h-4 mr-2" />
                Unshare
              </Button>
            )}
          </div>
          <div className="flex gap-2 w-full sm:w-auto sm:ml-auto">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="min-h-[44px] flex-1 sm:flex-none"
            >
              Cancel
            </Button>
            <Button
              onClick={handleGenerateOrUpdate}
              disabled={isLoading || !userCanShare}
              className="min-h-[44px] flex-1 sm:flex-none"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {list.isShared ? "Saving..." : "Creating..."}
                </>
              ) : list.isShared ? (
                <>
                  <Copy className="w-4 h-4 mr-2" />
                  Save & Copy
                </>
              ) : (
                <>
                  <Link2 className="w-4 h-4 mr-2" />
                  Create Link
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
