DROP POLICY IF EXISTS "List owner can insert" ON public.lists;
DROP POLICY IF EXISTS "Users can insert their own lists" ON public.lists;

CREATE POLICY "List owner can insert" ON public.lists
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.create_list_for_user(
  p_user_id UUID,
  p_title TEXT,
  p_category TEXT,
  p_list_type TEXT DEFAULT 'standard'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_list_id UUID;
  v_auth_uid UUID;
BEGIN
  v_auth_uid := auth.uid();
  
  IF v_auth_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
  IF p_user_id != v_auth_uid THEN
    RAISE EXCEPTION 'Cannot create list for another user';
  END IF;
  
  INSERT INTO public.lists (user_id, title, category, list_type)
  VALUES (p_user_id, p_title, p_category, p_list_type)
  RETURNING id INTO v_list_id;
  
  RETURN v_list_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_list_for_user(UUID, TEXT, TEXT, TEXT) TO authenticated;
