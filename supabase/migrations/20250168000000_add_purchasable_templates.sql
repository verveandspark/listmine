ALTER TABLE public.templates ADD COLUMN IF NOT EXISTS tier_required TEXT DEFAULT NULL;

INSERT INTO public.templates (id, slug, name, description, category, list_type, icon_emoji, is_premium, item_count, is_active, tier_required)
VALUES 
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567801', 'spring-cleaning-checklist', 'Spring Cleaning Checklist', 'Deep clean your entire home', 'Household', 'custom', '🧹', TRUE, 18, TRUE, 'good'),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567802', 'job-search-tracker', 'Job Search Tracker', 'Track job applications and interviews', 'Work', 'custom', '💼', TRUE, 14, TRUE, 'good'),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567803', 'wedding-planning-master-checklist', 'Wedding Planning Master Checklist', 'Complete wedding planning timeline', 'Planning', 'custom', '💒', TRUE, 26, TRUE, 'good'),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567804', 'fitness-workout-tracker', 'Fitness & Workout Tracker', 'Track your fitness goals and workouts', 'Other', 'custom', '🏋️', TRUE, 17, TRUE, 'good')
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  list_type = EXCLUDED.list_type,
  icon_emoji = EXCLUDED.icon_emoji,
  is_premium = EXCLUDED.is_premium,
  item_count = EXCLUDED.item_count,
  is_active = EXCLUDED.is_active,
  tier_required = EXCLUDED.tier_required;

DELETE FROM public.template_items WHERE template_id IN (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567801',
  'a1b2c3d4-e5f6-7890-abcd-ef1234567802',
  'a1b2c3d4-e5f6-7890-abcd-ef1234567803',
  'a1b2c3d4-e5f6-7890-abcd-ef1234567804'
);

INSERT INTO public.template_items (template_id, name, section, sort_order) VALUES
('a1b2c3d4-e5f6-7890-abcd-ef1234567801', 'Clean refrigerator', 'KITCHEN', 1),
('a1b2c3d4-e5f6-7890-abcd-ef1234567801', 'Clean oven', 'KITCHEN', 2),
('a1b2c3d4-e5f6-7890-abcd-ef1234567801', 'Organize pantry', 'KITCHEN', 3),
('a1b2c3d4-e5f6-7890-abcd-ef1234567801', 'Wipe down cabinets', 'KITCHEN', 4),
('a1b2c3d4-e5f6-7890-abcd-ef1234567801', 'Vacuum under furniture', 'LIVING ROOM', 5),
('a1b2c3d4-e5f6-7890-abcd-ef1234567801', 'Wash windows', 'LIVING ROOM', 6),
('a1b2c3d4-e5f6-7890-abcd-ef1234567801', 'Dust ceiling fans', 'LIVING ROOM', 7),
('a1b2c3d4-e5f6-7890-abcd-ef1234567801', 'Wash bedding', 'BEDROOM', 8),
('a1b2c3d4-e5f6-7890-abcd-ef1234567801', 'Organize closet', 'BEDROOM', 9),
('a1b2c3d4-e5f6-7890-abcd-ef1234567801', 'Vacuum under bed', 'BEDROOM', 10),
('a1b2c3d4-e5f6-7890-abcd-ef1234567801', 'Scrub shower/tub', 'BATHROOM', 11),
('a1b2c3d4-e5f6-7890-abcd-ef1234567801', 'Clean grout', 'BATHROOM', 12),
('a1b2c3d4-e5f6-7890-abcd-ef1234567801', 'Organize medicine cabinet', 'BATHROOM', 13),
('a1b2c3d4-e5f6-7890-abcd-ef1234567801', 'Dust baseboards', 'GENERAL', 14),
('a1b2c3d4-e5f6-7890-abcd-ef1234567801', 'Clean light fixtures', 'GENERAL', 15),
('a1b2c3d4-e5f6-7890-abcd-ef1234567801', 'Wipe down doors', 'GENERAL', 16),
('a1b2c3d4-e5f6-7890-abcd-ef1234567801', 'Clean gutters', 'OUTDOOR', 17),
('a1b2c3d4-e5f6-7890-abcd-ef1234567801', 'Power wash deck/patio', 'OUTDOOR', 18);

INSERT INTO public.template_items (template_id, name, section, sort_order) VALUES
('a1b2c3d4-e5f6-7890-abcd-ef1234567802', 'Resume', 'UPDATES', 1),
('a1b2c3d4-e5f6-7890-abcd-ef1234567802', 'LinkedIn profile', 'UPDATES', 2),
('a1b2c3d4-e5f6-7890-abcd-ef1234567802', '[Company name] - [Position] - [Date]', 'APPLIED', 3),
('a1b2c3d4-e5f6-7890-abcd-ef1234567802', '[Company name] - [Position] - [Date]', 'APPLIED', 4),
('a1b2c3d4-e5f6-7890-abcd-ef1234567802', '[Company name] - [Position] - [Date]', 'APPLIED', 5),
('a1b2c3d4-e5f6-7890-abcd-ef1234567802', '[Company] - [Date/Time]', 'INTERVIEWS', 6),
('a1b2c3d4-e5f6-7890-abcd-ef1234567802', '[Company] - [Date/Time]', 'INTERVIEWS', 7),
('a1b2c3d4-e5f6-7890-abcd-ef1234567802', 'Send thank you email to [Company]', 'FOLLOW-UP', 8),
('a1b2c3d4-e5f6-7890-abcd-ef1234567802', 'Check status with [Company]', 'FOLLOW-UP', 9),
('a1b2c3d4-e5f6-7890-abcd-ef1234567802', 'Research company culture', 'PREP', 10),
('a1b2c3d4-e5f6-7890-abcd-ef1234567802', 'Prepare interview questions', 'PREP', 11),
('a1b2c3d4-e5f6-7890-abcd-ef1234567802', 'Practice common interview questions', 'PREP', 12),
('a1b2c3d4-e5f6-7890-abcd-ef1234567802', 'Choose interview outfit', 'PREP', 13),
('a1b2c3d4-e5f6-7890-abcd-ef1234567802', 'Review offer from [Company]', 'OFFER', 14),
('a1b2c3d4-e5f6-7890-abcd-ef1234567802', 'Negotiate salary', 'OFFER', 15);

INSERT INTO public.template_items (template_id, name, section, sort_order) VALUES
('a1b2c3d4-e5f6-7890-abcd-ef1234567803', 'Set wedding date', '12 MONTHS', 1),
('a1b2c3d4-e5f6-7890-abcd-ef1234567803', 'Create budget', '12 MONTHS', 2),
('a1b2c3d4-e5f6-7890-abcd-ef1234567803', 'Book venue', '12 MONTHS', 3),
('a1b2c3d4-e5f6-7890-abcd-ef1234567803', 'Hire photographer', '10 MONTHS', 4),
('a1b2c3d4-e5f6-7890-abcd-ef1234567803', 'Hire caterer', '10 MONTHS', 5),
('a1b2c3d4-e5f6-7890-abcd-ef1234567803', 'Choose wedding party', '9 MONTHS', 6),
('a1b2c3d4-e5f6-7890-abcd-ef1234567803', 'Book florist', '9 MONTHS', 7),
('a1b2c3d4-e5f6-7890-abcd-ef1234567803', 'Order wedding dress', '8 MONTHS', 8),
('a1b2c3d4-e5f6-7890-abcd-ef1234567803', 'Book DJ/band', '8 MONTHS', 9),
('a1b2c3d4-e5f6-7890-abcd-ef1234567803', 'Send save-the-dates', '6 MONTHS', 10),
('a1b2c3d4-e5f6-7890-abcd-ef1234567803', 'Book hotel blocks', '6 MONTHS', 11),
('a1b2c3d4-e5f6-7890-abcd-ef1234567803', 'Register for gifts', '5 MONTHS', 12),
('a1b2c3d4-e5f6-7890-abcd-ef1234567803', 'Order invitations', '4 MONTHS', 13),
('a1b2c3d4-e5f6-7890-abcd-ef1234567803', 'Plan rehearsal dinner', '3 MONTHS', 14),
('a1b2c3d4-e5f6-7890-abcd-ef1234567803', 'Book hair/makeup', '3 MONTHS', 15),
('a1b2c3d4-e5f6-7890-abcd-ef1234567803', 'Send invitations', '2 MONTHS', 16),
('a1b2c3d4-e5f6-7890-abcd-ef1234567803', 'Order wedding cake', '2 MONTHS', 17),
('a1b2c3d4-e5f6-7890-abcd-ef1234567803', 'Final dress fitting', '1 MONTH', 18),
('a1b2c3d4-e5f6-7890-abcd-ef1234567803', 'Confirm all vendors', '1 MONTH', 19),
('a1b2c3d4-e5f6-7890-abcd-ef1234567803', 'Get marriage license', '2 WEEKS', 20),
('a1b2c3d4-e5f6-7890-abcd-ef1234567803', 'Final headcount to caterer', '1 WEEK', 21),
('a1b2c3d4-e5f6-7890-abcd-ef1234567803', 'Pack for honeymoon', '1 WEEK', 22),
('a1b2c3d4-e5f6-7890-abcd-ef1234567803', 'Rehearsal', '1 DAY', 23),
('a1b2c3d4-e5f6-7890-abcd-ef1234567803', 'Get married!', 'WEDDING DAY', 24),
('a1b2c3d4-e5f6-7890-abcd-ef1234567803', 'Send thank you notes', 'AFTER', 25);

INSERT INTO public.template_items (template_id, name, section, sort_order) VALUES
('a1b2c3d4-e5f6-7890-abcd-ef1234567804', 'Current weight', 'GOALS', 1),
('a1b2c3d4-e5f6-7890-abcd-ef1234567804', 'Target weight', 'GOALS', 2),
('a1b2c3d4-e5f6-7890-abcd-ef1234567804', 'Target date', 'GOALS', 3),
('a1b2c3d4-e5f6-7890-abcd-ef1234567804', 'Cardio - 30 min', 'MONDAY', 4),
('a1b2c3d4-e5f6-7890-abcd-ef1234567804', 'Upper body strength', 'MONDAY', 5),
('a1b2c3d4-e5f6-7890-abcd-ef1234567804', 'Yoga/stretching', 'TUESDAY', 6),
('a1b2c3d4-e5f6-7890-abcd-ef1234567804', 'Cardio - 30 min', 'WEDNESDAY', 7),
('a1b2c3d4-e5f6-7890-abcd-ef1234567804', 'Lower body strength', 'WEDNESDAY', 8),
('a1b2c3d4-e5f6-7890-abcd-ef1234567804', 'Rest day', 'THURSDAY', 9),
('a1b2c3d4-e5f6-7890-abcd-ef1234567804', 'Cardio - 45 min', 'FRIDAY', 10),
('a1b2c3d4-e5f6-7890-abcd-ef1234567804', 'Core workout', 'FRIDAY', 11),
('a1b2c3d4-e5f6-7890-abcd-ef1234567804', 'Outdoor activity', 'SATURDAY', 12),
('a1b2c3d4-e5f6-7890-abcd-ef1234567804', 'Active recovery', 'SUNDAY', 13),
('a1b2c3d4-e5f6-7890-abcd-ef1234567804', 'Meal prep Sunday', 'NUTRITION', 14),
('a1b2c3d4-e5f6-7890-abcd-ef1234567804', 'Track daily calories', 'NUTRITION', 15),
('a1b2c3d4-e5f6-7890-abcd-ef1234567804', 'Drink 8 glasses water', 'NUTRITION', 16),
('a1b2c3d4-e5f6-7890-abcd-ef1234567804', 'Weekly weigh-in', 'MEASUREMENTS', 17),
('a1b2c3d4-e5f6-7890-abcd-ef1234567804', 'Take progress photos', 'MEASUREMENTS', 18);
