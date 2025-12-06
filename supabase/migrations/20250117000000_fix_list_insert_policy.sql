DROP POLICY IF EXISTS "List owner can insert" ON public.lists;

CREATE POLICY "List owner can insert" ON public.lists
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());
