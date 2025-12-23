ALTER TABLE public.template_items ADD COLUMN IF NOT EXISTS section TEXT;

DELETE FROM public.template_items;

INSERT INTO public.template_items (template_id, name, quantity, section, sort_order) 
SELECT t.id, item.name, item.quantity, item.section, item.sort_order
FROM public.templates t
CROSS JOIN LATERAL (VALUES
  ('Apples', 6, 'Fruit', 1),
  ('Bananas', 6, 'Fruit', 2),
  ('Oranges', 4, 'Fruit', 3),
  ('Milk', 1, 'Dairy', 4),
  ('Eggs', 12, 'Dairy', 5),
  ('Butter', 1, 'Dairy', 6),
  ('Cheese', 1, 'Dairy', 7),
  ('Chicken breast', 2, 'Meat', 8),
  ('Ground beef', 1, 'Meat', 9),
  ('Bread', 1, 'Bakery', 10),
  ('Lettuce', 1, 'Produce', 11),
  ('Tomatoes', 4, 'Produce', 12),
  ('Onions', 3, 'Produce', 13),
  ('Rice', 1, 'Pantry', 14),
  ('Pasta', 2, 'Pantry', 15)
) AS item(name, quantity, section, sort_order)
WHERE t.slug = 'grocery-complete';

INSERT INTO public.template_items (template_id, name, notes, section, sort_order) 
SELECT t.id, item.name, item.notes, item.section, item.sort_order
FROM public.templates t
CROSS JOIN LATERAL (VALUES
  ('Recipe Name', 'Enter your recipe title', 'Basics', 1),
  ('Prep Time', 'e.g., 15 minutes', 'Basics', 2),
  ('Cook Time', 'e.g., 30 minutes', 'Basics', 3),
  ('Servings', 'e.g., 4 servings', 'Basics', 4),
  ('Ingredient 1', 'List ingredient with quantity', 'Ingredients', 5),
  ('Ingredient 2', 'List ingredient with quantity', 'Ingredients', 6),
  ('Ingredient 3', 'List ingredient with quantity', 'Ingredients', 7),
  ('Step 1', 'First cooking instruction', 'Instructions', 8),
  ('Step 2', 'Second cooking instruction', 'Instructions', 9),
  ('Step 3', 'Third cooking instruction', 'Instructions', 10),
  ('Tips', 'Cooking tips and variations', 'Notes', 11),
  ('Storage', 'How to store leftovers', 'Notes', 12)
) AS item(name, notes, section, sort_order)
WHERE t.slug = 'recipe-starter';

INSERT INTO public.template_items (template_id, name, section, sort_order) 
SELECT t.id, item.name, item.section, item.sort_order
FROM public.templates t
CROSS JOIN LATERAL (VALUES
  ('Passport', 'Documents', 1),
  ('ID/Driver''s License', 'Documents', 2),
  ('Travel insurance docs', 'Documents', 3),
  ('Flight/hotel confirmations', 'Documents', 4),
  ('Credit cards', 'Financials', 5),
  ('Cash (local currency)', 'Financials', 6),
  ('Phone charger', 'Electronics', 7),
  ('Power adapter', 'Electronics', 8),
  ('Camera', 'Electronics', 9),
  ('Headphones', 'Electronics', 10),
  ('Toiletries bag', 'Toiletries', 11),
  ('Toothbrush/toothpaste', 'Toiletries', 12),
  ('Sunscreen', 'Toiletries', 13),
  ('Medications', 'Toiletries', 14),
  ('T-shirts', 'Clothing', 15),
  ('Pants/shorts', 'Clothing', 16),
  ('Underwear', 'Clothing', 17),
  ('Socks', 'Clothing', 18),
  ('Jacket', 'Clothing', 19),
  ('Swimsuit', 'Clothing', 20),
  ('Sunglasses', 'Accessories', 21),
  ('Hat', 'Accessories', 22),
  ('Watch', 'Accessories', 23)
) AS item(name, section, sort_order)
WHERE t.slug = 'vacation-packing';

UPDATE public.templates SET item_count = 15 WHERE slug = 'grocery-complete';
UPDATE public.templates SET item_count = 12 WHERE slug = 'recipe-starter';
UPDATE public.templates SET item_count = 23 WHERE slug = 'vacation-packing';

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
      WHEN ti.section IS NOT NULL THEN jsonb_build_object('section', ti.section)
      ELSE '{}'::jsonb
    END
  FROM public.template_items ti
  WHERE ti.template_id = p_template_id
  ORDER BY ti.sort_order;

  RETURN v_new_list_id;
END;
$$;
