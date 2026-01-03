-- Expand and improve template descriptions

-- Update existing basic templates
UPDATE public.templates SET description = 'A comprehensive starter grocery list organized by category. Includes essentials like produce, dairy, meat, and pantry items. Perfect for weekly shopping trips and meal planning.' WHERE slug = 'grocery-complete';
UPDATE public.templates SET description = 'Organize your favorite recipes with detailed ingredient lists, cooking steps, and helpful notes. Ideal for home cooks building their personal cookbook collection.' WHERE slug = 'recipe-starter';
UPDATE public.templates SET description = 'Never forget travel essentials with this complete packing checklist. Covers clothing, toiletries, documents, and more for any vacation length or destination.' WHERE slug = 'vacation-packing';

-- Update premium templates
UPDATE public.templates SET description = 'Deep clean your entire home room by room with this comprehensive checklist. Covers kitchen, living room, bedroom, bathroom, and outdoor areas. Includes often-overlooked tasks like baseboards, ceiling fans, and gutters. Perfect for annual spring cleaning or moving preparation.' WHERE slug = 'spring-cleaning-checklist';

UPDATE public.templates SET description = 'Stay organized during your job search with this all-in-one tracker. Monitor applications, schedule interviews, track follow-ups, and manage offers. Includes prep sections for resumes, LinkedIn, research, and interview practice. Ideal for active job seekers managing multiple opportunities.' WHERE slug = 'job-search-tracker';

UPDATE public.templates SET description = 'Plan your perfect wedding with this complete timeline checklist. Covers every major task from 12 months before to after the big day—from booking vendors and sending invitations to final fittings and thank you notes. Takes the stress out of wedding coordination with organized milestones.' WHERE slug = 'wedding-planning-master-checklist';

UPDATE public.templates SET description = 'Reach your fitness goals with this structured weekly workout and nutrition tracker. Plan cardio, strength training, and rest days across the week. Track goals, measurements, meal prep, and hydration. Perfect for building consistent healthy habits and monitoring progress.' WHERE slug = 'fitness-workout-tracker';

UPDATE public.templates SET description = 'Prepare your family for a smooth back-to-school transition. Covers school supplies, clothing, paperwork, medical requirements, and important family discussions. Organize everything from registration forms and immunizations to morning routines and homework expectations. Essential for busy parents juggling multiple kids or activities.' WHERE slug = 'back-to-school-checklist';

UPDATE public.templates SET description = 'Keep all your client information organized in one place. Track contact details, billing rates, payment schedules, project links, priorities, to-dos, and meeting notes for each client. Perfect for freelancers, consultants, and service providers managing multiple clients at once. Includes pre-formatted sections for 6 clients.' WHERE slug = 'client-tracker';

UPDATE public.templates SET description = 'Never miss a birthday, anniversary, or special occasion again. Track upcoming dates, brainstorm gift ideas based on interests, create shopping lists with links and prices, and mark when gifts are wrapped and delivered. Simplifies thoughtful gift-giving year-round for family and friends.' WHERE slug = 'gift-tracker';

UPDATE public.templates SET description = 'A digital phone book always at your fingertips. Organize contacts by category—family, friends, school, work, medical providers, and services like plumbers or babysitters. Add names, relationships, phone numbers, and notes in one convenient list. Great for quick reference or sharing emergency contacts.' WHERE slug = 'phone-book';
