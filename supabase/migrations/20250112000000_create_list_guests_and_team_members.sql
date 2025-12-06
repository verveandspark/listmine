CREATE TABLE IF NOT EXISTS public.accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'My Account',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.list_guests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID NOT NULL REFERENCES public.lists(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  permission TEXT NOT NULL DEFAULT 'edit',
  invited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(list_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.account_team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member',
  invited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(account_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_accounts_owner_id ON public.accounts(owner_id);
CREATE INDEX IF NOT EXISTS idx_list_guests_list_id ON public.list_guests(list_id);
CREATE INDEX IF NOT EXISTS idx_list_guests_user_id ON public.list_guests(user_id);
CREATE INDEX IF NOT EXISTS idx_account_team_members_account_id ON public.account_team_members(account_id);
CREATE INDEX IF NOT EXISTS idx_account_team_members_user_id ON public.account_team_members(user_id);

CREATE OR REPLACE FUNCTION get_guest_count_for_list(p_list_id UUID)
RETURNS INTEGER AS $$
BEGIN
  RETURN (SELECT COUNT(*) FROM public.list_guests WHERE list_id = p_list_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_team_member_count_for_account(p_account_id UUID)
RETURNS INTEGER AS $$
BEGIN
  RETURN (SELECT COUNT(*) FROM public.account_team_members WHERE account_id = p_account_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION check_guest_limit()
RETURNS TRIGGER AS $$
DECLARE
  list_owner_id UUID;
  owner_tier TEXT;
  current_guest_count INTEGER;
  max_guests INTEGER;
BEGIN
  SELECT user_id INTO list_owner_id FROM public.lists WHERE id = NEW.list_id;
  SELECT tier INTO owner_tier FROM public.users WHERE id = list_owner_id;
  SELECT COUNT(*) INTO current_guest_count FROM public.list_guests WHERE list_id = NEW.list_id;
  
  IF owner_tier = 'free' THEN
    RAISE EXCEPTION 'Free tier users cannot invite guests';
  ELSIF owner_tier = 'good' THEN
    RAISE EXCEPTION 'Good tier users cannot invite guests to edit';
  ELSIF owner_tier = 'even_better' THEN
    max_guests := 2;
    IF current_guest_count >= max_guests THEN
      RAISE EXCEPTION 'Even Better tier users can only invite up to 2 guests per list';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS enforce_guest_limit ON public.list_guests;
CREATE TRIGGER enforce_guest_limit
  BEFORE INSERT ON public.list_guests
  FOR EACH ROW
  EXECUTE FUNCTION check_guest_limit();

CREATE OR REPLACE FUNCTION check_team_member_access()
RETURNS TRIGGER AS $$
DECLARE
  account_owner_id UUID;
  owner_tier TEXT;
BEGIN
  SELECT owner_id INTO account_owner_id FROM public.accounts WHERE id = NEW.account_id;
  SELECT tier INTO owner_tier FROM public.users WHERE id = account_owner_id;
  
  IF owner_tier != 'lots_more' THEN
    RAISE EXCEPTION 'Only Lots More tier users can have team members';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS enforce_team_member_access ON public.account_team_members;
CREATE TRIGGER enforce_team_member_access
  BEFORE INSERT ON public.account_team_members
  FOR EACH ROW
  EXECUTE FUNCTION check_team_member_access();

DROP POLICY IF EXISTS "Users can view their own account" ON public.accounts;
CREATE POLICY "Users can view their own account" ON public.accounts
  FOR SELECT USING (owner_id = auth.uid());

DROP POLICY IF EXISTS "Users can create their own account" ON public.accounts;
CREATE POLICY "Users can create their own account" ON public.accounts
  FOR INSERT WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own account" ON public.accounts;
CREATE POLICY "Users can update their own account" ON public.accounts
  FOR UPDATE USING (owner_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete their own account" ON public.accounts;
CREATE POLICY "Users can delete their own account" ON public.accounts
  FOR DELETE USING (owner_id = auth.uid());

DROP POLICY IF EXISTS "Team members can view account" ON public.accounts;
CREATE POLICY "Team members can view account" ON public.accounts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.account_team_members 
      WHERE account_id = id AND user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "List owners can manage guests" ON public.list_guests;
CREATE POLICY "List owners can manage guests" ON public.list_guests
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.lists 
      WHERE id = list_id AND user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Guests can view their own guest records" ON public.list_guests;
CREATE POLICY "Guests can view their own guest records" ON public.list_guests
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Account owners can manage team members" ON public.account_team_members;
CREATE POLICY "Account owners can manage team members" ON public.account_team_members
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.accounts 
      WHERE id = account_id AND owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Team members can view their own membership" ON public.account_team_members;
CREATE POLICY "Team members can view their own membership" ON public.account_team_members
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Managers can manage team members" ON public.account_team_members;
CREATE POLICY "Managers can manage team members" ON public.account_team_members
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.account_team_members atm
      JOIN public.accounts a ON a.id = atm.account_id
      WHERE atm.account_id = account_id 
        AND atm.user_id = auth.uid() 
        AND atm.role IN ('manager', 'billing_admin')
    )
  );

DROP POLICY IF EXISTS "Guests can access shared lists" ON public.lists;
CREATE POLICY "Guests can access shared lists" ON public.lists
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.list_guests 
      WHERE list_id = id AND user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Guests can update shared lists" ON public.lists;
CREATE POLICY "Guests can update shared lists" ON public.lists
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.list_guests 
      WHERE list_id = id AND user_id = auth.uid() AND permission = 'edit'
    )
  );

DROP POLICY IF EXISTS "Team members can access all account lists" ON public.lists;
CREATE POLICY "Team members can access all account lists" ON public.lists
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.account_team_members atm
      JOIN public.accounts a ON a.id = atm.account_id
      WHERE a.owner_id = user_id AND atm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Team members can manage all account lists" ON public.lists;
CREATE POLICY "Team members can manage all account lists" ON public.lists
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.account_team_members atm
      JOIN public.accounts a ON a.id = atm.account_id
      WHERE a.owner_id = user_id AND atm.user_id = auth.uid()
    )
  );

ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.list_guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_team_members ENABLE ROW LEVEL SECURITY;

ALTER PUBLICATION supabase_realtime ADD TABLE public.list_guests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.account_team_members;
