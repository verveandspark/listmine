DELETE FROM public.template_items WHERE template_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567802';

INSERT INTO public.template_items (template_id, name, section, sort_order, notes) VALUES
('a1b2c3d4-e5f6-7890-abcd-ef1234567802', 'Start here', 'UPDATES', 1, 'How to use this tracker: Move items through sections as you progress (Applied → Interviews → Follow-up → Offer). Add links and notes to each item to keep track of details.'),
('a1b2c3d4-e5f6-7890-abcd-ef1234567802', 'Resume', 'UPDATES', 2, 'Paste link to your resume file (Google Drive/Dropbox/etc.) + last updated date'),
('a1b2c3d4-e5f6-7890-abcd-ef1234567802', 'LinkedIn profile', 'UPDATES', 3, 'Paste your LinkedIn URL + quick notes on what to improve'),
('a1b2c3d4-e5f6-7890-abcd-ef1234567802', 'Cover letter', 'UPDATES', 4, 'Paste link to cover letter file + last updated date'),
('a1b2c3d4-e5f6-7890-abcd-ef1234567802', '[Company name] - [Position] - [Date]', 'APPLIED', 5, NULL),
('a1b2c3d4-e5f6-7890-abcd-ef1234567802', '[Company name] - [Position] - [Date]', 'APPLIED', 6, NULL),
('a1b2c3d4-e5f6-7890-abcd-ef1234567802', '[Company name] - [Position] - [Date]', 'APPLIED', 7, NULL),
('a1b2c3d4-e5f6-7890-abcd-ef1234567802', '[Company] - [Date/Time]', 'INTERVIEWS', 8, NULL),
('a1b2c3d4-e5f6-7890-abcd-ef1234567802', '[Company] - [Date/Time]', 'INTERVIEWS', 9, NULL),
('a1b2c3d4-e5f6-7890-abcd-ef1234567802', 'Send thank you email to [Company]', 'FOLLOW-UP', 10, NULL),
('a1b2c3d4-e5f6-7890-abcd-ef1234567802', 'Check status with [Company]', 'FOLLOW-UP', 11, NULL),
('a1b2c3d4-e5f6-7890-abcd-ef1234567802', 'Research company culture', 'PREP', 12, NULL),
('a1b2c3d4-e5f6-7890-abcd-ef1234567802', 'Prepare interview questions', 'PREP', 13, NULL),
('a1b2c3d4-e5f6-7890-abcd-ef1234567802', 'Practice common interview questions', 'PREP', 14, NULL),
('a1b2c3d4-e5f6-7890-abcd-ef1234567802', 'Choose interview outfit', 'PREP', 15, NULL),
('a1b2c3d4-e5f6-7890-abcd-ef1234567802', 'Review offer from [Company]', 'OFFER', 16, NULL),
('a1b2c3d4-e5f6-7890-abcd-ef1234567802', 'Negotiate salary', 'OFFER', 17, NULL),
('a1b2c3d4-e5f6-7890-abcd-ef1234567802', 'Add other info here', 'OTHER', 18, NULL);

DELETE FROM public.template_items WHERE template_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567804';

INSERT INTO public.template_items (template_id, name, section, sort_order, notes) VALUES
('a1b2c3d4-e5f6-7890-abcd-ef1234567804', 'Current weight', 'GOALS', 1, NULL),
('a1b2c3d4-e5f6-7890-abcd-ef1234567804', 'Target weight', 'GOALS', 2, NULL),
('a1b2c3d4-e5f6-7890-abcd-ef1234567804', 'Target date', 'GOALS', 3, NULL),
('a1b2c3d4-e5f6-7890-abcd-ef1234567804', 'Reward for 1 week consistent workouts', 'REWARDS', 4, NULL),
('a1b2c3d4-e5f6-7890-abcd-ef1234567804', 'Reward for hitting monthly goal', 'REWARDS', 5, NULL),
('a1b2c3d4-e5f6-7890-abcd-ef1234567804', 'Cardio - 30 min', 'MONDAY', 6, NULL),
('a1b2c3d4-e5f6-7890-abcd-ef1234567804', 'Upper body strength', 'MONDAY', 7, NULL),
('a1b2c3d4-e5f6-7890-abcd-ef1234567804', 'Yoga/stretching', 'TUESDAY', 8, NULL),
('a1b2c3d4-e5f6-7890-abcd-ef1234567804', 'Cardio - 30 min', 'WEDNESDAY', 9, NULL),
('a1b2c3d4-e5f6-7890-abcd-ef1234567804', 'Lower body strength', 'WEDNESDAY', 10, NULL),
('a1b2c3d4-e5f6-7890-abcd-ef1234567804', 'Rest day', 'THURSDAY', 11, NULL),
('a1b2c3d4-e5f6-7890-abcd-ef1234567804', 'Cardio - 45 min', 'FRIDAY', 12, NULL),
('a1b2c3d4-e5f6-7890-abcd-ef1234567804', 'Core workout', 'FRIDAY', 13, NULL),
('a1b2c3d4-e5f6-7890-abcd-ef1234567804', 'Outdoor activity', 'SATURDAY', 14, NULL),
('a1b2c3d4-e5f6-7890-abcd-ef1234567804', 'Active recovery', 'SUNDAY', 15, NULL),
('a1b2c3d4-e5f6-7890-abcd-ef1234567804', 'Meal prep Sunday', 'NUTRITION', 16, NULL),
('a1b2c3d4-e5f6-7890-abcd-ef1234567804', 'Track daily calories', 'NUTRITION', 17, NULL),
('a1b2c3d4-e5f6-7890-abcd-ef1234567804', 'Drink 8 glasses water', 'NUTRITION', 18, NULL),
('a1b2c3d4-e5f6-7890-abcd-ef1234567804', 'Weekly weigh-in', 'MEASUREMENTS', 19, NULL),
('a1b2c3d4-e5f6-7890-abcd-ef1234567804', 'Take progress photos', 'MEASUREMENTS', 20, NULL),
('a1b2c3d4-e5f6-7890-abcd-ef1234567804', 'Add other info here', 'OTHER', 21, NULL);

UPDATE public.templates SET item_count = 18 WHERE id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567802';
UPDATE public.templates SET item_count = 21 WHERE id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567804';
