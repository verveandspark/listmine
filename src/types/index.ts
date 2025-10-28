export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
  tier: 'free' | 'good' | 'even-better' | 'lots-more';
  listLimit: number;
  itemsPerListLimit: number;
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
  // New attributes
  attributes?: {
    color?: string;
    size?: string;
    weight?: string;
    price?: number;
    custom?: Record<string, string>;
  };
  links?: string[];
  assignedTo?: string;
}

export interface List {
  id: string;
  title: string;
  category: string;
  listType: ListType;
  items: ListItem[];
  isPinned: boolean;
  createdAt: Date;
  updatedAt: Date;
  // New features
  shareLink?: string;
  isShared: boolean;
  collaborators?: string[];
  tags?: string[];
  reminders?: boolean;
}

export type ListCategory = 'Tasks' | 'Groceries' | 'Ideas' | 'Shopping' | 'Travel' | 'Work' | 'Home' | 'Other';

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