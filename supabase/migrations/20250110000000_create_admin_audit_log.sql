CREATE TABLE IF NOT EXISTS admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL,
  target_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  target_user_email TEXT,
  details JSONB DEFAULT '{}',
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_admin_audit_log_admin_id ON admin_audit_log(admin_id);
CREATE INDEX idx_admin_audit_log_target_user_id ON admin_audit_log(target_user_id);
CREATE INDEX idx_admin_audit_log_action_type ON admin_audit_log(action_type);
CREATE INDEX idx_admin_audit_log_created_at ON admin_audit_log(created_at DESC);

ALTER TABLE admin_audit_log DISABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION log_admin_action(
  p_action_type TEXT,
  p_target_user_id UUID DEFAULT NULL,
  p_target_user_email TEXT DEFAULT NULL,
  p_details JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_admin_id UUID;
  v_log_id UUID;
  v_is_admin BOOLEAN;
BEGIN
  SELECT auth.uid() INTO v_admin_id;
  
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
  SELECT is_admin INTO v_is_admin FROM users WHERE id = v_admin_id;
  
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Not authorized - admin only';
  END IF;
  
  INSERT INTO admin_audit_log (admin_id, action_type, target_user_id, target_user_email, details)
  VALUES (v_admin_id, p_action_type, p_target_user_id, p_target_user_email, p_details)
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$;

CREATE OR REPLACE FUNCTION get_admin_audit_logs(
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0,
  p_action_type TEXT DEFAULT NULL,
  p_admin_id UUID DEFAULT NULL,
  p_target_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  admin_id UUID,
  admin_email TEXT,
  admin_name TEXT,
  action_type TEXT,
  target_user_id UUID,
  target_user_email TEXT,
  details JSONB,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_is_admin BOOLEAN;
BEGIN
  SELECT is_admin INTO v_is_admin FROM users WHERE id = auth.uid();
  
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Not authorized - admin only';
  END IF;
  
  RETURN QUERY
  SELECT 
    al.id,
    al.admin_id,
    u.email AS admin_email,
    u.name AS admin_name,
    al.action_type,
    al.target_user_id,
    al.target_user_email,
    al.details,
    al.created_at
  FROM admin_audit_log al
  LEFT JOIN users u ON al.admin_id = u.id
  WHERE 
    (p_action_type IS NULL OR al.action_type = p_action_type)
    AND (p_admin_id IS NULL OR al.admin_id = p_admin_id)
    AND (p_target_user_id IS NULL OR al.target_user_id = p_target_user_id)
  ORDER BY al.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

CREATE OR REPLACE FUNCTION admin_send_password_reset(
  p_user_email TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_admin_id UUID;
  v_is_admin BOOLEAN;
  v_target_user_id UUID;
BEGIN
  SELECT auth.uid() INTO v_admin_id;
  
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
  SELECT is_admin INTO v_is_admin FROM users WHERE id = v_admin_id;
  
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Not authorized - admin only';
  END IF;
  
  SELECT id INTO v_target_user_id FROM users WHERE email = p_user_email;
  
  PERFORM log_admin_action(
    'password_reset_requested',
    v_target_user_id,
    p_user_email,
    jsonb_build_object('initiated_by', 'admin')
  );
  
  RETURN jsonb_build_object('success', true, 'message', 'Password reset initiated');
END;
$$;

CREATE OR REPLACE FUNCTION admin_resend_welcome_email(
  p_user_email TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_admin_id UUID;
  v_is_admin BOOLEAN;
  v_target_user_id UUID;
BEGIN
  SELECT auth.uid() INTO v_admin_id;
  
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
  SELECT is_admin INTO v_is_admin FROM users WHERE id = v_admin_id;
  
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Not authorized - admin only';
  END IF;
  
  SELECT id INTO v_target_user_id FROM users WHERE email = p_user_email;
  
  PERFORM log_admin_action(
    'welcome_email_resent',
    v_target_user_id,
    p_user_email,
    jsonb_build_object('initiated_by', 'admin')
  );
  
  RETURN jsonb_build_object('success', true, 'message', 'Welcome email queued');
END;
$$;
