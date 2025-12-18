import { TemplatesSkeleton } from "@/components/ui/TemplatesSkeleton";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import {
  Search,
  Loader2,
  AlertCircle,
  Star,
  Check,
  ArrowLeft,
} from "lucide-react";
import { ListCategory, ListType } from "@/types";

interface Template {
  id: string;
  name: string;
  description: string;
  category: ListCategory;
  is_premium: boolean;
  item_count: number;
  icon_emoji: string;
}

interface TemplateItem {
  id: string;
  template_id: string;
  name: string;
  quantity?: number;
  notes?: string;
  sort_order: number;
}

export default function Templates() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addList, addItemToList, lists } = useLists();
  const { toast } = useToast();

  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [tierFilter, setTierFilter] = useState<"all" | "free" | "premium">(
    "all",
  );

  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(
    null,
  );
  const [templateItems, setTemplateItems] = useState<TemplateItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeMessage, setUpgradeMessage] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      setError(null);
      const { data, error: templatesError } = await supabase
        .from("templates")
        .select("*")
        .order("name", { ascending: true });

      if (templatesError) throw templatesError;

      setTemplates(data as any);
    } catch (error: any) {
      console.error("[ListMine Error]", { operation: "loadTemplates", error });
      setError(
        "Failed to load templates. Check your connection and try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const loadTemplateItems = async (templateId: string) => {
    setLoadingItems(true);
    try {
      const { data, error: itemsError } = await supabase
        .from("template_items")
        .select("*")
        .eq("template_id", templateId)
        .order("sort_order", { ascending: true });

      if (itemsError) throw itemsError;

      setTemplateItems(data as any);
    } catch (error: any) {
      console.error("[ListMine Error]", {
        operation: "loadTemplateItems",
        error,
      });
      toast({
        title: "❌ Failed to load template items",
        description: "Try again or contact support.",
        variant: "destructive",
      });
    } finally {
      setLoadingItems(false);
    }
  };

  const handlePreview = async (template: Template) => {
    setSelectedTemplate(template);
    setShowPreviewModal(true);
    await loadTemplateItems(template.id);
  };

  const handleCreateFromTemplate = async () => {
    if (!selectedTemplate || !user) return;

    // Check if premium template and user is free tier
    if (selectedTemplate.is_premium && user.tier === "free") {
      setUpgradeMessage(
        "This template requires Good tier or higher. Upgrade to unlock premium templates.",
      );
      setShowUpgradeModal(true);
      return;
    }

    // Check list limit - count only owned active lists (exclude guest access and archived)
    const ownedActiveListsCount = lists.filter(
      (l) => l.userId === user.id && !l.isGuestAccess && !l.isArchived && !l.title.startsWith("[Archived]")
    ).length;
    
    if (user.listLimit !== -1 && ownedActiveListsCount >= user.listLimit) {
      const tierName =
        user.tier === "free"
          ? "Free"
          : user.tier === "good"
            ? "Good"
            : user.tier === "even_better"
              ? "Even Better"
              : "Lots More";
      setUpgradeMessage(
        `You've reached your limit of ${user.listLimit} lists on the ${tierName} tier. Upgrade to create more lists.`,
      );
      setShowUpgradeModal(true);
      return;
    }

    setCreating(true);
    try {
      // Create list
      await addList(selectedTemplate.name, selectedTemplate.category, "custom");

      // Get the newly created list
      const { data: newListData, error: listError } = await supabase
        .from("lists")
        .select("id")
        .eq("user_id", user.id)
        .eq("title", selectedTemplate.name)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (listError) throw listError;

      // Add items to the list
      for (const item of templateItems) {
        await addItemToList(newListData.id, {
          text: item.name,
          quantity: item.quantity,
          notes: item.notes,
          completed: false,
        });
      }

      toast({
        title: "List created from template!",
        description: `${selectedTemplate.name} has been added to your lists`,
        className: "bg-accent/10 border-accent/30",
      });

      setShowPreviewModal(false);
      navigate(`/list/${newListData.id}`);
    } catch (error: any) {
      console.error("[ListMine Error]", {
        operation: "createFromTemplate",
        error,
      });
      toast({
        title: "❌ Failed to create list",
        description: error.message || "Try again or contact support.",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const filteredTemplates = templates.filter((template) => {
    const matchesSearch =
      template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTier =
      tierFilter === "all" ||
      (tierFilter === "free" && !template.is_premium) ||
      (tierFilter === "premium" && template.is_premium);
    return matchesSearch && matchesTier;
  });

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
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Failed to Load Templates
          </h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <Button onClick={loadTemplates} className="w-full">
            <Loader2 className="w-4 h-4 mr-2" />
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
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Templates</h1>
          <p className="text-gray-600">
            Create lists from pre-made templates to get started quickly
          </p>
        </div>

        {/* Search and Filters */}
        <div className="mb-6 space-y-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-12 h-12"
            />
          </div>

          <Tabs
            value={tierFilter}
            onValueChange={(value) =>
              setTierFilter(value as "all" | "free" | "premium")
            }
          >
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="all">All Templates</TabsTrigger>
              <TabsTrigger value="free">Free</TabsTrigger>
              <TabsTrigger value="premium">Premium</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Templates Grid */}
        {filteredTemplates.length === 0 ? (
          <Card className="p-16 text-center">
            <div className="max-w-md mx-auto">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                <Search className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                No templates found
              </h3>
              <p className="text-gray-600">Try a different search or filter.</p>
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTemplates.map((template) => (
              <Card
                key={template.id}
                className="transition-all duration-200 hover:shadow-lg hover:scale-[1.02] cursor-pointer"
                onClick={() => handlePreview(template)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between mb-2">
                    <div className="text-4xl">{template.icon_emoji}</div>
                    <Badge
                      variant={template.is_premium ? "default" : "secondary"}
                      className={
                        template.is_premium
                          ? "bg-warning text-warning-foreground"
                          : "bg-success/10 text-success border-success/20"
                      }
                    >
                      {template.is_premium ? (
                        <>
                          <Star className="w-3 h-3 mr-1" />
                          PREMIUM
                        </>
                      ) : (
                        <>
                          <Check className="w-3 h-3 mr-1" />
                          FREE
                        </>
                      )}
                    </Badge>
                  </div>
                  <CardTitle className="text-xl">{template.name}</CardTitle>
                  <CardDescription className="line-clamp-2">
                    {template.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-500">
                      {template.item_count} items
                    </p>
                    <Button
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePreview(template);
                      }}
                    >
                      Preview
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Preview Modal */}
      <Dialog open={showPreviewModal} onOpenChange={setShowPreviewModal}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="text-5xl">{selectedTemplate?.icon_emoji}</div>
              <div className="flex-1">
                <DialogTitle className="text-2xl">
                  {selectedTemplate?.name}
                </DialogTitle>
                <Badge
                  variant={
                    selectedTemplate?.is_premium ? "default" : "secondary"
                  }
                  className={
                    selectedTemplate?.is_premium
                      ? "bg-warning text-warning-foreground mt-2"
                      : "bg-success/10 text-success border-success/20 mt-2"
                  }
                >
                  {selectedTemplate?.is_premium ? (
                    <>
                      <Star className="w-3 h-3 mr-1" />
                      PREMIUM
                    </>
                  ) : (
                    <>
                      <Check className="w-3 h-3 mr-1" />
                      FREE
                    </>
                  )}
                </Badge>
              </div>
            </div>
            <DialogDescription className="text-base">
              {selectedTemplate?.description}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-6">
            <h3 className="font-semibold text-lg mb-4">
              Template Items ({templateItems.length})
            </h3>
            {loadingItems ? (
              <div className="text-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-2" />
                <p className="text-gray-600">Loading items...</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {templateItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="w-5 h-5 border-2 border-gray-300 rounded flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">
                        {item.quantity &&
                          item.quantity > 1 &&
                          `${item.quantity}x `}
                        {item.name}
                      </p>
                      {item.notes && (
                        <p className="text-sm text-gray-600 mt-1">
                          {item.notes}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-3 mt-6">
            <Button
              variant="outline"
              onClick={() => setShowPreviewModal(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateFromTemplate}
              disabled={creating || loadingItems}
              className="flex-1"
            >
              {creating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create List from Template"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Upgrade Modal */}
      <Dialog open={showUpgradeModal} onOpenChange={setShowUpgradeModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upgrade Required</DialogTitle>
            <DialogDescription>{upgradeMessage}</DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 mt-4">
            <Button
              variant="outline"
              onClick={() => setShowUpgradeModal(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button onClick={() => navigate("/upgrade")} className="flex-1">
              View Plans
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}