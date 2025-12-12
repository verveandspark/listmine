DROP POLICY IF EXISTS "List access via can_access_list" ON public.lists;
DROP POLICY IF EXISTS "Public can view shared lists" ON public.lists;
DROP POLICY IF EXISTS "List write access via can_access_list" ON public.lists;
DROP POLICY IF EXISTS "List items read access" ON public.list_items;
DROP POLICY IF EXISTS "List items insert access" ON public.list_items;
DROP POLICY IF EXISTS "List items update access" ON public.list_items;
DROP POLICY IF EXISTS "List items delete access" ON public.list_items;
DROP POLICY IF EXISTS "Public can view items in shared lists" ON public.list_items;

DROP FUNCTION IF EXISTS can_access_list(UUID, UUID, BOOLEAN);

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

CREATE POLICY "List write access via can_access_list"
ON public.lists FOR UPDATE
USING (can_access_list(id, auth.uid(), TRUE));

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

CREATE OR REPLACE FUNCTION get_shared_list_by_share_link(p_share_link TEXT)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  title TEXT,
  category TEXT,
  list_type TEXT,
  is_pinned BOOLEAN,
  is_shared BOOLEAN,
  share_link TEXT,
  tags TEXT[],
  collaborators TEXT[],
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  show_purchaser_info BOOLEAN,
  is_archived BOOLEAN,
  is_favorite BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    l.id,
    l.user_id,
    l.title,
    l.category,
    l.list_type,
    l.is_pinned,
    l.is_shared,
    l.share_link,
    l.tags,
    l.collaborators,
    l.created_at,
    l.updated_at,
    l.show_purchaser_info,
    l.is_archived,
    l.is_favorite
  FROM public.lists l
  WHERE l.share_link = p_share_link
    AND l.is_shared = TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION get_shared_list_by_share_link(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_shared_list_by_share_link(TEXT) TO anon;

CREATE OR REPLACE FUNCTION get_shared_list_items(p_list_id UUID)
RETURNS TABLE (
  id UUID,
  list_id UUID,
  name TEXT,
  description TEXT,
  is_completed BOOLEAN,
  priority TEXT,
  due_date DATE,
  notes TEXT,
  link TEXT,
  price TEXT,
  quantity INTEGER,
  item_order INTEGER,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  image_url TEXT
) AS $$
DECLARE
  v_is_shared BOOLEAN;
BEGIN
  SELECT l.is_shared INTO v_is_shared
  FROM public.lists l
  WHERE l.id = p_list_id;
  
  IF v_is_shared IS NOT TRUE THEN
    RETURN;
  END IF;
  
  RETURN QUERY
  SELECT 
    li.id,
    li.list_id,
    li.name,
    li.description,
    li.is_completed,
    li.priority,
    li.due_date,
    li.notes,
    li.link,
    li.price,
    li.quantity,
    li.item_order,
    li.created_at,
    li.updated_at,
    li.image_url
  FROM public.list_items li
  WHERE li.list_id = p_list_id
  ORDER BY li.item_order ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION get_shared_list_items(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_shared_list_items(UUID) TO anon;

CREATE OR REPLACE FUNCTION get_shared_list_purchases(p_list_id UUID)
RETURNS TABLE (
  id UUID,
  list_id UUID,
  item_id UUID,
  purchaser_name TEXT,
  purchaser_email TEXT,
  quantity INTEGER,
  created_at TIMESTAMPTZ
) AS $$
DECLARE
  v_is_shared BOOLEAN;
BEGIN
  SELECT l.is_shared INTO v_is_shared
  FROM public.lists l
  WHERE l.id = p_list_id;
  
  IF v_is_shared IS NOT TRUE THEN
    RETURN;
  END IF;
  
  RETURN QUERY
  SELECT 
    p.id,
    p.list_id,
    p.item_id,
    p.purchaser_name,
    p.purchaser_email,
    p.quantity,
    p.created_at
  FROM public.purchases p
  WHERE p.list_id = p_list_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION get_shared_list_purchases(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_shared_list_purchases(UUID) TO anon;
