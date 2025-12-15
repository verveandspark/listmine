CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name TEXT;
BEGIN
  v_name := COALESCE(
    NEW.raw_user_meta_data->>'name',
    SPLIT_PART(NEW.email, '@', 1),
    'User'
  );
  
  INSERT INTO public.users (id, email, name, tier)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    v_name,
    'free'
  )
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name
  WHERE public.users.name = SPLIT_PART(public.users.email, '@', 1)
    OR public.users.name = 'User';
  
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
  v_name TEXT;
  v_raw_meta JSONB;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
  SELECT email, raw_user_meta_data INTO v_email, v_raw_meta 
  FROM auth.users WHERE id = v_user_id;
  
  v_name := COALESCE(
    v_raw_meta->>'name',
    SPLIT_PART(v_email, '@', 1),
    'User'
  );
  
  INSERT INTO public.users (id, email, name, tier)
  VALUES (
    v_user_id,
    COALESCE(v_email, ''),
    v_name,
    'free'
  )
  ON CONFLICT (id) DO NOTHING;
  
  RETURN v_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_user_exists() TO authenticated;

UPDATE public.users pu
SET name = au.raw_user_meta_data->>'name'
FROM auth.users au
WHERE pu.id = au.id
  AND au.raw_user_meta_data->>'name' IS NOT NULL
  AND au.raw_user_meta_data->>'name' != ''
  AND (pu.name = SPLIT_PART(pu.email, '@', 1) OR pu.name = 'User');
