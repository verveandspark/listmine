DROP POLICY IF EXISTS "Team members can view account" ON public.accounts;
DROP POLICY IF EXISTS "Account owners can view account" ON public.accounts;

CREATE OR REPLACE FUNCTION public.is_team_member_of_account(p_account_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.account_team_members
    WHERE account_id = p_account_id AND user_id = p_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE POLICY "Account owners can view account" ON public.accounts
  FOR SELECT USING (owner_id = auth.uid());

CREATE POLICY "Team members can view account" ON public.accounts
  FOR SELECT USING (
    public.is_team_member_of_account(id, auth.uid())
  );
