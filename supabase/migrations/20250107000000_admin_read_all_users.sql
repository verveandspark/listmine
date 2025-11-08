DROP POLICY IF EXISTS "Admins can read all users" ON public.users;

CREATE POLICY "Admins can read all users"
ON public.users FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'admin'
  )
);
