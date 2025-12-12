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
