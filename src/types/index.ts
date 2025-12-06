export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
  tier: 'free' | 'good' | 'even_better' | 'lots_more';
  listLimit: number;
  itemsPerListLimit: number;
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

export interface List {
  id: string;
  title: string;
  description?: string;
  category: ListCategory;
  listType: ListType;
  items: ListItem[];
  isPinned: boolean;
  isShared: boolean;
  shareLink?: string;
  tags?: string[];
  collaborators?: string[];
  guests?: ListGuest[];
  createdAt: Date;
  updatedAt: Date;
  showPurchaserInfo?: boolean;
}

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