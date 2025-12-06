DROP POLICY IF EXISTS "Users can view their own lists" ON public.lists;
DROP POLICY IF EXISTS "Users can insert their own lists" ON public.lists;
DROP POLICY IF EXISTS "Users can update their own lists" ON public.lists;
DROP POLICY IF EXISTS "Users can delete their own lists" ON public.lists;
DROP POLICY IF EXISTS "Public can view shared lists" ON public.lists;
DROP POLICY IF EXISTS "Guests can access shared lists" ON public.lists;
DROP POLICY IF EXISTS "Guests can update shared lists" ON public.lists;
DROP POLICY IF EXISTS "Team members can access all account lists" ON public.lists;
DROP POLICY IF EXISTS "Team members can manage all account lists" ON public.lists;

DROP POLICY IF EXISTS "Users can view items in their lists" ON public.list_items;
DROP POLICY IF EXISTS "Users can insert items in their lists" ON public.list_items;
DROP POLICY IF EXISTS "Users can update items in their lists" ON public.list_items;
DROP POLICY IF EXISTS "Users can delete items in their lists" ON public.list_items;
DROP POLICY IF EXISTS "Public can view items in shared lists" ON public.list_items;

CREATE OR REPLACE FUNCTION can_access_list(p_list_id UUID, p_user_id UUID DEFAULT NULL, p_check_write BOOLEAN DEFAULT FALSE)
RETURNS BOOLEAN AS $$
DECLARE
  v_list_owner_id UUID;
  v_is_shared BOOLEAN;
  v_share_link TEXT;
  v_guest_permission TEXT;
  v_account_id UUID;
  v_is_team_member BOOLEAN;
BEGIN
  SELECT user_id, is_shared, share_link INTO v_list_owner_id, v_is_shared, v_share_link
  FROM public.lists WHERE id = p_list_id;
  
  IF v_list_owner_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  IF p_user_id IS NOT NULL AND v_list_owner_id = p_user_id THEN
    RETURN TRUE;
  END IF;
  
  IF p_user_id IS NOT NULL THEN
    SELECT permission INTO v_guest_permission
    FROM public.list_guests
    WHERE list_id = p_list_id AND user_id = p_user_id;
    
    IF v_guest_permission IS NOT NULL THEN
      IF p_check_write THEN
        RETURN v_guest_permission = 'edit';
      ELSE
        RETURN TRUE;
      END IF;
    END IF;
  END IF;
  
  IF p_user_id IS NOT NULL THEN
    SELECT a.id INTO v_account_id
    FROM public.accounts a
    WHERE a.owner_id = v_list_owner_id;
    
    IF v_account_id IS NOT NULL THEN
      SELECT EXISTS(
        SELECT 1 FROM public.account_team_members
        WHERE account_id = v_account_id AND user_id = p_user_id
      ) INTO v_is_team_member;
      
      IF v_is_team_member THEN
        RETURN TRUE;
      END IF;
    END IF;
  END IF;
  
  IF NOT p_check_write AND v_is_shared = TRUE AND v_share_link IS NOT NULL THEN
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE POLICY "List access via can_access_list"
ON public.lists FOR SELECT
USING (can_access_list(id, auth.uid(), FALSE));

CREATE POLICY "List owner can insert"
ON public.lists FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "List write access via can_access_list"
ON public.lists FOR UPDATE
USING (can_access_list(id, auth.uid(), TRUE));

CREATE POLICY "List owner can delete"
ON public.lists FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "List items read access"
ON public.list_items FOR SELECT
USING (can_access_list(list_id, auth.uid(), FALSE));

CREATE POLICY "List items insert access"
ON public.list_items FOR INSERT
WITH CHECK (can_access_list(list_id, auth.uid(), TRUE));

CREATE POLICY "List items update access"
ON public.list_items FOR UPDATE
USING (can_access_list(list_id, auth.uid(), TRUE));

CREATE POLICY "List items delete access"
ON public.list_items FOR DELETE
USING (can_access_list(list_id, auth.uid(), TRUE));
