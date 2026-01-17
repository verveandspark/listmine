-- Template: Medical Expenses Tracker
INSERT INTO public.templates (id, slug, name, description, category, list_type, icon_emoji, is_premium, item_count, is_active, tier_required)
VALUES 
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567809', 'medical-expenses-tracker', 'Medical Expenses Tracker', 'Track all your medical expenses in one place for tax deductions, insurance claims, or personal budgeting.', 'Other', 'custom', '🏥', TRUE, 12, TRUE, 'good')
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

DELETE FROM public.template_items WHERE template_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567809';

-- Medical Expenses Tracker items
INSERT INTO public.template_items (template_id, name, section, sort_order, notes) VALUES
('a1b2c3d4-e5f6-7890-abcd-ef1234567809', 'Start here', 'START HERE', 1, 'Use the + Add Item button to log every medical expense throughout the year. Include the provider name, date, and amount. Add notes for the type of service (prescription, copay, therapy, etc.). This list helps with insurance claims, FSA/HSA tracking, and tax preparation.'),
('a1b2c3d4-e5f6-7890-abcd-ef1234567809', 'Doctor Visit - Primary Care', 'DOCTOR VISITS', 2, 'Date: __/__/____ | Amount: $ ____'),
('a1b2c3d4-e5f6-7890-abcd-ef1234567809', 'Specialist Visit', 'DOCTOR VISITS', 3, 'Date: __/__/____ | Amount: $ ____'),
('a1b2c3d4-e5f6-7890-abcd-ef1234567809', 'Urgent Care / ER Visit', 'DOCTOR VISITS', 4, 'Date: __/__/____ | Amount: $ ____'),
('a1b2c3d4-e5f6-7890-abcd-ef1234567809', 'Prescription Medication', 'PRESCRIPTIONS', 5, 'Date: __/__/____ | Amount: $ ____'),
('a1b2c3d4-e5f6-7890-abcd-ef1234567809', 'Over-the-Counter Medication', 'PRESCRIPTIONS', 6, 'Date: __/__/____ | Amount: $ ____'),
('a1b2c3d4-e5f6-7890-abcd-ef1234567809', 'Lab Tests / Bloodwork', 'TESTS & PROCEDURES', 7, 'Date: __/__/____ | Amount: $ ____'),
('a1b2c3d4-e5f6-7890-abcd-ef1234567809', 'X-Ray / Imaging (MRI, CT, Ultrasound)', 'TESTS & PROCEDURES', 8, 'Date: __/__/____ | Amount: $ ____'),
('a1b2c3d4-e5f6-7890-abcd-ef1234567809', 'Surgery / Procedure', 'TESTS & PROCEDURES', 9, 'Date: __/__/____ | Amount: $ ____'),
('a1b2c3d4-e5f6-7890-abcd-ef1234567809', 'Physical Therapy', 'THERAPY & TREATMENT', 10, 'Date: __/__/____ | Amount: $ ____'),
('a1b2c3d4-e5f6-7890-abcd-ef1234567809', 'Mental Health Counseling', 'THERAPY & TREATMENT', 11, 'Date: __/__/____ | Amount: $ ____'),
('a1b2c3d4-e5f6-7890-abcd-ef1234567809', 'Dental / Vision Care', 'OTHER MEDICAL', 12, 'Date: __/__/____ | Amount: $ ____');
