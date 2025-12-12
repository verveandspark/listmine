DROP FUNCTION IF EXISTS get_shared_list_items(UUID);

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
    li.text::TEXT as name,
    NULL::TEXT as description,
    li.completed as is_completed,
    li.priority::TEXT,
    li.due_date::DATE,
    li.notes::TEXT,
    NULL::TEXT as link,
    NULL::TEXT as price,
    li.quantity,
    li.item_order,
    li.created_at,
    li.updated_at,
    NULL::TEXT as image_url
  FROM public.list_items li
  WHERE li.list_id = p_list_id
  ORDER BY li.item_order ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION get_shared_list_items(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_shared_list_items(UUID) TO anon;
