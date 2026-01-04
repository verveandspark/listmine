-- Add last edited tracking columns to lists table
ALTER TABLE public.lists 
ADD COLUMN IF NOT EXISTS last_edited_by_user_id UUID REFERENCES public.users(id),
ADD COLUMN IF NOT EXISTS last_edited_by_email TEXT,
ADD COLUMN IF NOT EXISTS last_edited_at TIMESTAMPTZ DEFAULT NOW();

-- Add last edited tracking columns to list_items table
ALTER TABLE public.list_items 
ADD COLUMN IF NOT EXISTS last_edited_by_user_id UUID REFERENCES public.users(id),
ADD COLUMN IF NOT EXISTS last_edited_by_email TEXT,
ADD COLUMN IF NOT EXISTS last_edited_at TIMESTAMPTZ DEFAULT NOW();

-- Create a function to update last_edited info on list update
CREATE OR REPLACE FUNCTION update_list_last_edited()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_edited_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for lists table
DROP TRIGGER IF EXISTS trigger_list_last_edited ON public.lists;
CREATE TRIGGER trigger_list_last_edited
  BEFORE UPDATE ON public.lists
  FOR EACH ROW
  EXECUTE FUNCTION update_list_last_edited();

-- Create trigger for list_items table
DROP TRIGGER IF EXISTS trigger_list_item_last_edited ON public.list_items;
CREATE TRIGGER trigger_list_item_last_edited
  BEFORE UPDATE ON public.list_items
  FOR EACH ROW
  EXECUTE FUNCTION update_list_last_edited();

-- Set initial values for existing records
UPDATE public.lists 
SET last_edited_at = updated_at, 
    last_edited_by_user_id = user_id
WHERE last_edited_at IS NULL;

UPDATE public.list_items 
SET last_edited_at = updated_at
WHERE last_edited_at IS NULL;
