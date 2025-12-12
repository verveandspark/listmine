DROP FUNCTION IF EXISTS get_shared_list_items(UUID);

CREATE OR REPLACE FUNCTION get_shared_list_items(p_list_id UUID)
RETURNS TABLE (
  id UUID,
  list_id UUID,
  text TEXT,
  quantity INTEGER,
  priority TEXT,
  due_date TIMESTAMPTZ,
  notes TEXT,
  assigned_to TEXT,
  links TEXT[],
  completed BOOLEAN,
  item_order INTEGER,
  attributes JSONB,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
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
    li.text,
    li.quantity,
    li.priority,
    li.due_date,
    li.notes,
    li.assigned_to,
    li.links,
    li.completed,
    li.item_order,
    li.attributes,
    li.created_at,
    li.updated_at
  FROM public.list_items li
  WHERE li.list_id = p_list_id
  ORDER BY li.item_order ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION get_shared_list_items(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_shared_list_items(UUID) TO anon;
