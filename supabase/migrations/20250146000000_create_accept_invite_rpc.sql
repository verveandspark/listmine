-- Create accept_invite RPC function (SECURITY DEFINER)
-- This function accepts both guest and team invites by ID

CREATE OR REPLACE FUNCTION accept_invite(
  p_invite_type TEXT,
  p_invite_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_user_email TEXT;
  v_invite_record RECORD;
  v_result JSONB;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Get user email
  SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;
  IF v_user_email IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User email not found');
  END IF;

  IF p_invite_type = 'guest' THEN
    -- Handle guest (list) invite
    SELECT * INTO v_invite_record
    FROM pending_list_invites
    WHERE id = p_invite_id
      AND status = 'pending'
      AND expires_at > NOW();

    IF v_invite_record IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invite not found, expired, or already accepted');
    END IF;

    -- Verify email matches
    IF LOWER(v_invite_record.guest_email) != LOWER(v_user_email) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Email mismatch - this invite was sent to a different email address');
    END IF;

    -- Add user as guest to the list
    INSERT INTO list_guests (list_id, user_id, permission)
    VALUES (v_invite_record.list_id, v_user_id, v_invite_record.permission)
    ON CONFLICT (list_id, user_id) DO UPDATE SET permission = EXCLUDED.permission;

    -- Mark invite as accepted
    UPDATE pending_list_invites
    SET status = 'accepted'
    WHERE id = p_invite_id;

    RETURN jsonb_build_object(
      'success', true,
      'type', 'guest',
      'list_id', v_invite_record.list_id,
      'redirect', '/list/' || v_invite_record.list_id::TEXT
    );

  ELSIF p_invite_type = 'team' THEN
    -- Handle team invite
    SELECT * INTO v_invite_record
    FROM pending_team_invites
    WHERE id = p_invite_id
      AND status = 'pending'
      AND expires_at > NOW();

    IF v_invite_record IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invite not found, expired, or already accepted');
    END IF;

    -- Verify email matches
    IF LOWER(v_invite_record.guest_email) != LOWER(v_user_email) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Email mismatch - this invite was sent to a different email address');
    END IF;

    -- Add user as team member
    INSERT INTO account_team_members (account_id, user_id, role)
    VALUES (v_invite_record.account_id, v_user_id, v_invite_record.role)
    ON CONFLICT (account_id, user_id) DO UPDATE SET role = EXCLUDED.role;

    -- Mark invite as accepted
    UPDATE pending_team_invites
    SET status = 'accepted'
    WHERE id = p_invite_id;

    RETURN jsonb_build_object(
      'success', true,
      'type', 'team',
      'account_id', v_invite_record.account_id,
      'redirect', '/dashboard'
    );

  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Invalid invite type');
  END IF;
END;
$$;

-- Create function to get invite details (for showing info before accepting)
CREATE OR REPLACE FUNCTION get_invite_details(
  p_invite_type TEXT,
  p_invite_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite_record RECORD;
  v_inviter_name TEXT;
  v_target_name TEXT;
BEGIN
  IF p_invite_type = 'guest' THEN
    SELECT pli.*, l.title as list_title, u.name as inviter_name, u.email as inviter_email
    INTO v_invite_record
    FROM pending_list_invites pli
    JOIN lists l ON l.id = pli.list_id
    JOIN users u ON u.id = pli.inviter_id
    WHERE pli.id = p_invite_id;

    IF v_invite_record IS NULL THEN
      RETURN jsonb_build_object('found', false, 'error', 'Invite not found');
    END IF;

    RETURN jsonb_build_object(
      'found', true,
      'type', 'guest',
      'email', v_invite_record.guest_email,
      'status', v_invite_record.status,
      'expired', v_invite_record.expires_at < NOW(),
      'inviter_name', COALESCE(v_invite_record.inviter_name, v_invite_record.inviter_email),
      'target_name', v_invite_record.list_title,
      'permission', v_invite_record.permission
    );

  ELSIF p_invite_type = 'team' THEN
    SELECT pti.*, a.name as account_name, u.name as inviter_name, u.email as inviter_email
    INTO v_invite_record
    FROM pending_team_invites pti
    JOIN accounts a ON a.id = pti.account_id
    JOIN users u ON u.id = pti.inviter_id
    WHERE pti.id = p_invite_id;

    IF v_invite_record IS NULL THEN
      RETURN jsonb_build_object('found', false, 'error', 'Invite not found');
    END IF;

    RETURN jsonb_build_object(
      'found', true,
      'type', 'team',
      'email', v_invite_record.guest_email,
      'status', v_invite_record.status,
      'expired', v_invite_record.expires_at < NOW(),
      'inviter_name', COALESCE(v_invite_record.inviter_name, v_invite_record.inviter_email),
      'target_name', v_invite_record.account_name,
      'role', v_invite_record.role
    );

  ELSE
    RETURN jsonb_build_object('found', false, 'error', 'Invalid invite type');
  END IF;
END;
$$;
