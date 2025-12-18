CREATE OR REPLACE FUNCTION update_user_tier(p_user_id UUID, p_new_tier TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_is_admin BOOLEAN;
  v_valid_tiers TEXT[] := ARRAY['free', 'premium', 'professional', 'enterprise'];
BEGIN
  SELECT is_admin INTO v_caller_is_admin
  FROM users
  WHERE id = auth.uid();
  
  IF NOT COALESCE(v_caller_is_admin, FALSE) THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required to update user tiers';
  END IF;
  
  IF NOT (p_new_tier = ANY(v_valid_tiers)) THEN
    RAISE EXCEPTION 'Invalid tier: %. Valid tiers are: free, premium, professional, enterprise', p_new_tier;
  END IF;
  
  UPDATE users
  SET tier = p_new_tier, updated_at = NOW()
  WHERE id = p_user_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found with ID: %', p_user_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION update_user_tier(UUID, TEXT) TO authenticated;
