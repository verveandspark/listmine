ALTER TABLE public.users ADD COLUMN IF NOT EXISTS list_limit INTEGER DEFAULT 5;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS items_per_list_limit INTEGER DEFAULT 20;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, name, tier)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'name', SPLIT_PART(NEW.email, '@', 1), 'User'),
    'free'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.ensure_user_exists()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_email TEXT;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
  SELECT email INTO v_email FROM auth.users WHERE id = v_user_id;
  
  INSERT INTO public.users (id, email, name, tier)
  VALUES (
    v_user_id,
    COALESCE(v_email, ''),
    COALESCE(SPLIT_PART(v_email, '@', 1), 'User'),
    'free'
  )
  ON CONFLICT (id) DO NOTHING;
  
  RETURN v_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_user_exists() TO authenticated;

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
  
  INSERT INTO public.lists (user_id, title, category, list_type)
  VALUES (p_user_id, p_title, p_category, p_list_type)
  RETURNING id INTO v_list_id;
  
  RETURN v_list_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_list_for_user(UUID, TEXT, TEXT, TEXT) TO authenticated;
