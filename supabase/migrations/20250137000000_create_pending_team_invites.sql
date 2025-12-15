CREATE TABLE IF NOT EXISTS pending_team_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  inviter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  guest_email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'manager', 'billing_admin')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired')),
  invited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
  UNIQUE(account_id, guest_email)
);

CREATE INDEX idx_pending_team_invites_email ON pending_team_invites(guest_email);
CREATE INDEX idx_pending_team_invites_status ON pending_team_invites(status);
CREATE INDEX idx_pending_team_invites_account ON pending_team_invites(account_id);

ALTER TABLE pending_team_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Account owners can view pending team invites"
  ON pending_team_invites
  FOR SELECT
  USING (
    inviter_id = auth.uid()
  );

CREATE POLICY "Account owners can create pending team invites"
  ON pending_team_invites
  FOR INSERT
  WITH CHECK (
    inviter_id = auth.uid()
  );

CREATE POLICY "Account owners can update pending team invites"
  ON pending_team_invites
  FOR UPDATE
  USING (
    inviter_id = auth.uid()
  );

CREATE POLICY "Account owners can delete pending team invites"
  ON pending_team_invites
  FOR DELETE
  USING (
    inviter_id = auth.uid()
  );

CREATE OR REPLACE FUNCTION accept_pending_team_invites()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO account_team_members (account_id, user_id, role)
  SELECT 
    account_id,
    NEW.id,
    role
  FROM pending_team_invites
  WHERE guest_email = NEW.email
    AND status = 'pending'
    AND expires_at > NOW()
  ON CONFLICT (account_id, user_id) DO NOTHING;

  UPDATE pending_team_invites
  SET status = 'accepted'
  WHERE guest_email = NEW.email
    AND status = 'pending';

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_user_signup_accept_team_invites ON users;
CREATE TRIGGER on_user_signup_accept_team_invites
  AFTER INSERT ON users
  FOR EACH ROW
  EXECUTE FUNCTION accept_pending_team_invites();
