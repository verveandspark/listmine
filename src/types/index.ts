export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
  tier: 'free' | 'good' | 'even_better' | 'lots_more';
  listLimit: number;
  itemsPerListLimit: number;
  avatarUrl?: string;
}

export interface Account {
  id: string;
  ownerId: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ListGuest {
  id: string;
  listId: string;
  userId: string;
  permission: 'view' | 'edit';
  invitedAt: Date;
  user?: User;
}

export interface TeamMember {
  id: string;
  accountId: string;
  userId: string;
  role: 'member' | 'manager' | 'billing_admin';
  invitedAt: Date;
  user?: User;
}

export interface ListItemAttributes {
  color?: string;
  size?: string;
  weight?: string;
  price?: number;
  category?: string;
  unit?: string;
  quantity?: number;
  priority?: string;
  status?: string;
  purchaseStatus?: string;
  quantityNeeded?: number;
  productLink?: string;
  inspirationLink?: string;
  linkTitle?: string;
  linkImage?: string;
  linkDescription?: string;
  customLinkTitle?: string;
  customLinkDescription?: string;
  customLinkImage?: string;
  custom?: Record<string, string>;
  [key: string]: any;
}

export interface ListItem {
  id: string;
  text: string;
  quantity?: number;
  priority?: 'low' | 'medium' | 'high';
  dueDate?: Date;
  notes?: string;
  completed: boolean;
  order: number;
  attributes?: ListItemAttributes;
  links?: string[];
  assignedTo?: string;
}

export type ShareMode = 'view_only' | 'importable' | 'registry_buyer';

export interface List {
  id: string;
  userId: string; // Owner's user ID (for team lists, this is the team owner)
  accountId?: string | null; // Optional account ID for team lists. NULL means personal list.
  accountOwnerId?: string | null; // The owner_id of the account (for team lists)
  title: string;
  description?: string;
  category: ListCategory;
  listType: ListType;
  items: ListItem[];
  isPinned: boolean;
  isFavorite: boolean;
  isShared: boolean;
  isArchived?: boolean;
  isGuestAccess?: boolean;
  guestPermission?: 'view' | 'edit'; // Current user's guest permission (if guest)
  isTeamMember?: boolean; // True if current user is a team member (not owner) of the team that owns this list
  isTeamOwner?: boolean; // True if current user is the owner of the team account that owns this list
  shareLink?: string;
  shareMode?: ShareMode;
  tags?: string[];
  collaborators?: string[];
  guests?: ListGuest[];
  createdAt: Date;
  updatedAt: Date;
  showPurchaserInfo?: boolean;
  source?: 'standard' | 'template';
  templateId?: string | null;
  lastEditedByUserId?: string | null;
  lastEditedByEmail?: string | null;
  lastEditedAt?: Date | null;
}

// Permission helper functions
export const canEditListMeta = (list: List, currentUserId: string | undefined): boolean => {
  if (!currentUserId) return false;
  // Owner can always edit list metadata
  if (list.userId === currentUserId) return true;
  // Team owner can always edit team list metadata
  if (list.accountId && list.isTeamOwner) return true;
  // Team members can edit list metadata on team-owned lists
  if (list.accountId && list.isTeamMember) return true;
  return false;
};

export const canEditItems = (list: List, currentUserId: string | undefined): boolean => {
  if (!currentUserId) return false;
  // Owner can always edit
  if (list.userId === currentUserId) return true;
  // Team owner can always edit team list items
  if (list.accountId && list.isTeamOwner) return true;
  // Guest with edit permission can edit items
  if (list.isGuestAccess && list.guestPermission === 'edit') return true;
  // Team members can edit items on team-owned lists
  if (list.accountId && list.isTeamMember) return true;
  return false;
};

export const canManageSharing = (list: List, currentUserId: string | undefined): boolean => {
  if (!currentUserId) return false;
  // List owner can manage sharing
  if (list.userId === currentUserId) return true;
  // Team owner can manage sharing for team lists
  if (list.accountId && list.isTeamOwner) return true;
  return false;
};

export type ListCategory = 'Tasks' | 'Shopping' | 'Meals' | 'Household' | 'Planning' | 'Other' | 'School' | 'Work';

export type ListType = 
  | 'task-list'
  | 'todo-list'
  | 'todo'
  | 'registry-list'
  | 'registry'
  | 'checklist'
  | 'grocery-list'
  | 'grocery'
  | 'shopping-list'
  | 'idea-list'
  | 'idea'
  | 'multi-topic'
  | 'compare-contrast'
  | 'pro-con'
  | 'multi-option'
  | 'wishlist'
  | 'custom';

export interface ListTemplate {
  id: string;
  name: string;
  type: ListType;
  description: string;
  isPremium: boolean;
  defaultItems?: Partial<ListItem>[];
}