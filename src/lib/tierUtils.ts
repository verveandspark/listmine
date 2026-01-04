import { ListType } from "@/types";

export type UserTier = "free" | "good" | "even_better" | "lots_more";

export interface ListTypeInfo {
  value: ListType;
  label: string;
  requiredTier: UserTier;
  tierLabel: string;
}

// Define all list types with their required tiers
// NOTE: These are the canonical 6 base types shown in the UI
export const ALL_LIST_TYPES: ListTypeInfo[] = [
  { value: "custom", label: "Custom", requiredTier: "free", tierLabel: "Free" },
  { value: "todo-list", label: "To-Do", requiredTier: "free", tierLabel: "Free" },
  { value: "idea-list", label: "Idea", requiredTier: "good", tierLabel: "Good" },
  { value: "shopping-list", label: "Shopping List", requiredTier: "good", tierLabel: "Good" },
  { value: "registry-list", label: "Registry", requiredTier: "even_better", tierLabel: "Even Better" },
  { value: "wishlist", label: "Wishlist", requiredTier: "even_better", tierLabel: "Even Better" },
];

// Tier hierarchy for comparison
const TIER_HIERARCHY: Record<UserTier, number> = {
  "free": 0,
  "good": 1,
  "even_better": 2,
  "lots_more": 3,
};

/**
 * Tier limits for lists and items
 */
export const TIER_LIMITS: Record<UserTier, { lists: number; itemsPerList: number }> = {
  "free": { lists: 5, itemsPerList: 20 },
  "good": { lists: 50, itemsPerList: 150 },
  "even_better": { lists: 100, itemsPerList: 500 },
  "lots_more": { lists: -1, itemsPerList: -1 }, // -1 means unlimited
};

/**
 * Get tier limits
 */
export function getTierLimits(tier: UserTier | string | undefined): { lists: number; itemsPerList: number } {
  if (!tier) return TIER_LIMITS.free;
  return TIER_LIMITS[tier as UserTier] ?? TIER_LIMITS.free;
}

/**
 * Format limit for display (handles -1 as unlimited)
 */
export function formatLimit(limit: number): string {
  return limit === -1 ? "Unlimited" : limit.toString();
}

/**
 * Format limit with infinity symbol for compact display
 */
export function formatLimitCompact(limit: number): string {
  return limit === -1 ? "∞" : limit.toString();
}

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
 * Check if user can share lists (read-only links)
 * Free: no sharing
 * Good+: read-only share links
 */
export function canShareLists(tier: UserTier | string | undefined): boolean {
  return isPaidTier(tier);
}

/**
 * Check if user can unshare lists
 * Good+: can unshare
 */
export function canUnshareLists(tier: UserTier | string | undefined): boolean {
  return isPaidTier(tier);
}

/**
 * Check if user can import lists
 * Free: no import
 * Good+: import enabled
 */
export function canImportLists(tier: UserTier | string | undefined): boolean {
  return isPaidTier(tier);
}

/**
 * Check if user can export lists
 * Free: no export (only print)
 * Good+: export enabled
 */
export function canExportLists(tier: UserTier | string | undefined): boolean {
  return isPaidTier(tier);
}

/**
 * Check if user can print lists
 * All tiers: print enabled
 */
export function canPrintLists(_tier: UserTier | string | undefined): boolean {
  return true; // All tiers can print
}

/**
 * Get available export formats for a tier
 * Free: none (print only)
 * Good: csv, txt
 * Even Better+: csv, txt, pdf
 */
export function getAvailableExportFormats(tier: UserTier | string | undefined): string[] {
  if (!tier || tier === "free") return [];
  if (tier === "good") return ["csv", "txt"];
  return ["csv", "txt", "pdf"];
}

/**
 * Guest limits per list by tier
 * Free: 0 guests (no sharing)
 * Good: 0 guests (read-only share only)
 * Even Better: 2 guests per list (edit)
 * Lots More: unlimited guests (edit)
 */
export const GUEST_LIMITS: Record<UserTier, number> = {
  "free": 0,
  "good": 0,
  "even_better": 2,
  "lots_more": -1, // unlimited
};

/**
 * Check if user tier can invite guests (edit access)
 * Even Better+: can invite guests
 */
export function canInviteGuests(tier: UserTier | string | undefined): boolean {
  if (!tier) return false;
  return tier === "even_better" || tier === "lots_more";
}

/**
 * Get guest limit for a tier (-1 means unlimited)
 */
export function getGuestLimit(tier: UserTier | string | undefined): number {
  if (!tier) return 0;
  return GUEST_LIMITS[tier as UserTier] ?? 0;
}

/**
 * Format guest limit for display
 */
export function formatGuestLimit(tier: UserTier | string | undefined): string {
  const limit = getGuestLimit(tier);
  if (limit === -1) return "Unlimited";
  if (limit === 0) return "None";
  return limit.toString();
}

/**
 * Team account limits
 * Free, Good, Even Better: no team accounts
 * Lots More: up to 3 team accounts
 */
export const TEAM_ACCOUNT_LIMITS: Record<UserTier, number> = {
  "free": 0,
  "good": 0,
  "even_better": 0,
  "lots_more": 3,
};

/**
 * Check if user tier can have team members/accounts
 * Lots More only
 */
export function canHaveTeamMembers(tier: UserTier | string | undefined): boolean {
  if (!tier) return false;
  return tier === "lots_more";
}

/**
 * Get team account limit for a tier
 */
export function getTeamAccountLimit(tier: UserTier | string | undefined): number {
  if (!tier) return 0;
  return TEAM_ACCOUNT_LIMITS[tier as UserTier] ?? 0;
}

/**
 * Team member roles
 */
export type TeamMemberRole = "member" | "manager" | "billing_admin";

/**
 * Get role display name
 */
export function getRoleDisplayName(role: TeamMemberRole): string {
  const names: Record<TeamMemberRole, string> = {
    "member": "Member",
    "manager": "Manager",
    "billing_admin": "Billing Admin",
  };
  return names[role] || role;
}

/**
 * Check if a role can manage team members
 */
export function canManageTeamMembers(role: TeamMemberRole | string | undefined): boolean {
  if (!role) return false;
  return role === "manager" || role === "billing_admin";
}

/**
 * Check if a role can access billing
 */
export function canAccessBilling(role: TeamMemberRole | string | undefined): boolean {
  if (!role) return false;
  return role === "billing_admin";
}

/**
 * Check if list type supports anonymous claim / purchase tracking
 * Registry and Wishlist types (even_better+) have this feature
 * Note: shopping-list does NOT support this feature
 */
export function supportsAnonymousClaim(listType: ListType): boolean {
  return listType === "registry-list" || listType === "registry" || listType === "wishlist";
}

/**
 * Check if user tier supports purchase tracking
 * Even Better+ for Registry/Wishlist list types
 */
export function canUsePurchaseTracking(tier: UserTier | string | undefined): boolean {
  if (!tier) return false;
  return getTierLevel(tier) >= TIER_HIERARCHY.even_better;
}

/**
 * Get complete feature availability for a tier (for UI gating)
 */
export interface TierFeatures {
  maxLists: number;
  maxItemsPerList: number;
  canShare: boolean;
  canUnshare: boolean;
  canInviteGuests: boolean;
  maxGuests: number;
  canImport: boolean;
  canExport: boolean;
  canPrint: boolean;
  exportFormats: string[];
  canHaveTeam: boolean;
  maxTeamAccounts: number;
  availableListTypes: ListType[];
  hasPurchaseTracking: boolean;
}

export function getTierFeatures(tier: UserTier | string | undefined): TierFeatures {
  const t = (tier as UserTier) || "free";
  const limits = getTierLimits(t);
  
  return {
    maxLists: limits.lists,
    maxItemsPerList: limits.itemsPerList,
    canShare: canShareLists(t),
    canUnshare: canUnshareLists(t),
    canInviteGuests: canInviteGuests(t),
    maxGuests: getGuestLimit(t),
    canImport: canImportLists(t),
    canExport: canExportLists(t),
    canPrint: canPrintLists(t),
    exportFormats: getAvailableExportFormats(t),
    canHaveTeam: canHaveTeamMembers(t),
    maxTeamAccounts: getTeamAccountLimit(t),
    availableListTypes: getAvailableListTypes(t),
    hasPurchaseTracking: canUsePurchaseTracking(t),
  };
}

/**
 * Get upgrade message for a specific feature
 */
export function getUpgradeMessage(feature: keyof TierFeatures, currentTier: UserTier | string | undefined): string {
  const tier = (currentTier as UserTier) || "free";
  
  const messages: Record<string, Record<UserTier, string>> = {
    canShare: {
      free: "Upgrade to Good to share lists with others",
      good: "You can share lists!",
      even_better: "You can share lists!",
      lots_more: "You can share lists!",
    },
    canInviteGuests: {
      free: "Upgrade to Even Better to invite guests to edit your lists",
      good: "Upgrade to Even Better to invite guests to edit your lists",
      even_better: "You can invite up to 2 guests per list",
      lots_more: "You can invite unlimited guests",
    },
    canImport: {
      free: "Upgrade to Good to import lists from files",
      good: "You can import lists!",
      even_better: "You can import lists!",
      lots_more: "You can import lists!",
    },
    canExport: {
      free: "Upgrade to Good to export lists (print is always available)",
      good: "You can export to CSV and TXT",
      even_better: "You can export to CSV, TXT, and PDF",
      lots_more: "You can export to CSV, TXT, and PDF",
    },
    canHaveTeam: {
      free: "Upgrade to Lots More for team accounts",
      good: "Upgrade to Lots More for team accounts",
      even_better: "Upgrade to Lots More for team accounts",
      lots_more: "You can have up to 3 team accounts",
    },
    maxLists: {
      free: "Upgrade to Good for up to 50 lists",
      good: "Upgrade to Even Better for up to 100 lists",
      even_better: "Upgrade to Lots More for unlimited lists",
      lots_more: "You have unlimited lists!",
    },
  };
  
  return messages[feature]?.[tier] || "Upgrade to access more features";
}
