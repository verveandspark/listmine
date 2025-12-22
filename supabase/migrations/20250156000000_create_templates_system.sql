DROP TABLE IF EXISTS public.templates CASCADE;
DROP TABLE IF EXISTS public.template_items CASCADE;

CREATE TABLE public.templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'other',
  list_type TEXT NOT NULL DEFAULT 'custom',
  icon_emoji TEXT DEFAULT '📋',
  is_premium BOOLEAN DEFAULT FALSE,
  item_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE public.template_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES public.templates(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  quantity INTEGER,
  notes TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.user_template_entitlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES public.templates(id) ON DELETE CASCADE,
  redemption_code TEXT,
  redeemed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, template_id)
);

CREATE TABLE IF NOT EXISTS public.template_redemption_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  template_id UUID NOT NULL REFERENCES public.templates(id) ON DELETE CASCADE,
  max_uses INTEGER,
  current_uses INTEGER DEFAULT 0,
  expires_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_template_items_template_id ON public.template_items(template_id);
CREATE INDEX IF NOT EXISTS idx_user_template_entitlements_user_id ON public.user_template_entitlements(user_id);
CREATE INDEX IF NOT EXISTS idx_template_redemption_codes_code ON public.template_redemption_codes(code);

INSERT INTO public.templates (slug, name, description, category, list_type, icon_emoji, is_premium, item_count) VALUES
  ('grocery-complete', 'Grocery Shopping List', 'A comprehensive grocery list with categories for produce, dairy, meat, pantry items, and more.', 'shopping', 'grocery-list', '🛒', FALSE, 10),
  ('recipe-starter', 'Recipe Template', 'Organize your favorite recipes with ingredients, steps, and cooking notes.', 'other', 'custom', '👨‍🍳', FALSE, 7),
  ('vacation-packing', 'Vacation Packing List', 'Never forget essentials again with this complete packing checklist for any trip.', 'travel', 'custom', '🧳', FALSE, 12);

DROP FUNCTION IF EXISTS public.create_list_from_template(UUID, TEXT);
DROP FUNCTION IF EXISTS public.redeem_template_code(TEXT);

CREATE OR REPLACE FUNCTION public.create_list_from_template(
  p_template_id UUID,
  p_list_name TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_new_list_id UUID;
  v_template RECORD;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_template FROM public.templates WHERE id = p_template_id AND is_active = TRUE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Template not found or inactive';
  END IF;

  INSERT INTO public.lists (user_id, title, category, list_type)
  VALUES (v_user_id, p_list_name, v_template.category, v_template.list_type)
  RETURNING id INTO v_new_list_id;

  INSERT INTO public.list_items (list_id, text, quantity, notes, item_order)
  SELECT v_new_list_id, ti.name, ti.quantity, ti.notes, ti.sort_order
  FROM public.template_items ti
  WHERE ti.template_id = p_template_id
  ORDER BY ti.sort_order;

  RETURN v_new_list_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.redeem_template_code(
  p_code TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_redemption RECORD;
  v_template RECORD;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_redemption 
  FROM public.template_redemption_codes 
  WHERE code = UPPER(TRIM(p_code)) 
    AND is_active = TRUE
    AND (expires_at IS NULL OR expires_at > NOW())
    AND (max_uses IS NULL OR current_uses < max_uses);
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Invalid or expired code');
  END IF;

  SELECT * INTO v_template FROM public.templates WHERE id = v_redemption.template_id AND is_active = TRUE;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Template not available');
  END IF;

  IF EXISTS (SELECT 1 FROM public.user_template_entitlements WHERE user_id = v_user_id AND template_id = v_redemption.template_id) THEN
    RETURN json_build_object('success', false, 'error', 'You already have access to this template');
  END IF;

  INSERT INTO public.user_template_entitlements (user_id, template_id, redemption_code)
  VALUES (v_user_id, v_redemption.template_id, v_redemption.code);

  UPDATE public.template_redemption_codes 
  SET current_uses = current_uses + 1 
  WHERE id = v_redemption.id;

  RETURN json_build_object(
    'success', true, 
    'template_name', v_template.name,
    'template_id', v_template.id
  );
END;
$$;

ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.template_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_template_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.template_redemption_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view active templates" ON public.templates;
CREATE POLICY "Anyone can view active templates" ON public.templates FOR SELECT USING (is_active = TRUE);

DROP POLICY IF EXISTS "Anyone can view template items" ON public.template_items;
CREATE POLICY "Anyone can view template items" ON public.template_items FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Users can view own entitlements" ON public.user_template_entitlements;
CREATE POLICY "Users can view own entitlements" ON public.user_template_entitlements FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own entitlements" ON public.user_template_entitlements;
CREATE POLICY "Users can insert own entitlements" ON public.user_template_entitlements FOR INSERT WITH CHECK (auth.uid() = user_id);
