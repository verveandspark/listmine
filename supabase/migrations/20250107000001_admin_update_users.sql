DROP POLICY IF EXISTS "Admins can update all users" ON public.users;

CREATE POLICY "Admins can update all users"
ON public.users FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'admin'
  )
);
