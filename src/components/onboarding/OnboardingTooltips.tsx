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
import { ListPlus, Users, Crown, ChevronRight, X } from "lucide-react";
import { useAuth } from "@/contexts/useAuthHook";
import { useNavigate } from "react-router-dom";

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  targetSelector?: string;
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
    id: "upgrade-tier",
    title: "Upgrade for More Features",
    description:
      "You're on the Free tier with up to 5 lists. Upgrade anytime to unlock more lists, collaboration, import/export, wishlists, registries, and more!",
    icon: <Crown className="w-8 h-8 text-primary" />,
  },
];

const ONBOARDING_KEY = "listmine_onboarding_completed";

export function OnboardingTooltips() {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const { user } = useAuth();
  const navigate = useNavigate();

  // Filter steps based on user tier
  const steps = ONBOARDING_STEPS.filter(step => {
    // Hide upgrade step if user is already on Pro or Premium
    if (step.id === "upgrade-tier" && user?.tier && user.tier !== "free") {
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
    localStorage.setItem(ONBOARDING_KEY, "true");
    setIsOpen(false);
  };

  const step = steps[currentStep];

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent 
        className="sm:max-w-md animate-pop-in"
        aria-describedby="onboarding-description"
      >
        <button
          onClick={handleSkip}
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
                Click the <span className="font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded">+ New List</span> button to create your first list. Choose from templates like Tasks, Groceries, or create a custom list.
              </>
            )}
            {step.id === "invite-collaborators" && (
              <>
                Share your lists with friends and family! Open any list and click the <span className="font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded">Share</span> button to invite others to view or edit.{" "}
                <span className="text-xs text-muted-foreground block mt-2">
                  Available on Good, Even Better, and Lots More tiers
                </span>
              </>
            )}
            {step.id === "upgrade-tier" && (
              <>You're on the <span className="font-semibold">Free tier</span> with up to 5 lists. Upgrade anytime to unlock:</>
            )}
          </DialogDescription>
          {step.id === "upgrade-tier" && (
            <div className="text-center">
              <ul className="text-left mt-2 space-y-1 text-sm text-muted-foreground">
                <li>• More lists</li>
                <li>• Collaboration features</li>
                <li>• Import/Export</li>
                <li>• Wishlists & Registries</li>
                <li>• And more</li>
              </ul>
              <Button
                onClick={() => {
                  handleComplete();
                  navigate("/upgrade");
                }}
                variant="link"
                className="mt-3 text-primary p-0 h-auto"
              >
                View upgrade options →
              </Button>
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

        <DialogFooter className="flex flex-col sm:flex-row gap-2">
          <Button
            variant="ghost"
            onClick={handleSkip}
            className="text-gray-500 min-h-[44px]"
          >
            Skip tour
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function resetOnboarding() {
  localStorage.removeItem(ONBOARDING_KEY);
}

export default OnboardingTooltips;
