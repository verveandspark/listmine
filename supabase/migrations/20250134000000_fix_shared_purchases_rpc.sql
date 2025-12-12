-- Fix get_shared_list_purchases RPC to match actual purchases table schema

DROP FUNCTION IF EXISTS get_shared_list_purchases(UUID);

CREATE OR REPLACE FUNCTION get_shared_list_purchases(p_list_id UUID)
RETURNS TABLE (
  id UUID,
  list_id UUID,
  item_id UUID,
  purchaser_name TEXT,
  purchase_note TEXT,
  purchase_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ
) AS $$
DECLARE
  v_is_shared BOOLEAN;
BEGIN
  SELECT is_shared INTO v_is_shared
  FROM public.lists
  WHERE lists.id = p_list_id;

  IF NOT v_is_shared THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT 
    p.id,
    p.list_id,
    p.item_id,
    p.purchaser_name,
    p.purchase_note,
    p.purchase_date,
    p.created_at
  FROM public.purchases p
  WHERE p.list_id = p_list_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION get_shared_list_purchases(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_shared_list_purchases(UUID) TO anon;
