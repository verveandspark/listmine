import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAccount } from "@/contexts/AccountContext";
import { getTierDisplayName, type UserTier } from "@/lib/tierUtils";

const ONBOARDING_KEY = "listmine_onboarding_seen";

interface OnboardingTooltipsProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

interface Slide {
  id: string;
  title: string;
  body: React.ReactNode;
  tierFilter?: UserTier[];
  isLast?: boolean;
}

function getSlides(effectiveTier: UserTier, displayName: string): Slide[] {
  const slides: Slide[] = [
    {
      id: "free-note",
      title: "Important Note About Your Free Account",
      tierFilter: ["free"],
      body: (
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>
            The Free Plan includes three core list types, basic list functions
            such as duplicate, merge, and edit, and the ability to print. The
            rest of this tour mentions things that are not always available
            until you upgrade. You can do so anytime from your profile area or
            by clicking{" "}
            <button
              className="text-primary underline font-medium"
              onClick={() => navigate("/upgrade")}
            >
              here
            </button>
            .
          </p>
        </div>
      ),
    },
    {
      id: "create-list",
      title: "Create Your First List",
      body: (
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>
            Your Plan:{" "}
            <span className="font-semibold text-primary">{displayName}</span>
          </p>
          <p>
            Click the <strong>+ New List</strong> button or the plus icon to
            create your first list. Choose from available lists or start from a
            template: Custom, To-Do, Checklist, Shopping List, Grocery, Idea,
            Registry/Wishlist
          </p>
          <p>Paid plans can also organize any list with sections.</p>
        </div>
      ),
    },
    {
      id: "navigate",
      title: "Navigate the App",
      body: (
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>
            Use the Dashboard/List toggle to switch views. Hover over the
            buttons in the menu to see what each does. A few helpful ones: Add
            Section, Duplicate, and Merge
          </p>
          <p>Your plan determines what buttons you see in your menu.</p>
        </div>
      ),
    },
    {
      id: "collaborate",
      title: "Collaborate with Others",
      body: (
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>
            Share your lists in multiple ways. Click the share button to see
            your options.
          </p>
          <p>Share Options include:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Good+:</strong> Read-only and Copy</li>
            <li><strong>Even Better+:</strong> Registry and Guest Access</li>
            <li><strong>Lots More:</strong> Team Access</li>
          </ul>
          <p>
            Guests can view and edit specific lists you share with them. Teams
            lets you create a shared workspace with joint access. Use the{" "}
            <strong>Account Switcher</strong> to switch between Personal and
            Team modes.
          </p>
        </div>
      ),
    },
    {
      id: "import-export",
      title: "Import, Export, & Print",
      body: (
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>
            Import lists to get started faster. Just click the import button
            from the dashboard or list view. You can import from a file,
            another ListMine user, and even supported retailers on the Even
            Better plan.
          </p>
          <p>
            Print is available on all plans. Export formats vary by plan and
            include CSV, TXT, and PDF (Even Better+).
          </p>
        </div>
      ),
    },
    {
      id: "registry",
      title: "Registry with Purchase Tracking",
      body: (
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>
            Create one from scratch or combine all of your retailer registries
            in one place with our registry importer. Organize and track each
            purchase.
          </p>
          <p>
            Use the Shopping Cart button to see what's been purchased. Buyers
            can leave notes and their name. You choose when to reveal who they
            are if you need to send a thank you.
          </p>
          <p>
            Need to update your registry or add a new retailer? Just Rescrape
            it by hitting the rescrape button.
          </p>
        </div>
      ),
    },
    {
      id: "shortcuts",
      title: "Keyboard Shortcuts & Support",
      body: (
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>Click the ? in the menu to access help, FAQs, and support.</p>
          <p>You'll see quick shortcuts like:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <kbd className="px-1 py-0.5 rounded bg-muted border text-xs font-mono">N</kbd>{" "}
              — Create new list
            </li>
            <li>
              <kbd className="px-1 py-0.5 rounded bg-muted border text-xs font-mono">/</kbd>{" "}
              — Search lists
            </li>
            <li>
              <kbd className="px-1 py-0.5 rounded bg-muted border text-xs font-mono">ESC</kbd>{" "}
              — Close modal
            </li>
            <li>
              <kbd className="px-1 py-0.5 rounded bg-muted border text-xs font-mono">?</kbd>{" "}
              — Open help &amp; shortcuts
            </li>
          </ul>
          <p>
            You'll also be able to contact us or visit our support page through
            the Help menu.
          </p>
        </div>
      ),
    },
    {
      id: "upgrade",
      title: "Upgrade for More Features",
      tierFilter: ["free", "good", "even_better"],
      isLast: true,
      body: (
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>Upgrade anytime to unlock more features.</p>
          <p>
            Your Plan:{" "}
            <span className="font-semibold text-primary">{displayName}</span>
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <strong>Good:</strong> adds sections, import, export to CSV/TXT,
              and the ability to share/copy lists with others.
            </li>
            <li>
              <strong>Even Better:</strong> adds registry/purchasing, PDF
              export, guest access, and 3 free templates.
            </li>
            <li>
              <strong>Lots More:</strong> adds team access, all templates, and
              unlimited lists.
            </li>
          </ul>
        </div>
      ),
    },
  ];

  return slides.filter((slide) => {
    if (!slide.tierFilter) return true;
    return slide.tierFilter.includes(effectiveTier);
  });
}

export function OnboardingTooltips({
  open: externalOpen,
  onOpenChange,
}: OnboardingTooltipsProps = {}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const { effectiveTier } = useAccount();
  const navigate = useNavigate();

  const isControlled = externalOpen !== undefined;
  const isOpen = isControlled ? externalOpen : internalOpen;

  const setOpen = (val: boolean) => {
    if (isControlled) {
      onOpenChange?.(val);
    } else {
      setInternalOpen(val);
    }
  };

  // Auto-show on first visit (uncontrolled mode only)
  useEffect(() => {
    if (isControlled) return;
    const hasCompleted = localStorage.getItem(ONBOARDING_KEY);
    if (!hasCompleted) {
      const timer = setTimeout(() => setInternalOpen(true), 1000);
      return () => clearTimeout(timer);
    }
  }, [isControlled]);

  // Reset to step 0 when opened externally
  useEffect(() => {
    if (isOpen) {
      setCurrentStep(0);
      setDontShowAgain(false);
    }
  }, [isOpen]);

  const displayName = getTierDisplayName(effectiveTier);
  const slides = getSlides(effectiveTier, displayName);
  const totalSteps = slides.length;
  const slide = slides[currentStep];
  const isLastSlide = slide?.isLast || currentStep === totalSteps - 1;

  const handleClose = () => {
    if (dontShowAgain) {
      localStorage.setItem(ONBOARDING_KEY, "true");
    }
    setOpen(false);
  };

  const handleNext = () => {
    if (!isLastSlide) {
      setCurrentStep((s) => s + 1);
    }
  };

  const handleGetStarted = () => {
    localStorage.setItem(ONBOARDING_KEY, "true");
    setOpen(false);
  };

  const handleUpgrade = () => {
    localStorage.setItem(ONBOARDING_KEY, "true");
    setOpen(false);
    navigate("/upgrade");
  };

  if (!slide) return null;

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg">{slide.title}</DialogTitle>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex gap-1 mb-2">
          {slides.map((_, i) => (
            <div
              key={i}
              className={`h-1 rounded-full flex-1 transition-colors ${
                i === currentStep
                  ? "bg-primary"
                  : i < currentStep
                  ? "bg-primary/40"
                  : "bg-muted"
              }`}
            />
          ))}
        </div>

        {/* Body */}
        <div className="py-2">{slide.body}</div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t gap-4">
          {/* Don't show again */}
          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
            <Checkbox
              id="dont-show-again"
              checked={dontShowAgain}
              onCheckedChange={(checked) =>
                setDontShowAgain(checked === true)
              }
            />
            Don't show again
          </label>

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button variant="ghost" size="sm" onClick={handleClose}>
              Skip tour
            </Button>

            {isLastSlide && slide.id === "upgrade" && (
              <Button variant="outline" size="sm" onClick={handleUpgrade}>
                See plans &amp; upgrade
              </Button>
            )}

            {!isLastSlide ? (
              <Button size="sm" onClick={handleNext}>
                Next
              </Button>
            ) : (
              <Button size="sm" onClick={handleGetStarted}>
                Get started
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function resetOnboarding() {
  localStorage.removeItem(ONBOARDING_KEY);
}

export default OnboardingTooltips;
