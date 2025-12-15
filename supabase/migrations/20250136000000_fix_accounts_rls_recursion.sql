CREATE OR REPLACE FUNCTION public.can_access_account(p_account_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_owner_id UUID;
BEGIN
  SELECT owner_id INTO v_owner_id
  FROM public.accounts
  WHERE id = p_account_id;
  
  IF v_owner_id = p_user_id THEN
    RETURN TRUE;
  END IF;
  
  RETURN EXISTS (
    SELECT 1 FROM public.account_team_members
    WHERE account_id = p_account_id AND user_id = p_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_account_owner(p_account_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.accounts
    WHERE id = p_account_id AND owner_id = p_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.get_user_account_id(p_user_id UUID)
RETURNS UUID AS $$
DECLARE
  v_account_id UUID;
BEGIN
  SELECT id INTO v_account_id
  FROM public.accounts
  WHERE owner_id = p_user_id
  LIMIT 1;
  
  RETURN v_account_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_team_member_of_account(p_account_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.account_team_members
    WHERE account_id = p_account_id AND user_id = p_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_team_manager(p_account_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.account_team_members
    WHERE account_id = p_account_id 
      AND user_id = p_user_id 
      AND role IN ('manager', 'billing_admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

DROP POLICY IF EXISTS "Team members can view account" ON public.accounts;
CREATE POLICY "Team members can view account" ON public.accounts
  FOR SELECT USING (
    public.is_team_member_of_account(id, auth.uid())
  );

DROP POLICY IF EXISTS "Account owners can manage team members" ON public.account_team_members;
CREATE POLICY "Account owners can manage team members" ON public.account_team_members
  FOR ALL USING (
    public.is_account_owner(account_id, auth.uid())
  );

DROP POLICY IF EXISTS "Managers can manage team members" ON public.account_team_members;
CREATE POLICY "Managers can manage team members" ON public.account_team_members
  FOR ALL USING (
    public.is_team_manager(account_id, auth.uid())
  );
