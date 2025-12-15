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

export type ShareMode = 'view_only' | 'importable';

export interface List {
  id: string;
  userId: string; // Owner's user ID
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
  shareLink?: string;
  shareMode?: ShareMode;
  tags?: string[];
  collaborators?: string[];
  guests?: ListGuest[];
  createdAt: Date;
  updatedAt: Date;
  showPurchaserInfo?: boolean;
}

// Permission helper functions
export const canEditListMeta = (list: List, currentUserId: string | undefined): boolean => {
  if (!currentUserId) return false;
  return list.userId === currentUserId;
};

export const canEditItems = (list: List, currentUserId: string | undefined): boolean => {
  if (!currentUserId) return false;
  // Owner can always edit
  if (list.userId === currentUserId) return true;
  // Guest with edit permission can edit items
  if (list.isGuestAccess && list.guestPermission === 'edit') return true;
  return false;
};

export const canManageSharing = (list: List, currentUserId: string | undefined): boolean => {
  if (!currentUserId) return false;
  return list.userId === currentUserId;
};

export type ListCategory = 'Tasks' | 'Groceries' | 'Ideas' | 'Shopping' | 'Travel' | 'Work' | 'Home' | 'School' | 'Other';

export type ListType = 
  | 'task-list'
  | 'todo-list'
  | 'registry-list'
  | 'checklist'
  | 'grocery-list'
  | 'shopping-list'
  | 'idea-list'
  | 'multi-topic'
  | 'compare-contrast'
  | 'pro-con'
  | 'multi-option'
  | 'custom';

export interface ListTemplate {
  id: string;
  name: string;
  type: ListType;
  description: string;
  isPremium: boolean;
  defaultItems?: Partial<ListItem>[];
}