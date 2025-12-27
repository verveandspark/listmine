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
  v_category TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_template FROM public.templates WHERE id = p_template_id AND is_active = TRUE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Template not found or inactive';
  END IF;

  v_category := CASE p_template_id
    WHEN '50f56f69-d7c9-45df-b947-ed0b66bdb489'::uuid THEN 'Shopping'
    WHEN 'c36205e1-7359-4fa3-8a32-3922ea774793'::uuid THEN 'Shopping'
    WHEN '8164267e-e193-4958-ae54-60a369679b63'::uuid THEN 'Planning'
    WHEN '25934caa-e884-4719-9d73-2022fa39967a'::uuid THEN 'Planning'
    WHEN '17befa2f-0848-4914-8a8a-c0b135402b7d'::uuid THEN 'Household'
    WHEN 'f6f942d1-7467-4d98-b2bf-dcbce6b597d6'::uuid THEN 'Household'
    WHEN '7633ef82-46b4-4cfe-92cf-093398655df3'::uuid THEN 'Meals'
    WHEN 'adc6101d-53b2-4267-a84c-5351600f8cbc'::uuid THEN 'Meals'
    WHEN '3959695e-dc23-4419-ba05-db605f7fcbf6'::uuid THEN 'Meals'
    WHEN '3acd1af8-cc6f-4bdb-8e1f-24bf738b4ab2'::uuid THEN 'Tasks'
    WHEN '4b3e5470-d36d-427d-89b3-d31def98b801'::uuid THEN 'Tasks'
    WHEN '6fbe31f9-1e95-462c-b7fa-2abfc3726193'::uuid THEN 'Other'
    ELSE COALESCE(v_template.category, 'Other')
  END;

  INSERT INTO public.lists (user_id, title, category, list_type, source, template_id)
  VALUES (v_user_id, p_list_name, v_category, v_template.list_type, 'template', p_template_id)
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
