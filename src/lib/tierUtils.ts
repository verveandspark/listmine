import { ListType } from "@/types";

export type UserTier = "free" | "good" | "even-better" | "lots-more";

export interface ListTypeInfo {
  value: ListType;
  label: string;
  requiredTier: UserTier;
  tierLabel: string;
}

// Define all list types with their required tiers
export const ALL_LIST_TYPES: ListTypeInfo[] = [
  { value: "custom", label: "Custom", requiredTier: "free", tierLabel: "Free" },
  { value: "todo-list", label: "To-Do", requiredTier: "free", tierLabel: "Free" },
  { value: "grocery-list", label: "Grocery", requiredTier: "good", tierLabel: "Good" },
  { value: "idea-list", label: "Idea", requiredTier: "good", tierLabel: "Good" },
  { value: "registry-list", label: "Registry", requiredTier: "even-better", tierLabel: "Even Better" },
  { value: "shopping-list", label: "Wishlist", requiredTier: "even-better", tierLabel: "Even Better" },
];

// Tier hierarchy for comparison
const TIER_HIERARCHY: Record<UserTier, number> = {
  "free": 0,
  "good": 1,
  "even-better": 2,
  "lots-more": 3,
};

/**
 * Check if a user tier has access to a specific list type
 */
export function canAccessListType(userTier: UserTier, listType: ListType): boolean {
  const typeInfo = ALL_LIST_TYPES.find((t) => t.value === listType);
  if (!typeInfo) return true; // Unknown types are allowed
  
  const userTierLevel = TIER_HIERARCHY[userTier] ?? 0;
  const requiredTierLevel = TIER_HIERARCHY[typeInfo.requiredTier] ?? 0;
  
  return userTierLevel >= requiredTierLevel;
}

/**
 * Get all list types available for a specific tier
 */
export function getAvailableListTypes(userTier: UserTier): ListType[] {
  return ALL_LIST_TYPES
    .filter((type) => canAccessListType(userTier, type.value))
    .map((type) => type.value);
}

/**
 * Get list type info with availability status for a user tier
 */
export function getListTypesWithAvailability(userTier: UserTier): (ListTypeInfo & { available: boolean })[] {
  return ALL_LIST_TYPES.map((type) => ({
    ...type,
    available: canAccessListType(userTier, type.value),
  }));
}

/**
 * Get the tier required to unlock a specific list type
 */
export function getRequiredTierForListType(listType: ListType): { tier: UserTier; label: string } | null {
  const typeInfo = ALL_LIST_TYPES.find((t) => t.value === listType);
  if (!typeInfo) return null;
  return { tier: typeInfo.requiredTier, label: typeInfo.tierLabel };
}

/**
 * Get tier display name
 */
export function getTierDisplayName(tier: UserTier): string {
  const names: Record<UserTier, string> = {
    "free": "Free",
    "good": "Good",
    "even-better": "Even Better",
    "lots-more": "Lots More",
  };
  return names[tier] || tier;
}

/**
 * Get tier pricing (for display purposes)
 */
export function getTierPricing(tier: UserTier): string {
  const pricing: Record<UserTier, string> = {
    "free": "Free",
    "good": "$2.99/mo",
    "even-better": "$5.99/mo",
    "lots-more": "$9.99/mo",
  };
  return pricing[tier] || "";
}
