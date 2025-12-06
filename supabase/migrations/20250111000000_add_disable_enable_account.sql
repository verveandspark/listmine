ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_disabled BOOLEAN DEFAULT FALSE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS disabled_reason TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS disabled_at TIMESTAMPTZ;

DROP FUNCTION IF EXISTS disable_user_account(UUID, TEXT);
DROP FUNCTION IF EXISTS enable_user_account(UUID);
DROP FUNCTION IF EXISTS clear_user_data(UUID);
DROP FUNCTION IF EXISTS delete_user_account(UUID);

CREATE OR REPLACE FUNCTION disable_user_account(
  target_user_id UUID,
  reason TEXT DEFAULT 'Admin action'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_admin_id UUID;
  v_is_admin BOOLEAN;
  v_target_email TEXT;
BEGIN
  SELECT auth.uid() INTO v_admin_id;
  
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
  SELECT is_admin INTO v_is_admin FROM users WHERE id = v_admin_id;
  
  IF NOT COALESCE(v_is_admin, FALSE) THEN
    RAISE EXCEPTION 'Not authorized - admin only';
  END IF;
  
  SELECT email INTO v_target_email FROM users WHERE id = target_user_id;
  
  IF v_target_email IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;
  
  UPDATE users 
  SET 
    is_disabled = TRUE,
    disabled_reason = reason,
    disabled_at = NOW(),
    updated_at = NOW()
  WHERE id = target_user_id;
  
  RETURN jsonb_build_object(
    'success', true, 
    'message', 'Account disabled',
    'user_email', v_target_email
  );
END;
$$;

CREATE OR REPLACE FUNCTION enable_user_account(
  target_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_admin_id UUID;
  v_is_admin BOOLEAN;
  v_target_email TEXT;
BEGIN
  SELECT auth.uid() INTO v_admin_id;
  
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
  SELECT is_admin INTO v_is_admin FROM users WHERE id = v_admin_id;
  
  IF NOT COALESCE(v_is_admin, FALSE) THEN
    RAISE EXCEPTION 'Not authorized - admin only';
  END IF;
  
  SELECT email INTO v_target_email FROM users WHERE id = target_user_id;
  
  IF v_target_email IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;
  
  UPDATE users 
  SET 
    is_disabled = FALSE,
    disabled_reason = NULL,
    disabled_at = NULL,
    updated_at = NOW()
  WHERE id = target_user_id;
  
  RETURN jsonb_build_object(
    'success', true, 
    'message', 'Account enabled',
    'user_email', v_target_email
  );
END;
$$;

CREATE OR REPLACE FUNCTION clear_user_data(
  target_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_admin_id UUID;
  v_is_admin BOOLEAN;
  v_lists_deleted INTEGER;
BEGIN
  SELECT auth.uid() INTO v_admin_id;
  
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
  SELECT is_admin INTO v_is_admin FROM users WHERE id = v_admin_id;
  
  IF NOT COALESCE(v_is_admin, FALSE) THEN
    RAISE EXCEPTION 'Not authorized - admin only';
  END IF;
  
  SELECT COUNT(*) INTO v_lists_deleted FROM lists WHERE user_id = target_user_id;
  
  DELETE FROM lists WHERE user_id = target_user_id;
  
  RETURN jsonb_build_object(
    'success', true, 
    'message', 'User data cleared',
    'lists_deleted', v_lists_deleted
  );
END;
$$;

CREATE OR REPLACE FUNCTION delete_user_account(
  target_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_admin_id UUID;
  v_is_admin BOOLEAN;
  v_target_email TEXT;
BEGIN
  SELECT auth.uid() INTO v_admin_id;
  
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
  SELECT is_admin INTO v_is_admin FROM users WHERE id = v_admin_id;
  
  IF NOT COALESCE(v_is_admin, FALSE) THEN
    RAISE EXCEPTION 'Not authorized - admin only';
  END IF;
  
  SELECT email INTO v_target_email FROM users WHERE id = target_user_id;
  
  IF v_target_email IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;
  
  DELETE FROM users WHERE id = target_user_id;
  
  RETURN jsonb_build_object(
    'success', true, 
    'message', 'Account deleted',
    'user_email', v_target_email
  );
END;
$$;
