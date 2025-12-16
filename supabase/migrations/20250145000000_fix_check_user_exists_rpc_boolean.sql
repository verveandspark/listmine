DROP FUNCTION IF EXISTS public.check_user_exists_by_email(TEXT);

CREATE OR REPLACE FUNCTION public.check_user_exists_by_email(p_email TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_exists BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1
    FROM public.users u
    WHERE LOWER(u.email) = LOWER(p_email)
  ) INTO user_exists;
  
  RETURN user_exists;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_user_exists_by_email(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_user_exists_by_email(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.check_user_exists_by_email(TEXT) TO service_role;
