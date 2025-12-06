import { ListType } from "@/types";

export type UserTier = "free" | "good" | "even_better" | "lots_more";

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
  { value: "registry-list", label: "Registry", requiredTier: "even_better", tierLabel: "Even Better" },
  { value: "shopping-list", label: "Wishlist", requiredTier: "even_better", tierLabel: "Even Better" },
];

// Tier hierarchy for comparison
const TIER_HIERARCHY: Record<UserTier, number> = {
  "free": 0,
  "good": 1,
  "even_better": 2,
  "lots_more": 3,
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
    "even_better": "Even Better",
    "lots_more": "Lots More",
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
    "even_better": "$5.99/mo",
    "lots_more": "$9.99/mo",
  };
  return pricing[tier] || "";
}

/**
 * Check if user tier is paid (non-free)
 */
export function isPaidTier(tier: UserTier | string | undefined): boolean {
  if (!tier) return false;
  return tier !== "free";
}

/**
 * Get tier level for comparison
 */
export function getTierLevel(tier: UserTier | string | undefined): number {
  if (!tier) return 0;
  return TIER_HIERARCHY[tier as UserTier] ?? 0;
}

/**
 * Check if user can share lists
 */
export function canShareLists(tier: UserTier | string | undefined): boolean {
  return isPaidTier(tier);
}

/**
 * Check if user can export lists
 */
export function canExportLists(tier: UserTier | string | undefined): boolean {
  return isPaidTier(tier);
}

/**
 * Get available export formats for a tier
 */
export function getAvailableExportFormats(tier: UserTier | string | undefined): string[] {
  if (!tier || tier === "free") return [];
  if (tier === "good") return ["csv", "txt"];
  return ["csv", "txt", "pdf"];
}
