-- Expand descriptions for templates with short descriptions (identified by UUIDs)

-- Basic To-Do (ID: 3acd1af8-cc6f-4bdb-8e1f-24bf738b4ab2)
UPDATE public.templates 
SET description = 'Start organizing your tasks with this simple to-do list. Add items with due dates, priorities, and completion checkboxes. Perfect for daily errands, work tasks, or quick personal reminders. Keep everything you need to accomplish in one easy place.'
WHERE id = '3acd1af8-cc6f-4bdb-8e1f-24bf738b4ab2';

-- Quick Reminders (ID: 4b3e5470-d36d-427d-89b3-d31def98b801)
UPDATE public.templates 
SET description = 'Capture quick notes and reminders before they slip away. Jot down ideas, phone numbers, things to remember, or little tasks that pop up throughout your day. A lightweight list for those moments when you just need to write something down fast.'
WHERE id = '4b3e5470-d36d-427d-89b3-d31def98b801';

-- Basic Notes (ID: 6fbe31f9-1e95-462c-b7fa-2abfc3726193)
UPDATE public.templates 
SET description = 'Organize your thoughts and information in a structured note format. Capture main ideas, supporting details, action items, and follow-ups all in one place. Great for meeting notes, brainstorming sessions, class lectures, or project planning. Add links and resources to keep everything connected.'
WHERE id = '6fbe31f9-1e95-462c-b7fa-2abfc3726193';

-- Home Maintenance (ID: 17befa2f-0848-4914-8a8a-c0b135402b7d)
UPDATE public.templates 
SET description = 'Keep your home in top shape with this comprehensive maintenance checklist. Track seasonal tasks like HVAC filter changes, gutter cleaning, and appliance servicing. Includes indoor and outdoor maintenance items organized by frequency—monthly, seasonal, and annual tasks. Prevent costly repairs by staying on top of routine home care.'
WHERE id = '17befa2f-0848-4914-8a8a-c0b135402b7d';

-- Moving Checklist (ID: f6f942d1-7467-4d98-b2bf-dcbce6b597d6)
UPDATE public.templates 
SET description = 'Make your move smooth and stress-free with this complete moving checklist. Covers everything from finding movers and packing supplies to address changes and utility transfers. Organized into sections: Before Moving, Packing, Moving Day, and After Moving. Don''t forget anything important during the chaos of relocation.'
WHERE id = 'f6f942d1-7467-4d98-b2bf-dcbce6b597d6';

-- Weekly Meal Planning (ID: adc6101d-53b2-4267-a84c-5351600f8cbc)
UPDATE public.templates 
SET description = 'Plan your family''s meals for the entire week with this easy-to-use meal planner. Organize breakfast, lunch, dinner, and snacks for each day from Monday through Sunday. Add a notes section for grocery needs or prep reminders. Save time, reduce food waste, and eat healthier by planning ahead.'
WHERE id = 'adc6101d-53b2-4267-a84c-5351600f8cbc';

-- Birthday Party (ID: 25934caa-e884-4719-9d73-2022fa39967a)
UPDATE public.templates 
SET description = 'Throw an unforgettable birthday celebration with this comprehensive party planning checklist. Track your guest list with RSVPs, book the perfect venue, coordinate decorations and theme, plan food and drinks, arrange entertainment or activities, and organize party favors. Timeline sections help you stay on track from weeks before to day-of tasks. Includes budget tracking, vendor contacts, and reminder sections for invitations and thank-you notes. Perfect for planning kids parties, milestone birthdays, or surprise celebrations.'
WHERE id = '25934caa-e884-4719-9d73-2022fa39967a';
