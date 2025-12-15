DROP POLICY IF EXISTS "Users can insert items in their own lists" ON public.list_items;
DROP POLICY IF EXISTS "Users can update items in their own lists" ON public.list_items;
DROP POLICY IF EXISTS "Users can delete items from their own lists" ON public.list_items;
DROP POLICY IF EXISTS "Guests can insert items with edit permission" ON public.list_items;
DROP POLICY IF EXISTS "Guests can update items with edit permission" ON public.list_items;
DROP POLICY IF EXISTS "Guests can delete items with edit permission" ON public.list_items;

CREATE OR REPLACE FUNCTION public.can_edit_list_items(p_list_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_list_owner_id UUID;
  v_guest_permission TEXT;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  SELECT user_id INTO v_list_owner_id FROM public.lists WHERE id = p_list_id;
  
  IF v_list_owner_id = v_user_id THEN
    RETURN TRUE;
  END IF;
  
  SELECT permission INTO v_guest_permission 
  FROM public.list_guests 
  WHERE list_id = p_list_id AND user_id = v_user_id;
  
  IF v_guest_permission = 'edit' THEN
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.can_edit_list_items(UUID) TO authenticated;

CREATE POLICY "Users can insert items in their own lists" ON public.list_items
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.lists WHERE id = list_id AND user_id = auth.uid())
  );

CREATE POLICY "Guests can insert items with edit permission" ON public.list_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.list_guests 
      WHERE list_id = list_items.list_id 
        AND user_id = auth.uid() 
        AND permission = 'edit'
    )
  );

CREATE POLICY "Users can update items in their own lists" ON public.list_items
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.lists WHERE id = list_id AND user_id = auth.uid())
  );

CREATE POLICY "Guests can update items with edit permission" ON public.list_items
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.list_guests 
      WHERE list_id = list_items.list_id 
        AND user_id = auth.uid() 
        AND permission = 'edit'
    )
  );

CREATE POLICY "Users can delete items from their own lists" ON public.list_items
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.lists WHERE id = list_id AND user_id = auth.uid())
  );

CREATE POLICY "Guests can delete items with edit permission" ON public.list_items
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.list_guests 
      WHERE list_id = list_items.list_id 
        AND user_id = auth.uid() 
        AND permission = 'edit'
    )
  );

DROP POLICY IF EXISTS "Users can update their own lists" ON public.lists;
DROP POLICY IF EXISTS "Users can delete their own lists" ON public.lists;
DROP POLICY IF EXISTS "Guests cannot update list metadata" ON public.lists;
DROP POLICY IF EXISTS "Guests cannot delete lists" ON public.lists;

CREATE POLICY "Users can update their own lists" ON public.lists
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own lists" ON public.lists
  FOR DELETE USING (user_id = auth.uid());
