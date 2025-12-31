INSERT INTO public.templates (id, slug, name, description, category, list_type, icon_emoji, is_premium, item_count, is_active)
VALUES 
  ('50f56f69-d7c9-45df-b947-ed0b66bdb489', 'baby-registry', 'Baby Registry', 'Track baby essentials with organized sections for Nursery, Feeding, Diapering, Clothing, Bath & Care, and more.', 'Shopping', 'registry-list', '👶', FALSE, 20, TRUE),
  ('c36205e1-7359-4fa3-8a32-3922ea774793', 'wedding-registry', 'Wedding Registry', 'Create your wedding gift registry with sections for Kitchen, Bedroom, Bathroom, Living Room, and more.', 'Shopping', 'registry-list', '💍', FALSE, 20, TRUE)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  list_type = EXCLUDED.list_type,
  icon_emoji = EXCLUDED.icon_emoji,
  item_count = EXCLUDED.item_count,
  is_active = EXCLUDED.is_active;

INSERT INTO public.template_items (template_id, name, section, sort_order)
SELECT t.id, item.name, item.section, item.sort_order
FROM public.templates t
CROSS JOIN LATERAL (VALUES
  ('Crib', 'Nursery', 1),
  ('Crib mattress', 'Nursery', 2),
  ('Crib sheets (2-3 sets)', 'Nursery', 3),
  ('Changing table', 'Nursery', 4),
  ('Dresser', 'Nursery', 5),
  ('Bottles (6-8)', 'Feeding', 6),
  ('Bottle brush', 'Feeding', 7),
  ('Nursing pillow', 'Feeding', 8),
  ('High chair', 'Feeding', 9),
  ('Bibs', 'Feeding', 10),
  ('Diapers (newborn & size 1)', 'Diapering', 11),
  ('Wipes', 'Diapering', 12),
  ('Diaper pail', 'Diapering', 13),
  ('Changing pad', 'Diapering', 14),
  ('Onesies (0-3 months)', 'Clothing', 15),
  ('Sleepers (0-3 months)', 'Clothing', 16),
  ('Baby towels', 'Bath & Care', 17),
  ('Baby shampoo & wash', 'Bath & Care', 18),
  ('Stroller', 'Gear', 19),
  ('Car seat', 'Gear', 20)
) AS item(name, section, sort_order)
WHERE t.id = '50f56f69-d7c9-45df-b947-ed0b66bdb489'
AND NOT EXISTS (SELECT 1 FROM public.template_items WHERE template_id = t.id);

INSERT INTO public.template_items (template_id, name, section, sort_order)
SELECT t.id, item.name, item.section, item.sort_order
FROM public.templates t
CROSS JOIN LATERAL (VALUES
  ('Dinnerware set', 'Kitchen', 1),
  ('Glassware set', 'Kitchen', 2),
  ('Flatware set', 'Kitchen', 3),
  ('Pots & pans set', 'Kitchen', 4),
  ('Knife set', 'Kitchen', 5),
  ('Mixing bowls', 'Kitchen', 6),
  ('Sheet set (Queen)', 'Bedroom', 7),
  ('Duvet cover set', 'Bedroom', 8),
  ('Pillows', 'Bedroom', 9),
  ('Bath towel set', 'Bathroom', 10),
  ('Hand towel set', 'Bathroom', 11),
  ('Shower curtain', 'Bathroom', 12),
  ('Couch', 'Living Room', 13),
  ('Coffee table', 'Living Room', 14),
  ('Table lamps', 'Living Room', 15),
  ('Area rug', 'Living Room', 16),
  ('TV stand', 'Living Room', 17),
  ('Picture frames', 'Decor', 18),
  ('Throw pillows', 'Decor', 19),
  ('Vases', 'Decor', 20)
) AS item(name, section, sort_order)
WHERE t.id = 'c36205e1-7359-4fa3-8a32-3922ea774793'
AND NOT EXISTS (SELECT 1 FROM public.template_items WHERE template_id = t.id);
