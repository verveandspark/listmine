DROP POLICY IF EXISTS "Users can view guest users on shared lists" ON public.users;
CREATE POLICY "Users can view guest users on shared lists" ON public.users
  FOR SELECT
  TO authenticated
  USING (
    id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM public.list_guests lg
      JOIN public.lists l ON lg.list_id = l.id
      WHERE lg.user_id = users.id
        AND (l.user_id = auth.uid() OR EXISTS (
          SELECT 1 FROM public.list_guests lg2 WHERE lg2.list_id = l.id AND lg2.user_id = auth.uid()
        ))
    )
  );

DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
CREATE POLICY "Users can view own profile" ON public.users
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());
