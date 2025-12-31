ALTER TABLE public.lists DROP CONSTRAINT IF EXISTS lists_share_mode_check;

ALTER TABLE public.lists 
ADD CONSTRAINT lists_share_mode_check 
CHECK (share_mode IN ('view_only', 'importable', 'both', 'registry_buyer'));

UPDATE public.lists
SET share_mode = 'registry_buyer'
WHERE is_shared = TRUE
  AND list_type IN ('registry-list', 'wishlist')
  AND (share_mode = 'view_only' OR share_mode IS NULL);

DROP FUNCTION IF EXISTS get_shared_list_by_share_link(TEXT);

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
  share_mode TEXT,
  tags TEXT[],
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  show_purchaser_info BOOLEAN,
  is_archived BOOLEAN,
  is_favorite BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    l.id::UUID,
    l.user_id::UUID,
    l.title::TEXT,
    l.category::TEXT,
    l.list_type::TEXT,
    l.is_pinned::BOOLEAN,
    l.is_shared::BOOLEAN,
    l.share_link::TEXT,
    COALESCE(l.share_mode, 'view_only')::TEXT,
    l.tags::TEXT[],
    l.created_at::TIMESTAMPTZ,
    l.updated_at::TIMESTAMPTZ,
    l.show_purchaser_info::BOOLEAN,
    l.is_archived::BOOLEAN,
    l.is_favorite::BOOLEAN
  FROM public.lists l
  WHERE (
    l.share_link = p_share_link
    OR l.share_link LIKE '%/shared/' || p_share_link
    OR l.share_link LIKE '%/' || p_share_link
    OR SUBSTRING(l.share_link FROM '/shared/([^/]+)$') = p_share_link
    OR SUBSTRING(l.share_link FROM '/([^/]+)$') = p_share_link
  )
  AND l.is_shared = TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION get_shared_list_by_share_link(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_shared_list_by_share_link(TEXT) TO anon;
