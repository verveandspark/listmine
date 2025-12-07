DROP POLICY IF EXISTS "List owner can insert" ON public.lists;
DROP POLICY IF EXISTS "Users can insert their own lists" ON public.lists;

CREATE POLICY "List owner can insert" ON public.lists
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id IS NOT NULL 
    AND auth.uid() IS NOT NULL 
    AND user_id = auth.uid()
  );

DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON public.users
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Users can insert own profile" ON public.users
  FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid());

CREATE OR REPLACE FUNCTION public.debug_auth_state()
RETURNS TABLE (
  auth_uid UUID,
  auth_role TEXT,
  auth_email TEXT,
  is_authenticated BOOLEAN
) AS $$
BEGIN
  RETURN QUERY SELECT 
    auth.uid() as auth_uid,
    auth.role() as auth_role,
    auth.email() as auth_email,
    (auth.uid() IS NOT NULL) as is_authenticated;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.debug_auth_state() TO authenticated;
GRANT EXECUTE ON FUNCTION public.debug_auth_state() TO anon;
