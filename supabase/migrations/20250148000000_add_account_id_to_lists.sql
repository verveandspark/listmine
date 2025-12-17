ALTER TABLE public.lists ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_lists_account_id ON public.lists(account_id);

COMMENT ON COLUMN public.lists.account_id IS 'Optional account ID for team lists. NULL means personal list owned by user_id.';
