ALTER TABLE public.lists ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_lists_is_favorite ON public.lists(is_favorite);
