INSERT INTO public.template_items (template_id, name, quantity, sort_order) 
SELECT t.id, item.name, item.quantity, item.sort_order
FROM public.templates t
CROSS JOIN LATERAL (VALUES
  ('Milk', 1, 1),
  ('Eggs', 12, 2),
  ('Bread', 1, 3),
  ('Butter', 1, 4),
  ('Chicken breast', 2, 5),
  ('Apples', 6, 6),
  ('Bananas', 6, 7),
  ('Lettuce', 1, 8),
  ('Tomatoes', 4, 9),
  ('Onions', 3, 10)
) AS item(name, quantity, sort_order)
WHERE t.slug = 'grocery-complete'
AND NOT EXISTS (SELECT 1 FROM public.template_items WHERE template_id = t.id);

INSERT INTO public.template_items (template_id, name, notes, sort_order) 
SELECT t.id, item.name, item.notes, item.sort_order
FROM public.templates t
CROSS JOIN LATERAL (VALUES
  ('Recipe Name', 'Enter your recipe title', 1),
  ('Prep Time', 'e.g., 15 minutes', 2),
  ('Cook Time', 'e.g., 30 minutes', 3),
  ('Servings', 'e.g., 4 servings', 4),
  ('Ingredients', 'List all ingredients with quantities', 5),
  ('Instructions', 'Step-by-step cooking instructions', 6),
  ('Notes', 'Tips, variations, or storage instructions', 7)
) AS item(name, notes, sort_order)
WHERE t.slug = 'recipe-starter'
AND NOT EXISTS (SELECT 1 FROM public.template_items WHERE template_id = t.id);

INSERT INTO public.template_items (template_id, name, sort_order) 
SELECT t.id, item.name, item.sort_order
FROM public.templates t
CROSS JOIN LATERAL (VALUES
  ('Passport', 1),
  ('Phone charger', 2),
  ('Toiletries bag', 3),
  ('Medications', 4),
  ('Underwear (7 days)', 5),
  ('Socks (7 pairs)', 6),
  ('T-shirts', 7),
  ('Pants/shorts', 8),
  ('Sunglasses', 9),
  ('Sunscreen', 10),
  ('Travel adapter', 11),
  ('Headphones', 12)
) AS item(name, sort_order)
WHERE t.slug = 'vacation-packing'
AND NOT EXISTS (SELECT 1 FROM public.template_items WHERE template_id = t.id);
