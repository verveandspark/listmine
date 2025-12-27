DROP FUNCTION IF EXISTS public.create_list_from_template(UUID, TEXT);

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

  INSERT INTO public.list_items (list_id, text, quantity, notes, item_order, attributes)
  SELECT 
    v_new_list_id, 
    ti.name, 
    ti.quantity, 
    ti.notes, 
    ti.sort_order,
    CASE 
      WHEN v_template.list_type IN ('grocery-list', 'grocery') AND ti.section IS NOT NULL THEN 
        jsonb_build_object('category', ti.section)
      WHEN ti.section IS NOT NULL THEN 
        jsonb_build_object('section', ti.section)
      ELSE '{}'::jsonb
    END
  FROM public.template_items ti
  WHERE ti.template_id = p_template_id
  ORDER BY ti.sort_order;

  RETURN v_new_list_id;
END;
$$;

ALTER TABLE public.template_items DROP COLUMN IF EXISTS category;
