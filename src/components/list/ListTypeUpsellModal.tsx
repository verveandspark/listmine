import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Lock, Sparkles } from "lucide-react";
import { getTierDisplayName, getTierPricing, UserTier } from "@/lib/tierUtils";

interface ListTypeUpsellModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  listTypeLabel: string;
  requiredTier: UserTier;
}

export default function ListTypeUpsellModal({
  open,
  onOpenChange,
  listTypeLabel,
  requiredTier,
}: ListTypeUpsellModalProps) {
  const navigate = useNavigate();

  const handleUpgrade = () => {
    onOpenChange(false);
    navigate("/upgrade");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px] bg-white">
        <DialogHeader>
          <div className="flex items-center justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-teal-100 flex items-center justify-center">
              <Lock className="w-8 h-8 text-teal-600" />
            </div>
          </div>
          <DialogTitle className="text-center text-xl">
            Unlock {listTypeLabel} Lists
          </DialogTitle>
        </DialogHeader>
        
        <div className="py-4 text-center">
          <p className="text-muted-foreground mb-4">
            {listTypeLabel} lists are available on the{" "}
            <span className="font-semibold text-primary">
              "{getTierDisplayName(requiredTier)}"
            </span>{" "}
            plan ({getTierPricing(requiredTier)})
          </p>
          
          <div className="bg-gradient-to-r from-teal-50 to-accent/10 rounded-lg p-4 border border-teal-200">
            <div className="flex items-center justify-center gap-2 text-teal-700 mb-2">
              <Sparkles className="w-4 h-4" />
              <span className="font-medium">Upgrade Benefits</span>
            </div>
            <ul className="text-sm text-left text-muted-foreground space-y-1">
              <li>• Access to {listTypeLabel} lists</li>
              <li>• More list capacity</li>
              <li>• Collaboration features</li>
              <li>• Import/Export functionality</li>
            </ul>
          </div>
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto"
          >
            Maybe Later
          </Button>
          <Button
            onClick={handleUpgrade}
            className="w-full sm:w-auto bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            Upgrade Now
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
