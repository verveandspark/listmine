CREATE OR REPLACE FUNCTION public.check_user_exists_by_email(p_email TEXT)
RETURNS TABLE (user_id UUID, user_email TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT u.id, u.email
  FROM public.users u
  WHERE LOWER(u.email) = LOWER(p_email)
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_user_exists_by_email(TEXT) TO authenticated;
