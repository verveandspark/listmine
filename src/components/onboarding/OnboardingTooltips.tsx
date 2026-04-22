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
            Welcome to <strong>ListMine</strong>! You're on the{" "}
            <strong>Free</strong> plan, which gives you access to the core
            features to get started.
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Up to <strong>3 lists</strong> at a time</li>
            <li>
              List types limited to <strong>Custom</strong>,{" "}
              <strong>To-Do</strong>, and <strong>Checklist</strong>
            </li>
            <li>No collaboration, import/export, or registry features</li>
          </ul>
          <p>
            You can upgrade anytime from the <strong>Upgrade</strong> page to
            unlock more lists, list types, and powerful features.
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
            Your plan:{" "}
            <span className="font-semibold text-primary">{displayName}</span>
          </p>
          <p>
            Click <strong>"New List"</strong> from the dashboard to get
            started. You can choose a list type, pick a template, or start
            from scratch.
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Name your list and choose a category</li>
            <li>Add items with priority, due dates, and notes</li>
            <li>Drag and drop to reorder items</li>
            <li>Pin important lists to the top of your dashboard</li>
          </ul>
        </div>
      ),
    },
    {
      id: "navigate",
      title: "Navigate the App",
      body: (
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>
            Use the <strong>sidebar</strong> to jump between your lists,
            templates, and settings. The dashboard gives you a bird's-eye
            view of everything.
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Dashboard</strong> — overview of all your lists</li>
            <li><strong>Templates</strong> — start from a ready-made list</li>
            <li><strong>Profile</strong> — manage your account and preferences</li>
            <li><strong>Search</strong> — quickly find any list or item</li>
          </ul>
        </div>
      ),
    },
    {
      id: "collaborate",
      title: "Collaborate with Others",
      body: (
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>
            Share lists with friends, family, or teammates. Open any list and
            use the <strong>Share</strong> button to invite collaborators.
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <strong>Guests</strong> — invite anyone to view or edit a
              specific list (Good plan+)
            </li>
            <li>
              <strong>Teams</strong> — create a shared workspace where all
              members see team lists (Even Better plan+)
            </li>
            <li>Generate a shareable link for read-only or edit access</li>
          </ul>
        </div>
      ),
    },
    {
      id: "import-export",
      title: "Import, Export, & Print",
      body: (
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>
            Move your data in and out of ListMine with ease. Find these
            options in the <strong>Import / Export</strong> section.
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <strong>Import</strong> — upload a CSV or TXT file to create
              lists instantly (Good plan+)
            </li>
            <li>
              <strong>Export</strong> — download your lists as CSV or TXT
              for backups or sharing (Good plan+)
            </li>
            <li>
              <strong>Print</strong> — print any list directly from the list
              view
            </li>
          </ul>
        </div>
      ),
    },
    {
      id: "registry",
      title: "Registry with Purchase Tracking",
      body: (
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>
            Create wishlists or gift registries and let friends and family
            mark items as purchased — without spoiling the surprise.
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              Available on the <strong>Even Better</strong> plan and above
            </li>
            <li>
              Share a registry link — buyers see availability, you don't see
              who bought what
            </li>
            <li>
              Track purchase history and manage your registry settings
            </li>
          </ul>
        </div>
      ),
    },
    {
      id: "shortcuts",
      title: "Keyboard Shortcuts & Support",
      body: (
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>Work faster and get help whenever you need it.</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              Press{" "}
              <kbd className="px-1 py-0.5 rounded bg-muted border text-xs font-mono">?</kbd>{" "}
              anywhere to see available keyboard shortcuts
            </li>
            <li>
              Use the <strong>Help</strong> menu for FAQs, tips, and contact
              support
            </li>
            <li>
              Access <strong>Settings</strong> from your profile to
              personalize the experience
            </li>
          </ul>
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
          <p>
            Ready to unlock the full power of ListMine? Upgrading gives you
            access to more lists, more list types, and premium features.
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <strong>Good</strong> — more lists, idea &amp; shopping types,
              import/export, guest sharing
            </li>
            <li>
              <strong>Even Better</strong> — teams, registries, wishlists,
              purchase tracking
            </li>
            <li>
              <strong>Lots More</strong> — unlimited everything, all
              features, priority support
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
