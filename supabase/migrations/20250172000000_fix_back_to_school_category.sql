-- Update Back to School template category to School
UPDATE public.templates
SET category = 'School'
WHERE slug = 'back-to-school-checklist';
