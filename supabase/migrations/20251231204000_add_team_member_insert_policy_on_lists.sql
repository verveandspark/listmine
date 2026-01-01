-- Add RLS policy to allow team members to insert lists for their team accounts
CREATE POLICY "Allow team members to insert lists"
ON public.lists
FOR INSERT
TO authenticated
WITH CHECK (
  (account_id IS NULL AND user_id = auth.uid())
  OR (
    account_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM account_team_members
      WHERE account_id = lists.account_id
        AND user_id = auth.uid()
    )
  )
);
