CREATE TABLE IF NOT EXISTS public.purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID NOT NULL REFERENCES public.lists(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.list_items(id) ON DELETE CASCADE,
  purchaser_name TEXT,
  purchase_note TEXT,
  purchase_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_purchases_list_id ON public.purchases(list_id);
CREATE INDEX IF NOT EXISTS idx_purchases_item_id ON public.purchases(item_id);

alter publication supabase_realtime add table public.purchases;
