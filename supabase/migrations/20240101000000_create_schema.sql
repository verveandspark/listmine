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

CREATE INDEX IF NOT EXISTS idx_lists_user_id ON public.lists(user_id);
CREATE INDEX IF NOT EXISTS idx_list_items_list_id ON public.list_items(list_id);

alter publication supabase_realtime add table public.lists;
alter publication supabase_realtime add table public.list_items;
