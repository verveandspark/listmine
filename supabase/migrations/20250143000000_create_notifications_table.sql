CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_unread ON notifications(user_id, is_read) WHERE is_read = FALSE;

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notifications"
  ON notifications
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can update their own notifications"
  ON notifications
  FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "System can insert notifications"
  ON notifications
  FOR INSERT
  WITH CHECK (TRUE);

CREATE OR REPLACE FUNCTION notify_team_member_joined()
RETURNS TRIGGER AS $$
DECLARE
  new_member_email TEXT;
  new_member_name TEXT;
  account_name TEXT;
  inviter_id UUID;
BEGIN
  SELECT email, name INTO new_member_email, new_member_name
  FROM users WHERE id = NEW.user_id;

  SELECT a.name, pti.inviter_id INTO account_name, inviter_id
  FROM accounts a
  LEFT JOIN pending_team_invites pti ON pti.account_id = a.id AND pti.guest_email = new_member_email AND pti.status = 'accepted'
  WHERE a.id = NEW.account_id
  LIMIT 1;

  IF inviter_id IS NOT NULL THEN
    INSERT INTO notifications (user_id, type, title, message, data)
    VALUES (
      inviter_id,
      'team_member_joined',
      'New Team Member Joined',
      COALESCE(new_member_name, new_member_email) || ' has joined your team "' || COALESCE(account_name, 'Team') || '"',
      jsonb_build_object(
        'member_id', NEW.user_id,
        'member_email', new_member_email,
        'member_name', new_member_name,
        'account_id', NEW.account_id,
        'account_name', account_name
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_team_member_added_notify ON account_team_members;
CREATE TRIGGER on_team_member_added_notify
  AFTER INSERT ON account_team_members
  FOR EACH ROW
  EXECUTE FUNCTION notify_team_member_joined();
