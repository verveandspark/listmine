-- Migration: Allow team members to see other team members' user info
-- 
-- ISSUE: The RLS policy on users table only allows users to see their own profile (id = auth.uid()).
-- When fetching team members with a join to users, the join returns null for other users' info.
-- This causes "Unknown User" to be displayed in the Manage Team modal.
--
-- FIX: Add an RLS policy that allows authenticated users to see the email and name
-- of other users who are members of the same team account.

-- Policy: Team members can see other team members' user info
DROP POLICY IF EXISTS "Team members can see each other" ON public.users;

CREATE POLICY "Team members can see each other" ON public.users
  FOR SELECT
  TO authenticated
  USING (
    -- User can see their own profile
    id = auth.uid()
    OR
    -- User can see profiles of users who are in the same team account
    EXISTS (
      SELECT 1 
      FROM public.account_team_members my_membership
      JOIN public.account_team_members their_membership 
        ON my_membership.account_id = their_membership.account_id
      WHERE my_membership.user_id = auth.uid()
        AND their_membership.user_id = users.id
    )
    OR
    -- Account owners can see profiles of their team members
    EXISTS (
      SELECT 1
      FROM public.accounts a
      JOIN public.account_team_members atm ON atm.account_id = a.id
      WHERE a.owner_id = auth.uid()
        AND atm.user_id = users.id
    )
    OR
    -- Team members can see the account owner's profile
    EXISTS (
      SELECT 1
      FROM public.accounts a
      JOIN public.account_team_members atm ON atm.account_id = a.id
      WHERE atm.user_id = auth.uid()
        AND a.owner_id = users.id
    )
  );

-- Also allow list guests to see list owner info (for shared list context)
DROP POLICY IF EXISTS "Guests can see list owner info" ON public.users;

CREATE POLICY "Guests can see list owner info" ON public.users
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.list_guests lg
      JOIN public.lists l ON l.id = lg.list_id
      WHERE lg.user_id = auth.uid()
        AND l.user_id = users.id
    )
  );

-- Allow list owners to see their guests' info
DROP POLICY IF EXISTS "List owners can see guest info" ON public.users;

CREATE POLICY "List owners can see guest info" ON public.users
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.lists l
      JOIN public.list_guests lg ON lg.list_id = l.id
      WHERE l.user_id = auth.uid()
        AND lg.user_id = users.id
    )
  );
