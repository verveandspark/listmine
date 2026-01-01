DROP FUNCTION IF EXISTS public.upsert_user_profile(uuid, text, text, text, integer, integer);

CREATE OR REPLACE FUNCTION public.upsert_user_profile(
  p_id uuid,
  p_email text,
  p_name text,
  p_tier text,
  p_list_limit integer,
  p_items_per_list_limit integer
)
RETURNS public.users
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  existing public.users%ROWTYPE;
BEGIN
  IF p_id <> auth.uid() THEN
    RAISE EXCEPTION 'Cannot upsert profile for another user';
  END IF;

  SELECT *
  INTO existing
  FROM public.users u
  WHERE u.id = p_id;

  IF FOUND THEN
    UPDATE public.users u
    SET
      email = COALESCE(p_email, u.email),
      name = COALESCE(p_name, u.name),
      tier = COALESCE(p_tier, u.tier),
      list_limit = COALESCE(p_list_limit, u.list_limit),
      items_per_list_limit = COALESCE(p_items_per_list_limit, u.items_per_list_limit),
      updated_at = NOW()
    WHERE u.id = p_id
    RETURNING * INTO existing;

    RETURN existing;
  ELSE
    INSERT INTO public.users (id, email, name, tier, list_limit, items_per_list_limit)
    VALUES (p_id, p_email, p_name, p_tier, p_list_limit, p_items_per_list_limit)
    RETURNING * INTO existing;

    RETURN existing;
  END IF;
END;
$$;
