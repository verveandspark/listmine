DROP FUNCTION IF EXISTS public.create_list_for_user(UUID, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.create_list_for_user(
  p_user_id UUID,
  p_title TEXT,
  p_category TEXT,
  p_list_type TEXT DEFAULT 'standard',
  p_account_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_list_id UUID;
  v_auth_uid UUID;
  v_email TEXT;
BEGIN
  v_auth_uid := auth.uid();
  
  IF v_auth_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
  IF p_user_id != v_auth_uid THEN
    RAISE EXCEPTION 'Cannot create list for another user';
  END IF;
  
  SELECT email INTO v_email FROM auth.users WHERE id = v_auth_uid;
  
  INSERT INTO public.users (id, email, name, tier)
  VALUES (
    v_auth_uid,
    COALESCE(v_email, ''),
    COALESCE(SPLIT_PART(v_email, '@', 1), 'User'),
    'free'
  )
  ON CONFLICT (id) DO NOTHING;
  
  INSERT INTO public.lists (user_id, title, category, list_type, account_id)
  VALUES (p_user_id, p_title, p_category, p_list_type, p_account_id)
  RETURNING id INTO v_list_id;
  
  RETURN v_list_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_list_for_user(UUID, TEXT, TEXT, TEXT, UUID) TO authenticated;
