ALTER TABLE public.users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user';

CREATE TABLE IF NOT EXISTS public.tier_change_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  admin_email TEXT NOT NULL,
  old_tier TEXT NOT NULL,
  new_tier TEXT NOT NULL,
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tier_change_logs_user_id ON public.tier_change_logs(user_id);

alter publication supabase_realtime add table public.tier_change_logs;
