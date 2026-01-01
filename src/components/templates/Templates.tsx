import { TemplatesSkeleton } from "@/components/ui/TemplatesSkeleton";
import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/useAuthHook";
import { useLists } from "@/contexts/useListsHook";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  Gift,
  ExternalLink,
  Sparkles,
  Crown,
  Package,
  Lock,
} from "lucide-react";
import { ListCategory } from "@/types";
import { UserTier, getTierDisplayName } from "@/lib/tierUtils";

interface Template {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: ListCategory;
  list_type: string;
  is_premium: boolean;
  item_count: number;
  icon_emoji: string;
  tier_required: string | null;
}

// Hardcoded included template slugs for Even Better tier
const EVEN_BETTER_INCLUDED_SLUGS = [
  "grocery-complete",
  "recipe-starter",
  "vacation-packing",
];

const MARKETPLACE_URL = "https://listmine.com/templates";

// Category order for grouping templates
const CATEGORY_ORDER = [
  "Planning",
  "School",
  "Work",
  "Shopping",
  "Household",
  "Meals",
  "Tasks",
  "Other",
];

// Category labels for headers
const CATEGORY_LABELS: Record<string, string> = {
  Planning: "Planning",
  School: "School",
  Work: "Work",
  Shopping: "Shopping",
  Household: "Household",
  Meals: "Meals",
  Tasks: "Tasks",
  Other: "Other",
};

export default function Templates() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { lists } = useLists();
  const { toast } = useToast();

  const [templates, setTemplates] = useState<Template[]>([]);
  const [entitledTemplateIds, setEntitledTemplateIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Redemption code state
  const [redemptionCode, setRedemptionCode] = useState("");
  const [redeeming, setRedeeming] = useState(false);

  // Create list modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [listName, setListName] = useState("");
  const [creating, setCreating] = useState(false);

  // Determine effective tier for gating: teams always use 'lots_more'
  const isTeamContext = !!location.state?.isTeamContext || new URLSearchParams(location.search).get("ctx") === "team";
  const teamAccountId = location.state?.teamAccountId as string | null;
  const userTier = (isTeamContext ? "lots_more" : (user?.tier || "free")) as UserTier;

  useEffect(() => {
    loadTemplatesAndEntitlements();
  }, [user?.id, userTier]);

  const loadTemplatesAndEntitlements = async () => {
    try {
      setError(null);
      setLoading(true);

      // Load all active templates
      const { data: templatesData, error: templatesError } = await supabase
        .from("templates")
        .select("*")
        .eq("is_active", true)
        .order("name", { ascending: true });

      if (templatesError) throw templatesError;
      setTemplates((templatesData as Template[]) || []);

      // Load user's entitlements if logged in
      if (user?.id) {
        const { data: entitlements, error: entitlementsError } = await supabase
          .from("user_template_entitlements")
          .select("template_id")
          .eq("user_id", user.id);

        if (entitlementsError) {
          console.error("[Templates] Error loading entitlements:", entitlementsError);
        } else {
          setEntitledTemplateIds((entitlements || []).map((e) => e.template_id));
        }
      }
    } catch (error: any) {
      console.error("[ListMine Error]", { operation: "loadTemplates", error });
      setError("Failed to load templates. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  // Tier hierarchy for comparison
  const tierHierarchy: Record<string, number> = {
    free: 0,
    good: 1,
    even_better: 2,
    lots_more: 3,
  };

  // Check if user's tier meets or exceeds required tier
  const meetsMinimumTier = (requiredTier: string | null): boolean => {
    if (!requiredTier) return true;
    const userLevel = tierHierarchy[userTier] ?? 0;
    const requiredLevel = tierHierarchy[requiredTier] ?? 0;
    return userLevel >= requiredLevel;
  };

  // Helper to check if a template is available (included or unlocked) for current user
  const isTemplateAvailable = (template: Template): boolean => {
    // User has an entitlement for this template
    if (entitledTemplateIds.includes(template.id)) return true;
    
    // If template has tier_required, check if user meets that tier
    if (template.tier_required) {
      return meetsMinimumTier(template.tier_required);
    }
    
    switch (userTier) {
      case "lots_more":
        // All templates included
        return true;
      case "even_better":
        // Only specific slugs are included
        return EVEN_BETTER_INCLUDED_SLUGS.includes(template.slug);
      case "good":
      case "free":
      default:
        // No templates included by tier
        return false;
    }
  };

  // Helper to get template status
  const getTemplateStatus = (template: Template): "included" | "unlocked" | "locked" => {
    // Check if user has entitlement first
    if (entitledTemplateIds.includes(template.id)) return "unlocked";
    
    // If template has tier_required, check tier access
    if (template.tier_required) {
      return meetsMinimumTier(template.tier_required) ? "included" : "locked";
    }
    
    switch (userTier) {
      case "lots_more":
        return "included";
      case "even_better":
        if (EVEN_BETTER_INCLUDED_SLUGS.includes(template.slug)) return "included";
        return "locked";
      case "good":
      case "free":
      default:
        return "locked";
    }
  };

  // Sort templates by category order then by name
  const sortedTemplates = [...templates].sort((a, b) => {
    const categoryA = a.category || "Other";
    const categoryB = b.category || "Other";
    const orderA = CATEGORY_ORDER.indexOf(categoryA);
    const orderB = CATEGORY_ORDER.indexOf(categoryB);
    const effectiveOrderA = orderA === -1 ? CATEGORY_ORDER.length : orderA;
    const effectiveOrderB = orderB === -1 ? CATEGORY_ORDER.length : orderB;
    
    if (effectiveOrderA !== effectiveOrderB) {
      return effectiveOrderA - effectiveOrderB;
    }
    return a.name.localeCompare(b.name);
  });

  const handleRedeemCode = async () => {
    if (!redemptionCode.trim()) {
      toast({
        title: "Enter a code",
        description: "Please enter a redemption code to continue.",
        variant: "destructive",
      });
      return;
    }

    setRedeeming(true);
    try {
      const { data, error } = await supabase.rpc("redeem_template_code", {
        p_code: redemptionCode.trim(),
      });

      if (error) throw error;

      const result = data as { success: boolean; template_name?: string; error?: string } | null;

      if (result?.success) {
        toast({
          title: "Template Redeemed!",
          description: `You now have access to "${result.template_name}".`,
          className: "bg-accent/10 border-accent/30",
        });
        setRedemptionCode("");
        // Refresh entitlements
        loadTemplatesAndEntitlements();
      } else {
        toast({
          title: "Redemption Failed",
          description: result?.error || "Invalid or expired code.",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error("[Templates] Redemption error:", error);
      toast({
        title: "Redemption Error",
        description: error.message || "Failed to redeem code. Try again.",
        variant: "destructive",
      });
    } finally {
      setRedeeming(false);
    }
  };

  const handleUseTemplate = (template: Template) => {
    setSelectedTemplate(template);
    setListName(template.name);
    setShowCreateModal(true);
  };

  const handleCreateList = async () => {
    if (!selectedTemplate || !listName.trim()) return;

    // For team context, require teamAccountId
    if (isTeamContext && !teamAccountId) {
      toast({
        title: "Error",
        description: "Team account not found. Please navigate to Templates from a team view.",
        variant: "destructive",
      });
      return;
    }

    // Check list limit - only for personal lists (not team context)
    if (!isTeamContext) {
      const ownedActiveListsCount = lists.filter(
        (l) =>
          l.userId === user?.id &&
          !l.isGuestAccess &&
          !l.isArchived &&
          !l.title.startsWith("[Archived]")
      ).length;

      if (
        user?.listLimit !== -1 &&
        ownedActiveListsCount >= (user?.listLimit || 5)
      ) {
        toast({
          title: "List Limit Reached",
          description: `You've reached your limit of ${user?.listLimit} lists. Upgrade to create more.`,
          variant: "destructive",
        });
        setShowCreateModal(false);
        return;
      }
    }

    setCreating(true);
    try {
      const { data: newListId, error } = await supabase.rpc(
        "create_list_from_template",
        {
          p_template_id: selectedTemplate.id,
          p_list_name: listName.trim(),
          p_account_id: isTeamContext ? teamAccountId : null,
        }
      );

      if (error) throw error;
      
      // Ensure we have a valid UUID before navigating
      if (!newListId || typeof newListId !== "string") {
        throw new Error("Failed to create list - no list ID returned");
      }

      toast({
        title: "List Created!",
        description: `"${listName}" has been created from the template.`,
        className: "bg-accent/10 border-accent/30",
      });

      setShowCreateModal(false);
      
      // Small delay to ensure DB write is complete before navigation
      await new Promise(resolve => setTimeout(resolve, 100));
      navigate(`/list/${newListId}`);
    } catch (error: any) {
      console.error("[Templates] Create list error:", error);
      toast({
        title: "Failed to Create List",
        description: error.message || "Try again or contact support.",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return <TemplatesSkeleton />;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/10 via-white to-secondary/10 flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-8 text-center">
          <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-destructive" />
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-2">
            Failed to Load Templates
          </h2>
          <p className="text-muted-foreground mb-6">{error}</p>
          <Button onClick={loadTemplatesAndEntitlements} className="w-full">
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Retry
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-white to-secondary/10 animate-in fade-in duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate("/dashboard")}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-4xl font-bold text-foreground mb-2">Templates</h1>
              <p className="text-muted-foreground">
                Create lists from pre-made templates to get started quickly
              </p>
            </div>
            <Badge variant="outline" className="bg-primary/10 border-primary/20">
              <Sparkles className="w-3 h-3 mr-1 text-primary" />
              <span className="text-primary">{getTierDisplayName(userTier)} Plan{isTeamContext && " (Team)"}</span>
            </Badge>
          </div>
        </div>

        {/* Redemption Code Input */}
        <Card className="mb-8 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Gift className="w-5 h-5 text-accent" />
            <h3 className="font-semibold text-foreground">Redeem a Code</h3>
          </div>
          <div className="flex gap-3">
            <Input
              placeholder="Enter redemption code..."
              value={redemptionCode}
              onChange={(e) => setRedemptionCode(e.target.value.toUpperCase())}
              className="flex-1 uppercase"
              maxLength={20}
            />
            <Button
              onClick={handleRedeemCode}
              disabled={redeeming || !redemptionCode.trim()}
              className="bg-accent hover:bg-accent/90"
            >
              {redeeming ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Redeem"
              )}
            </Button>
          </div>
        </Card>

        {/* Free tier upgrade banner - only show if not in team context */}
        {userTier === "free" && !isTeamContext && (
          <Card className="mb-8 p-6 bg-primary/5 border-primary/20">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                <Crown className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-foreground mb-1">
                  Upgrade to unlock templates
                </h3>
                <p className="text-sm text-muted-foreground">
                  Templates are available on paid plans. Upgrade to create lists from professionally designed templates.
                </p>
              </div>
              <Button
                onClick={() => navigate("/upgrade")}
                className="bg-primary hover:bg-primary/90"
              >
                Upgrade
              </Button>
            </div>
          </Card>
        )}

        {/* Templates Grid or Empty State */}
        {templates.length === 0 ? (
          <Card className="p-12 text-center">
            <div className="max-w-md mx-auto">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                <Package className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-2">
                No Templates Available
              </h3>
              <p className="text-muted-foreground mb-6">
                Check back later for new templates or browse the marketplace.
              </p>
              <Button
                onClick={() => window.open(MARKETPLACE_URL, "_blank")}
                variant="outline"
                className="border-primary text-primary hover:bg-primary/10"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Browse Marketplace
              </Button>
            </div>
          </Card>
        ) : (
          <div className="space-y-6">
            {(() => {
              // Group templates by category
              const groupedByCategory: Record<string, Template[]> = {};
              sortedTemplates.forEach((template) => {
                const category = template.category || "Other";
                if (!groupedByCategory[category]) {
                  groupedByCategory[category] = [];
                }
                groupedByCategory[category].push(template);
              });

              // Get categories in order - use CATEGORY_ORDER, then append unknown categories alphabetically
              const knownCategories = CATEGORY_ORDER.filter((c) => groupedByCategory[c]?.length);
              const unknownCategories = Object.keys(groupedByCategory)
                .filter((c) => !CATEGORY_ORDER.includes(c))
                .sort((a, b) => a.localeCompare(b));
              const orderedCategories = [...knownCategories, ...unknownCategories];

              return orderedCategories.map((category) => {
                const categoryTemplates = groupedByCategory[category];
                const categoryLabel = CATEGORY_LABELS[category] || category.charAt(0).toUpperCase() + category.slice(1);

                return (
                  <div key={category}>
                    <h3 className="text-sm font-extrabold text-foreground/70 tracking-wide mb-4">
                      {categoryLabel}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {categoryTemplates.map((template) => {
                        const status = getTemplateStatus(template);
                        const isAvailable = status === "included" || status === "unlocked";

                        return (
                          <Card
                            key={template.id}
                            className={`transition-all duration-200 hover:shadow-lg ${
                              isAvailable ? "hover:border-primary/30" : "opacity-90 hover:border-muted-foreground/30"
                            }`}
                          >
                            <CardHeader>
                              <div className="flex items-start justify-between mb-2">
                                <div className="text-4xl">{template.icon_emoji}</div>
                                {status === "included" && (
                                  <Badge
                                    variant="outline"
                                    className="bg-accent/10 text-accent border-accent/20"
                                  >
                                    Included
                                  </Badge>
                                )}
                                {status === "unlocked" && (
                                  <Badge
                                    variant="outline"
                                    className="bg-primary/10 text-primary border-primary/20"
                                  >
                                    Unlocked
                                  </Badge>
                                )}
                                {status === "locked" && (
                                  <Badge
                                    variant="outline"
                                    className="bg-muted text-muted-foreground border-muted-foreground/20"
                                  >
                                    Locked
                                  </Badge>
                                )}
                              </div>
                              <CardTitle className="text-xl text-foreground">
                                {template.name}
                              </CardTitle>
                              <CardDescription className="line-clamp-2">
                                {template.description}
                              </CardDescription>
                            </CardHeader>
                            <CardContent>
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-muted-foreground">
                                  {template.item_count} items
                                </span>
                                {isAvailable ? (
                                  <Button
                                    onClick={() => handleUseTemplate(template)}
                                    className="bg-primary hover:bg-primary/90"
                                  >
                                    Use Template
                                  </Button>
                                ) : (
                                  <Button
                                    onClick={() => window.open(MARKETPLACE_URL, "_blank")}
                                    variant="outline"
                                    className="border-primary text-primary hover:bg-primary/10"
                                  >
                                    <ExternalLink className="w-4 h-4 mr-2" />
                                    Browse Templates
                                  </Button>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        )}

        {/* Link to marketplace for more templates */}
        {templates.length > 0 && userTier !== "lots_more" && (
          <div className="mt-8 text-center">
            <Button
              variant="outline"
              onClick={() => window.open(MARKETPLACE_URL, "_blank")}
              className="border-primary text-primary hover:bg-primary/10"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Browse More Templates
            </Button>
          </div>
        )}
      </div>

      {/* Create List Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="text-2xl">{selectedTemplate?.icon_emoji}</span>
              Create List from Template
            </DialogTitle>
            <DialogDescription>
              Enter a name for your new list based on "{selectedTemplate?.name}".
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="list-name">List Name</Label>
              <Input
                id="list-name"
                value={listName}
                onChange={(e) => setListName(e.target.value)}
                placeholder="Enter list name..."
                autoFocus
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowCreateModal(false)}
              disabled={creating}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateList}
              disabled={creating || !listName.trim()}
              className="bg-primary hover:bg-primary/90"
            >
              {creating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create List"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}