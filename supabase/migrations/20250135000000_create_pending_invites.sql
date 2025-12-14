-- Create pending_list_invites table
CREATE TABLE IF NOT EXISTS pending_list_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  inviter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  guest_email TEXT NOT NULL,
  permission TEXT NOT NULL DEFAULT 'edit' CHECK (permission IN ('view', 'edit')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired')),
  invited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
  UNIQUE(list_id, guest_email)
);

-- Create index for faster lookups
CREATE INDEX idx_pending_invites_email ON pending_list_invites(guest_email);
CREATE INDEX idx_pending_invites_status ON pending_list_invites(status);

-- Enable RLS
ALTER TABLE pending_list_invites ENABLE ROW LEVEL SECURITY;

-- Policy: List owners can view their pending invites
CREATE POLICY "List owners can view pending invites"
  ON pending_list_invites
  FOR SELECT
  USING (
    inviter_id = auth.uid()
  );

-- Policy: List owners can create pending invites
CREATE POLICY "List owners can create pending invites"
  ON pending_list_invites
  FOR INSERT
  WITH CHECK (
    inviter_id = auth.uid()
  );

-- Policy: List owners can delete their pending invites
CREATE POLICY "List owners can delete pending invites"
  ON pending_list_invites
  FOR DELETE
  USING (
    inviter_id = auth.uid()
  );

-- Function to auto-accept pending invites on user signup
CREATE OR REPLACE FUNCTION accept_pending_invites()
RETURNS TRIGGER AS $$
BEGIN
  -- Find all pending invites for this email
  INSERT INTO list_guests (list_id, user_id, permission)
  SELECT 
    list_id,
    NEW.id,
    permission
  FROM pending_list_invites
  WHERE guest_email = NEW.email
    AND status = 'pending'
    AND expires_at > NOW()
  ON CONFLICT (list_id, user_id) DO NOTHING;

  -- Mark invites as accepted
  UPDATE pending_list_invites
  SET status = 'accepted'
  WHERE guest_email = NEW.email
    AND status = 'pending';

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-accept invites when user signs up
CREATE TRIGGER on_user_signup_accept_invites
  AFTER INSERT ON users
  FOR EACH ROW
  EXECUTE FUNCTION accept_pending_invites();
