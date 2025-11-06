# Current List Creation Setup Documentation
**Generated:** 2025-01-XX  
**Purpose:** Document existing list structure before rebuilding with new attributes

---

## 1. Current List Type Options

### Available List Types (from `src/types/index.ts`)
```typescript
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
```

**Note:** Currently, the CreateListModal hardcodes `listType` to `'custom'` and does NOT expose a dropdown for users to select list types.

---

## 2. Current Category Options

### Available Categories (from `CreateListModal.tsx`)
```typescript
const categories: ListCategory[] = [
  "Tasks",
  "Groceries",
  "Ideas",
  "Travel",
  "Other"
];
```

### Full Category Type Definition
```typescript
export type ListCategory = 
  | 'Tasks' 
  | 'Groceries' 
  | 'Ideas' 
  | 'Shopping' 
  | 'Travel' 
  | 'Work' 
  | 'Home' 
  | 'Other';
```

**Note:** Modal only shows 5 categories, but type definition includes 8 options.

---

## 3. Current List Structure

### List Interface (from `src/types/index.ts`)
```typescript
export interface List {
  id: string;
  title: string;
  category: string;
  listType: ListType;
  items: ListItem[];
  isPinned: boolean;
  createdAt: Date;
  updatedAt: Date;
  // Sharing features
  shareLink?: string;
  isShared: boolean;
  collaborators?: string[];
  tags?: string[];
  reminders?: boolean;
}
```

---

## 4. Current List Item Structure

### ListItem Interface (from `src/types/index.ts`)
```typescript
export interface ListItem {
  id: string;
  text: string;
  quantity?: number;
  priority?: 'low' | 'medium' | 'high';
  dueDate?: Date;
  notes?: string;
  completed: boolean;
  order: number;
  // Extended attributes
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
```

---

## 5. Current Database Schema

### Users Table
```sql
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  tier TEXT NOT NULL DEFAULT 'free',
  list_limit INTEGER NOT NULL DEFAULT 50,
  items_per_list_limit INTEGER NOT NULL DEFAULT 150,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Lists Table
```sql
CREATE TABLE IF NOT EXISTS public.lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  list_type TEXT NOT NULL DEFAULT 'custom',
  is_pinned BOOLEAN DEFAULT FALSE,
  is_shared BOOLEAN DEFAULT FALSE,
  share_link TEXT,
  tags TEXT[] DEFAULT '{}',
  collaborators TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### List Items Table
```sql
CREATE TABLE IF NOT EXISTS public.list_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID NOT NULL REFERENCES public.lists(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  quantity INTEGER,
  priority TEXT,
  due_date TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  assigned_to TEXT,
  links TEXT[] DEFAULT '{}',
  completed BOOLEAN DEFAULT FALSE,
  item_order INTEGER NOT NULL DEFAULT 0,
  attributes JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Indexes
```sql
CREATE INDEX IF NOT EXISTS idx_lists_user_id ON public.lists(user_id);
CREATE INDEX IF NOT EXISTS idx_list_items_list_id ON public.list_items(list_id);
```

### Realtime Subscriptions
```sql
alter publication supabase_realtime add table public.lists;
alter publication supabase_realtime add table public.list_items;
```

---

## 6. Current Create List Flow

### CreateListModal Behavior
1. User opens modal
2. User enters **List Name** (required)
3. User selects **Category** from dropdown (defaults to "Tasks")
4. **List Type** is automatically set to `'custom'` (not user-selectable)
5. On submit:
   - Calls `addList(listName, category, 'custom')`
   - Returns new list ID
   - Navigates to `/list/{newListId}`
   - Closes modal

### Current Fields in Modal
- **List Name** (Input field, required)
- **Category** (Dropdown, 5 options)
- **List Type** (Hidden, hardcoded to 'custom')

---

## 7. User Tier System

### Tier Limits (from `src/types/index.ts`)
```typescript
export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
  tier: 'free' | 'good' | 'even-better' | 'lots-more';
  listLimit: number;
  itemsPerListLimit: number;
}
```

**Default Limits:**
- `list_limit`: 50 lists
- `items_per_list_limit`: 150 items per list

---

## 8. Existing Functionality to Preserve

### Core Features
✅ List creation with name and category  
✅ List type assignment (currently hardcoded)  
✅ Navigation to new list after creation  
✅ Category dropdown selection  
✅ Input validation (name required)  
✅ Loading states during creation  
✅ Error handling and display  

### List Features
✅ Pinning lists  
✅ Sharing lists (share links)  
✅ Collaborators support  
✅ Tags support  
✅ Reminders flag  

### List Item Features
✅ Text content  
✅ Quantity tracking  
✅ Priority levels (low/medium/high)  
✅ Due dates  
✅ Notes  
✅ Completion status  
✅ Item ordering  
✅ Custom attributes (JSONB)  
✅ Multiple links per item  
✅ Assignment to users  

### Database Features
✅ Cascade deletion (user → lists → items)  
✅ Realtime subscriptions  
✅ Proper indexing  
✅ Timestamp tracking (created_at, updated_at)  

---

## 9. Known Gaps/Issues

### UI Gaps
- ❌ List type dropdown not exposed to users
- ❌ Only 5 of 8 categories shown in modal
- ❌ No template selection during creation
- ❌ No default items for list types

### Type System Gaps
- ⚠️ 12 list types defined but not utilized
- ⚠️ `ListTemplate` interface defined but not implemented
- ⚠️ `attributes.custom` allows arbitrary data (no validation)

---

## 10. Next Steps for Rebuild

### Recommended Approach
1. **Add List Type Dropdown** to CreateListModal
2. **Expose all 8 categories** in dropdown
3. **Create type-specific attribute schemas** for each list type
4. **Add template system** with default items
5. **Update database schema** if needed for new attributes
6. **Preserve all existing functionality** listed in Section 8

### Files to Modify
- `src/components/list/CreateListModal.tsx` - Add list type dropdown
- `src/types/index.ts` - Define type-specific attribute schemas
- `src/contexts/ListContext.tsx` - Update addList logic
- Database migrations - Add any new columns/constraints

---

**End of Documentation**
