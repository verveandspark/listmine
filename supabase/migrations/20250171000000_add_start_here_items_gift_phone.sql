-- Delete and replace items for Gift Tracker and Phone Book templates

-- Gift Tracker: delete existing items
DELETE FROM public.template_items WHERE template_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567807';

-- Gift Tracker: re-insert with Start here item first
INSERT INTO public.template_items (template_id, name, section, sort_order, notes) VALUES
('a1b2c3d4-e5f6-7890-abcd-ef1234567807', 'Start here', 'UPCOMING DATES', 1, 'Add important dates in UPCOMING DATES. Capture ideas in GIFT IDEAS. Move items to TO BUY when you''re ready, then WRAPPED & READY, then SENT/GIVEN. Use notes for sizes, links, and preferences.'),
('a1b2c3d4-e5f6-7890-abcd-ef1234567807', '[Name] – Birthday – [Date]', 'UPCOMING DATES', 2, NULL),
('a1b2c3d4-e5f6-7890-abcd-ef1234567807', '[Name] – Anniversary – [Date]', 'UPCOMING DATES', 3, NULL),
('a1b2c3d4-e5f6-7890-abcd-ef1234567807', '[Name] – Holiday/Occasion – [Date]', 'UPCOMING DATES', 4, NULL),
('a1b2c3d4-e5f6-7890-abcd-ef1234567807', '[Name] – Likes/interests (add notes)', 'GIFT IDEAS', 5, NULL),
('a1b2c3d4-e5f6-7890-abcd-ef1234567807', '[Name] – Gift idea #1', 'GIFT IDEAS', 6, NULL),
('a1b2c3d4-e5f6-7890-abcd-ef1234567807', '[Name] – Gift idea #2', 'GIFT IDEAS', 7, NULL),
('a1b2c3d4-e5f6-7890-abcd-ef1234567807', '[Name] – Gift to purchase (add link/price)', 'TO BUY', 8, NULL),
('a1b2c3d4-e5f6-7890-abcd-ef1234567807', 'Card + wrapping supplies', 'TO BUY', 9, NULL),
('a1b2c3d4-e5f6-7890-abcd-ef1234567807', '[Name] – Gift wrapped and labeled', 'WRAPPED & READY', 10, NULL),
('a1b2c3d4-e5f6-7890-abcd-ef1234567807', '[Name] – Gift delivered/given', 'SENT/GIVEN', 11, NULL),
('a1b2c3d4-e5f6-7890-abcd-ef1234567807', 'Add other info here', 'OTHER', 12, NULL);

-- Update item count for Gift Tracker
UPDATE public.templates SET item_count = 12 WHERE id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567807';

-- Phone Book: delete existing items
DELETE FROM public.template_items WHERE template_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567808';

-- Phone Book: re-insert with Start here item first
INSERT INTO public.template_items (template_id, name, section, sort_order, notes) VALUES
('a1b2c3d4-e5f6-7890-abcd-ef1234567808', 'Start here', 'FAMILY', 1, 'Add one person per item. Put phone, email, address, and social links in notes. Use sections to group contacts.'),
('a1b2c3d4-e5f6-7890-abcd-ef1234567808', '[Name] – [Relationship]', 'FAMILY', 2, NULL),
('a1b2c3d4-e5f6-7890-abcd-ef1234567808', '[Name] – [How you know them]', 'FRIENDS', 3, NULL),
('a1b2c3d4-e5f6-7890-abcd-ef1234567808', '[Teacher/Counselor Name] – [School]', 'SCHOOL', 4, NULL),
('a1b2c3d4-e5f6-7890-abcd-ef1234567808', '[Parent Name] – [Student Name]', 'SCHOOL', 5, NULL),
('a1b2c3d4-e5f6-7890-abcd-ef1234567808', '[Name] – [Company/Role]', 'WORK', 6, NULL),
('a1b2c3d4-e5f6-7890-abcd-ef1234567808', '[Doctor Name] – [Clinic]', 'MEDICAL', 7, NULL),
('a1b2c3d4-e5f6-7890-abcd-ef1234567808', '[Pharmacy Name] – [Phone]', 'MEDICAL', 8, NULL),
('a1b2c3d4-e5f6-7890-abcd-ef1234567808', '[Plumber/Electrician] – [Company]', 'SERVICES', 9, NULL),
('a1b2c3d4-e5f6-7890-abcd-ef1234567808', '[Babysitter] – [Phone]', 'SERVICES', 10, NULL),
('a1b2c3d4-e5f6-7890-abcd-ef1234567808', 'Add other info here', 'OTHER', 11, NULL);

-- Update item count for Phone Book
UPDATE public.templates SET item_count = 11 WHERE id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567808';
