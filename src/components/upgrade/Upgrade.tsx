import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/useAuthHook";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Check, HelpCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export default function Upgrade() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, updateUserTier } = useAuth();
  const [isAnnual, setIsAnnual] = useState(false);
  
  // Handle back navigation - use native history with replace to avoid ping-pong
  const handleBack = () => {
    const stateFrom = (location.state as any)?.from;
    if (stateFrom && stateFrom !== '/upgrade') {
      navigate(stateFrom, { replace: true });
    } else if (window.history.length > 1) {
      window.history.back();
    } else {
      navigate('/dashboard', { replace: true });
    }
  };

  const tiers = [
    {
      id: "free",
      name: "Free",
      subtitle: "Perfect for trying ListMine out.",
      monthlyPrice: 0,
      annualPrice: 0,
      listLimit: 5,
      itemLimit: 20,
      features: [
        "5 lists",
        "20 items per list",
        "List types: To-Do, Custom",
        "Print lists",
      ],
    },
    {
      id: "good",
      name: "Good",
      subtitle: "Perfect for personal organization.",
      monthlyPrice: 1.99,
      annualPrice: 20,
      listLimit: 50,
      itemLimit: 150,
      features: [
        "50 lists",
        "150 items per list",
        "List types: To-Do, Shopping, Idea, Custom",
        "Categorize, search, and filter your lists",
        "Import lists from multiple sources",
        "Share read-only links",
        "Export to CSV/TXT",
        "Template shop access",
      ],
    },
    {
      id: "even_better",
      name: "Even Better",
      subtitle: "Great for events, registries, and collaboration.",
      monthlyPrice: 5.99,
      annualPrice: 60,
      listLimit: 100,
      itemLimit: 500,
      recommended: true,
      features: [
        "Everything from Good, plus:",
        "100 lists",
        "500 items per list",
        "2 additional list types: Registry, Wishlist",
        "Anonymous claim/ Purchase tracking",
        "Real-time collaboration (invite up to 2 guests to edit lists)",
        "Export to PDF",
        "3 additional list templates included",
      ],
    },
    {
      id: "lots_more",
      name: "Lots More",
      subtitle: "Best value. Everything you need in one.",
      monthlyPrice: 10.99,
      annualPrice: 100,
      listLimit: -1,
      itemLimit: -1,
      features: [
        "Everything from Even Better, plus:",
        "Unlimited lists and items",
        "3 user accounts with admin access for editing and managing your lists",
        "Unlimited guest collaborators",
        "Over 20 additional templates included",
        "Perfect for teams, families, and businesses",
      ],
    },
  ];

  const handleUpgrade = (tierId: string) => {
    // Placeholder for Stripe integration
    console.log(`Upgrading to ${tierId}`);
    // For now, just update the tier
    updateUserTier(tierId as any);
    handleBack();
  };

  const calculateSavings = (monthlyPrice: number, annualPrice: number) => {
    return (monthlyPrice * 12 - annualPrice).toFixed(0);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-white to-secondary/10 animate-in fade-in duration-200">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleBack}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Choose Your Plan
              </h1>
              <p className="text-sm text-gray-600">
                Select the perfect plan for your needs
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* Monthly/Annual Toggle */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex items-center bg-muted rounded-lg p-1">
            <Button
              variant={!isAnnual ? "default" : "ghost"}
              size="sm"
              onClick={() => setIsAnnual(false)}
              className="px-6 py-2"
            >
              Monthly
            </Button>
            <Button
              variant={isAnnual ? "default" : "ghost"}
              size="sm"
              onClick={() => setIsAnnual(true)}
              className="px-6 py-2"
            >
              Annual
              <Badge
                variant="secondary"
                className="ml-2 bg-success/10 text-success border-success/20"
              >
                Save up to 20%
              </Badge>
            </Button>
          </div>
        </div>

        {/* Tier Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          {tiers.map((tier) => {
            const isCurrentTier = user?.tier === tier.id;
            const price = isAnnual ? tier.annualPrice : tier.monthlyPrice;
            const savings = calculateSavings(
              tier.monthlyPrice,
              tier.annualPrice,
            );

            return (
              <Card
                key={tier.id}
                className={`relative flex flex-col ${
                  tier.recommended
                    ? "border-2 border-[#1F628E] shadow-xl"
                    : "border border-gray-200"
                }`}
              >
                {tier.recommended && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-[#1F628E] text-white px-4 py-1 text-xs font-bold rounded-full shadow-md uppercase">
                    Most Popular
                  </div>
                )}

                <CardHeader className="pb-4">
                  <CardTitle className="text-2xl">{tier.name}</CardTitle>
                  <CardDescription className="text-sm">
                    {tier.subtitle}
                  </CardDescription>
                </CardHeader>

                <CardContent className="flex-1 flex flex-col">
                  {/* Price */}
                  <div className="mb-4">
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-bold text-gray-900">
                        ${price}
                      </span>
                      {tier.monthlyPrice > 0 && (
                        <span className="text-gray-600">
                          /{isAnnual ? "year" : "month"}
                        </span>
                      )}
                    </div>
                    {isAnnual && tier.monthlyPrice > 0 && (
                      <p className="text-sm text-success font-medium mt-1">
                        Save ${savings}/year
                        {tier.recommended && " (best value)"}
                      </p>
                    )}
                  </div>

                  {/* Features */}
                  <ul className="space-y-3 mb-6 flex-1">
                    {tier.features.map((feature, index) => {
                      // Add tooltips for specific features
                      const getFeatureTooltip = (feature: string) => {
                        if (feature.includes("Anonymous claim")) {
                          return "Let others claim items anonymously without revealing who purchased them";
                        }
                        if (feature.includes("Real-time collaboration")) {
                          return "Invite others to edit this list with you in real-time";
                        }
                        if (feature.includes("Export to PDF")) {
                          return "Download your list as PDF";
                        }
                        if (feature.includes("Export to CSV/TXT")) {
                          return "Download your list as CSV or TXT";
                        }
                        if (feature.includes("Template shop access")) {
                          return "Access pre-made list templates for common use cases";
                        }
                        if (feature.includes("admin access")) {
                          return "Multiple user accounts can manage and edit lists with full admin permissions";
                        }
                        return null;
                      };

                      const tooltip = getFeatureTooltip(feature);

                      return (
                        <li key={index} className="flex items-start gap-2">
                          <Check className="w-5 h-5 text-accent mt-0.5 flex-shrink-0" />
                          <span
                            className={`text-sm ${
                              feature.includes("coming soon")
                                ? "text-gray-400"
                                : "text-gray-700"
                            }`}
                          >
                            {feature}
                          </span>
                          {tooltip && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <HelpCircle className="w-4 h-4 text-gray-400 cursor-help flex-shrink-0 mt-0.5" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="max-w-xs">{tooltip}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </li>
                      );
                    })}
                  </ul>

                  {/* Button */}
                  <Button
                    onClick={() => handleUpgrade(tier.id)}
                    disabled={isCurrentTier}
                    className={`w-full font-bold py-6 transition-all ${
                      tier.recommended && !isCurrentTier
                        ? "bg-[#1F628E] hover:bg-[#1F628E]/90 text-white shadow-lg hover:shadow-xl"
                        : ""
                    }`}
                    variant={isCurrentTier ? "outline" : "default"}
                  >
                    {isCurrentTier 
                      ? "Current Plan" 
                      : `Choose the ${tier.name} Plan`}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}