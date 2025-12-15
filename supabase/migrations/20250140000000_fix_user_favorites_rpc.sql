DROP FUNCTION IF EXISTS public.toggle_user_favorite(UUID);

CREATE OR REPLACE FUNCTION public.toggle_user_favorite(p_list_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id UUID;
  v_exists BOOLEAN;
  v_result JSONB;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated', 'is_favorite', false);
  END IF;
  
  SELECT EXISTS(
    SELECT 1 FROM public.user_favorites 
    WHERE user_id = v_user_id AND list_id = p_list_id
  ) INTO v_exists;
  
  IF v_exists THEN
    DELETE FROM public.user_favorites 
    WHERE user_id = v_user_id AND list_id = p_list_id;
    
    v_result := jsonb_build_object(
      'success', true, 
      'is_favorite', false, 
      'action', 'removed',
      'user_id', v_user_id::text,
      'list_id', p_list_id::text
    );
  ELSE
    INSERT INTO public.user_favorites (user_id, list_id)
    VALUES (v_user_id, p_list_id);
    
    v_result := jsonb_build_object(
      'success', true, 
      'is_favorite', true, 
      'action', 'added',
      'user_id', v_user_id::text,
      'list_id', p_list_id::text
    );
  END IF;
  
  RETURN v_result;
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', SQLERRM, 
      'is_favorite', v_exists,
      'user_id', v_user_id::text,
      'list_id', p_list_id::text
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.toggle_user_favorite(UUID) TO authenticated;

DROP POLICY IF EXISTS "Users can view their own favorites" ON public.user_favorites;
CREATE POLICY "Users can view their own favorites" ON public.user_favorites
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own favorites" ON public.user_favorites;
CREATE POLICY "Users can insert their own favorites" ON public.user_favorites
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own favorites" ON public.user_favorites;
CREATE POLICY "Users can update their own favorites" ON public.user_favorites
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own favorites" ON public.user_favorites;
CREATE POLICY "Users can delete their own favorites" ON public.user_favorites
  FOR DELETE USING (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_favorites TO authenticated;
