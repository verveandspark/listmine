DROP POLICY IF EXISTS "Allow guest purchases on shared lists" ON public.purchases;
CREATE POLICY "Allow guest purchases on shared lists"
ON public.purchases FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.lists
    WHERE lists.id = purchases.list_id
    AND lists.is_shared = true
  )
);

DROP POLICY IF EXISTS "Allow viewing purchases on shared lists" ON public.purchases;
CREATE POLICY "Allow viewing purchases on shared lists"
ON public.purchases FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.lists
    WHERE lists.id = purchases.list_id
    AND lists.is_shared = true
  )
);

DROP POLICY IF EXISTS "Allow owners to view their list purchases" ON public.purchases;
CREATE POLICY "Allow owners to view their list purchases"
ON public.purchases FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.lists
    WHERE lists.id = purchases.list_id
    AND lists.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Allow owners to delete purchases" ON public.purchases;
CREATE POLICY "Allow owners to delete purchases"
ON public.purchases FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.lists
    WHERE lists.id = purchases.list_id
    AND lists.user_id = auth.uid()
  )
);
