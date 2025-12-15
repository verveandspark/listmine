CREATE TABLE IF NOT EXISTS public.user_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  list_id UUID NOT NULL REFERENCES public.lists(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, list_id)
);

CREATE INDEX IF NOT EXISTS idx_user_favorites_user_id ON public.user_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_user_favorites_list_id ON public.user_favorites(list_id);

ALTER TABLE public.user_favorites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own favorites" ON public.user_favorites;
CREATE POLICY "Users can view their own favorites" ON public.user_favorites
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own favorites" ON public.user_favorites;
CREATE POLICY "Users can insert their own favorites" ON public.user_favorites
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own favorites" ON public.user_favorites;
CREATE POLICY "Users can delete their own favorites" ON public.user_favorites
  FOR DELETE USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.toggle_user_favorite(p_list_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_exists BOOLEAN;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
  SELECT EXISTS(
    SELECT 1 FROM public.user_favorites 
    WHERE user_id = v_user_id AND list_id = p_list_id
  ) INTO v_exists;
  
  IF v_exists THEN
    DELETE FROM public.user_favorites 
    WHERE user_id = v_user_id AND list_id = p_list_id;
    RETURN FALSE;
  ELSE
    INSERT INTO public.user_favorites (user_id, list_id)
    VALUES (v_user_id, p_list_id);
    RETURN TRUE;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.toggle_user_favorite(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_user_favorite_list_ids()
RETURNS SETOF UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT list_id FROM public.user_favorites WHERE user_id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_favorite_list_ids() TO authenticated;
