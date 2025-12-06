import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ListPlus, Users, Crown, ChevronRight, X, Sparkles, Download, HelpCircle, Keyboard, Check } from "lucide-react";
import { useAuth } from "@/contexts/useAuthHook";
import { useNavigate } from "react-router-dom";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { getTierDisplayName, type UserTier } from "@/lib/tierUtils";

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  targetSelector?: string;
}

// Helper to check if user has a paid tier
const isPaidTier = (tier?: string): boolean => {
  return tier === "good" || tier === "even_better" || tier === "lots_more";
};

// Helper to get tier level for comparison
const getTierLevel = (tier?: string): number => {
  const levels: Record<string, number> = {
    "free": 0,
    "good": 1,
    "even_better": 2,
    "lots_more": 3,
  };
  return levels[tier || "free"] || 0;
};

// Tier feature item component with current tier highlighting
interface TierFeatureItemProps {
  tierName: string;
  tierKey: UserTier;
  currentTier?: string;
  children: React.ReactNode;
}

function TierFeatureItem({ tierName, tierKey, currentTier, children }: TierFeatureItemProps) {
  const isCurrentTier = currentTier === tierKey;
  const hasAccess = getTierLevel(currentTier) >= getTierLevel(tierKey);
  
  return (
    <li className={`flex items-center gap-2 ${isCurrentTier ? "bg-primary/10 -mx-2 px-2 py-1 rounded" : ""}`}>
      {hasAccess ? (
        <Check className="w-3 h-3 text-green-600 flex-shrink-0" />
      ) : (
        <Sparkles className="w-3 h-3 text-primary flex-shrink-0" />
      )}
      <span>
        <strong className={isCurrentTier ? "text-primary" : ""}>{tierName}:</strong> {children}
        {isCurrentTier && <Badge variant="outline" className="ml-2 text-xs py-0 px-1">Your plan</Badge>}
      </span>
    </li>
  );
}

const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: "create-list",
    title: "Create Your First List",
    description:
      "Click the button to create your first list. Choose from templates like Tasks, Groceries, or create a custom list.",
    icon: <ListPlus className="w-8 h-8 text-primary" />,
  },
  {
    id: "invite-collaborators",
    title: "Invite Collaborators",
    description:
      "Share your lists with friends and family! Open any list and click the button to invite others to view or edit. Available on Good, Even Better, and Lots More tiers.",
    icon: <Users className="w-8 h-8 text-primary" />,
  },
  {
    id: "import-export",
    title: "Import & Export Lists",
    description:
      "Easily import lists from CSV or TXT files, or export your lists to back them up or share with others.",
    icon: <Download className="w-8 h-8 text-primary" />,
  },
  {
    id: "upgrade-tier",
    title: "Upgrade for More Features",
    description:
      "Upgrade anytime to unlock more lists, collaboration, import/export, wishlists, registries, and more!",
    icon: <Crown className="w-8 h-8 text-primary" />,
  },
  {
    id: "help-support",
    title: "Help & Support",
    description:
      "Need help? Access the Help menu from any page to find FAQs, tips, and contact support.",
    icon: <HelpCircle className="w-8 h-8 text-primary" />,
  },
  {
    id: "keyboard-shortcuts",
    title: "Keyboard Shortcuts",
    description:
      "Work faster with keyboard shortcuts! Press ? anytime to see all available shortcuts.",
    icon: <Keyboard className="w-8 h-8 text-primary" />,
  },
];

const ONBOARDING_KEY = "listmine_onboarding_completed";

export function OnboardingTooltips() {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  // Filter steps based on user tier
  const steps = ONBOARDING_STEPS.filter(step => {
    // Hide upgrade step if user is already on "lots_more" tier
    if (step.id === "upgrade-tier" && user?.tier === "lots_more") {
      return false;
    }
    return true;
  });

  useEffect(() => {
    const hasCompletedOnboarding = localStorage.getItem(ONBOARDING_KEY);
    if (!hasCompletedOnboarding) {
      const timer = setTimeout(() => setIsOpen(true), 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handleSkip = () => {
    handleComplete();
  };

  const handleComplete = () => {
    // Always save if "Don't show again" is checked, or if completing the tour
    localStorage.setItem(ONBOARDING_KEY, "true");
    setIsOpen(false);
  };

  const handleDismiss = () => {
    if (dontShowAgain) {
      localStorage.setItem(ONBOARDING_KEY, "true");
    }
    setIsOpen(false);
  };

  const step = steps[currentStep];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) handleDismiss();
      else setIsOpen(open);
    }}>
      <DialogContent 
        className="sm:max-w-md animate-pop-in"
        aria-describedby="onboarding-description"
      >
        <button
          onClick={handleDismiss}
          aria-label="Skip onboarding tour"
          className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </button>
        <DialogHeader>
          <div className="flex items-center justify-center mb-4">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center animate-pulse-soft">
              {step.icon}
            </div>
          </div>
          <DialogTitle className="text-center text-xl">
            {step.title}
          </DialogTitle>
          <DialogDescription className="text-center text-base leading-relaxed">
            {step.id === "create-list" && (
              <>
                Click the <span className="font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded">+ New List</span> button to create your first list.
              </>
            )}
            {step.id === "invite-collaborators" && (
              <>
                Share your lists with friends and family! Open any list and click the <span className="font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded">Share</span> button to invite others.
              </>
            )}
            {step.id === "import-export" && (
              <>
                Easily import and export your lists to back them up or share with others.
              </>
            )}
            {step.id === "upgrade-tier" && (
              <>Upgrade anytime to unlock more features:</>
            )}
            {step.id === "help-support" && (
              <>
                Click the <span className="font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded">?</span> icon in the header to access help, FAQs, and contact support anytime.
              </>
            )}
            {step.id === "keyboard-shortcuts" && (
              <>
                Press <span className="font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded">?</span> on your keyboard anytime to see all available shortcuts for faster navigation.
              </>
            )}
          </DialogDescription>
          
          {/* Create List slide - tier-aware list types */}
          {step.id === "create-list" && (
            <div className="mt-3">
              {user?.tier && (
                <div className="flex justify-center mb-3">
                  <Badge variant="secondary" className="text-xs">
                    Your plan: {getTierDisplayName(user.tier as UserTier)}
                  </Badge>
                </div>
              )}
              {isPaidTier(user?.tier) ? (
                <div className="text-center">
                  <p className="text-sm text-muted-foreground mb-2">
                    Choose from all available templates:
                  </p>
                  <div className="flex flex-wrap justify-center gap-2">
                    <Badge variant="outline">To-Do</Badge>
                    <Badge variant="outline">Custom</Badge>
                    <Badge variant="outline">Grocery</Badge>
                    <Badge variant="outline">Idea</Badge>
                    {getTierLevel(user?.tier) >= getTierLevel("even_better") && (
                      <>
                        <Badge variant="outline">Registry</Badge>
                        <Badge variant="outline">Wishlist</Badge>
                      </>
                    )}
                  </div>
                  {getTierLevel(user?.tier) < getTierLevel("even_better") && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Upgrade to Even Better for Registry & Wishlist templates
                    </p>
                  )}
                </div>
              ) : (
                <div className="text-center">
                  <p className="text-sm text-muted-foreground mb-2">
                    Available on Free tier:
                  </p>
                  <div className="flex flex-wrap justify-center gap-2 mb-3">
                    <Badge variant="outline">To-Do</Badge>
                    <Badge variant="outline">Custom</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">
                    Upgrade to unlock more templates:
                  </p>
                  <div className="flex flex-wrap justify-center gap-2 mb-3">
                    <Badge variant="secondary" className="opacity-60">Grocery</Badge>
                    <Badge variant="secondary" className="opacity-60">Idea</Badge>
                    <Badge variant="secondary" className="opacity-60">Registry</Badge>
                    <Badge variant="secondary" className="opacity-60">Wishlist</Badge>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      handleComplete();
                      navigate("/upgrade");
                    }}
                    className="w-full text-primary border-primary/30 hover:bg-primary/5"
                  >
                    <Crown className="w-3 h-3 mr-1" />
                    Upgrade for More Templates
                  </Button>
                </div>
              )}
            </div>
          )}
          
          {/* Current tier badge for tier-related slides */}
          {(step.id === "invite-collaborators" || step.id === "import-export") && user?.tier && (
            <div className="flex justify-center mt-2">
              <Badge variant="secondary" className="text-xs">
                Your plan: {getTierDisplayName(user.tier as UserTier)}
              </Badge>
            </div>
          )}
          
          {step.id === "invite-collaborators" && (
            <div className="mt-3">
              <p className="text-xs text-muted-foreground mb-2 text-center">
                <strong>Guests</strong> can view or edit lists you share. <strong>Admin accounts</strong> have full access to manage all your lists.
              </p>
              <ul className="text-left space-y-1 text-sm text-muted-foreground">
                <TierFeatureItem tierName="Good" tierKey="good" currentTier={user?.tier}>
                  Share read-only links
                </TierFeatureItem>
                <TierFeatureItem tierName="Even Better" tierKey="even_better" currentTier={user?.tier}>
                  Invite up to 2 guests to edit
                </TierFeatureItem>
                <TierFeatureItem tierName="Lots More" tierKey="lots_more" currentTier={user?.tier}>
                  3 admin accounts + unlimited guests
                </TierFeatureItem>
              </ul>
              {!isPaidTier(user?.tier) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    handleComplete();
                    navigate("/upgrade");
                  }}
                  className="mt-3 w-full text-primary border-primary/30 hover:bg-primary/5"
                >
                  <Crown className="w-3 h-3 mr-1" />
                  Upgrade to Share Lists
                </Button>
              )}
            </div>
          )}
          {step.id === "import-export" && (
            <div className="mt-3">
              <ul className="text-left space-y-1 text-sm text-muted-foreground">
                <TierFeatureItem tierName="Good" tierKey="good" currentTier={user?.tier}>
                  Import from multiple sources, export to CSV/TXT
                </TierFeatureItem>
                <TierFeatureItem tierName="Even Better" tierKey="even_better" currentTier={user?.tier}>
                  All above + export to PDF
                </TierFeatureItem>
                <TierFeatureItem tierName="Lots More" tierKey="lots_more" currentTier={user?.tier}>
                  All import/export features
                </TierFeatureItem>
              </ul>
              {!isPaidTier(user?.tier) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    handleComplete();
                    navigate("/upgrade");
                  }}
                  className="mt-3 w-full text-primary border-primary/30 hover:bg-primary/5"
                >
                  <Crown className="w-3 h-3 mr-1" />
                  Upgrade for Import/Export
                </Button>
              )}
            </div>
          )}
          {step.id === "upgrade-tier" && (
            <div className="text-center">
              {user?.tier && (
                <div className="flex justify-center mb-3">
                  <Badge variant="secondary" className="text-xs">
                    Your plan: {getTierDisplayName(user.tier as UserTier)}
                  </Badge>
                </div>
              )}
              <ul className="text-left mt-2 space-y-2 text-sm text-muted-foreground">
                <TierFeatureItem tierName="Good" tierKey="good" currentTier={user?.tier}>
                  Import from multiple sources, share read-only links, export to CSV/TXT
                </TierFeatureItem>
                <TierFeatureItem tierName="Even Better" tierKey="even_better" currentTier={user?.tier}>
                  Real-time collaboration (2 guests), export to PDF, Registry & Wishlist templates
                </TierFeatureItem>
                <TierFeatureItem tierName="Lots More" tierKey="lots_more" currentTier={user?.tier}>
                  3 admin accounts, unlimited guests, all features
                </TierFeatureItem>
              </ul>
              <Button
                onClick={() => {
                  handleComplete();
                  navigate("/upgrade");
                }}
                className="mt-4 w-full bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
              >
                <Crown className="w-4 h-4 mr-2" />
                See Plans & Upgrade
              </Button>
            </div>
          )}
          {step.id === "keyboard-shortcuts" && (
            <div className="text-center">
              <div className="mt-2 grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-2 bg-gray-50 rounded px-2 py-1">
                  <kbd className="px-2 py-0.5 bg-white border rounded text-xs font-mono">N</kbd>
                  <span>New list</span>
                </div>
                <div className="flex items-center gap-2 bg-gray-50 rounded px-2 py-1">
                  <kbd className="px-2 py-0.5 bg-white border rounded text-xs font-mono">/</kbd>
                  <span>Search</span>
                </div>
                <div className="flex items-center gap-2 bg-gray-50 rounded px-2 py-1">
                  <kbd className="px-2 py-0.5 bg-white border rounded text-xs font-mono">?</kbd>
                  <span>Help</span>
                </div>
                <div className="flex items-center gap-2 bg-gray-50 rounded px-2 py-1">
                  <kbd className="px-2 py-0.5 bg-white border rounded text-xs font-mono">Esc</kbd>
                  <span>Close</span>
                </div>
              </div>
            </div>
          )}
        </DialogHeader>

        {/* Progress dots */}
        <div className="flex justify-center gap-2 my-4" role="progressbar" aria-valuenow={currentStep + 1} aria-valuemin={1} aria-valuemax={steps.length} aria-label={`Step ${currentStep + 1} of ${steps.length}`}>
          {steps.map((_, index) => (
            <div
              key={index}
              className={`w-2 h-2 rounded-full transition-all duration-300 ${
                index === currentStep
                  ? "bg-primary w-6"
                  : index < currentStep
                  ? "bg-primary/60"
                  : "bg-gray-300"
              }`}
              aria-label={`Step ${index + 1}${index === currentStep ? " (current)" : index < currentStep ? " (completed)" : ""}`}
            />
          ))}
        </div>

        <DialogFooter className="flex flex-col gap-4">
          {/* Don't show again checkbox */}
          <div className="flex items-center space-x-2 w-full justify-center">
            <Checkbox 
              id="dont-show-again" 
              checked={dontShowAgain}
              onCheckedChange={(checked) => setDontShowAgain(checked === true)}
            />
            <Label 
              htmlFor="dont-show-again" 
              className="text-sm text-gray-500 cursor-pointer"
            >
              Don't show this again
            </Label>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-2 w-full">
            <Button
              variant="ghost"
              onClick={handleDismiss}
              className="text-gray-500 min-h-[44px]"
            >
              {dontShowAgain ? "Dismiss" : "Skip tour"}
            </Button>
            <Button onClick={handleNext} className="min-h-[44px]">
              {currentStep < steps.length - 1 ? (
                <>
                  Next
                  <ChevronRight className="w-4 h-4 ml-1" />
                </>
              ) : (
                "Get Started!"
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function resetOnboarding() {
  localStorage.removeItem(ONBOARDING_KEY);
}

export default OnboardingTooltips;
