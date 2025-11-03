-- Enable RLS on lists and list_items tables
ALTER TABLE public.lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.list_items ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own lists" ON public.lists;
DROP POLICY IF EXISTS "Users can insert their own lists" ON public.lists;
DROP POLICY IF EXISTS "Users can update their own lists" ON public.lists;
DROP POLICY IF EXISTS "Users can delete their own lists" ON public.lists;
DROP POLICY IF EXISTS "Public can view shared lists" ON public.lists;

DROP POLICY IF EXISTS "Users can view items in their lists" ON public.list_items;
DROP POLICY IF EXISTS "Users can insert items in their lists" ON public.list_items;
DROP POLICY IF EXISTS "Users can update items in their lists" ON public.list_items;
DROP POLICY IF EXISTS "Users can delete items in their lists" ON public.list_items;
DROP POLICY IF EXISTS "Public can view items in shared lists" ON public.list_items;

-- Lists policies
CREATE POLICY "Users can view their own lists"
ON public.lists FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own lists"
ON public.lists FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own lists"
ON public.lists FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own lists"
ON public.lists FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "Public can view shared lists"
ON public.lists FOR SELECT
USING (is_shared = true AND share_link IS NOT NULL);

-- List items policies
CREATE POLICY "Users can view items in their lists"
ON public.list_items FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.lists
    WHERE lists.id = list_items.list_id
    AND lists.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert items in their lists"
ON public.list_items FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.lists
    WHERE lists.id = list_items.list_id
    AND lists.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update items in their lists"
ON public.list_items FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.lists
    WHERE lists.id = list_items.list_id
    AND lists.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete items in their lists"
ON public.list_items FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.lists
    WHERE lists.id = list_items.list_id
    AND lists.user_id = auth.uid()
  )
);

CREATE POLICY "Public can view items in shared lists"
ON public.list_items FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.lists
    WHERE lists.id = list_items.list_id
    AND lists.is_shared = true
    AND lists.share_link IS NOT NULL
  )
);
