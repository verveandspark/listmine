DROP POLICY IF EXISTS "Managers can manage team members" ON public.account_team_members;

DROP POLICY IF EXISTS "Team members can access all account lists" ON public.lists;

DROP POLICY IF EXISTS "Team members can manage all account lists" ON public.lists;
