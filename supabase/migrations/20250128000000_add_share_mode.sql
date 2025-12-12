-- Add share_mode column to lists table
-- Allows owners to control whether shared links are view-only, importable, or both

ALTER TABLE public.lists 
ADD COLUMN IF NOT EXISTS share_mode TEXT DEFAULT 'view_only' 
CHECK (share_mode IN ('view_only', 'importable', 'both'));

-- Update the get_shared_list_by_share_link function to include share_mode
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
    l.id,
    l.user_id,
    l.title::TEXT,
    l.category::TEXT,
    l.list_type::TEXT,
    l.is_pinned,
    l.is_shared,
    l.share_link::TEXT,
    COALESCE(l.share_mode, 'view_only')::TEXT,
    l.tags,
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
