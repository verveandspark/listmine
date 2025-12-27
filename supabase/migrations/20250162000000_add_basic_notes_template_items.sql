DELETE FROM public.template_items WHERE template_id = '6fbe31f9-1e95-462c-b7fa-2abfc3726193';

INSERT INTO public.template_items (template_id, name, notes, sort_order) VALUES
  ('6fbe31f9-1e95-462c-b7fa-2abfc3726193', 'Main idea', 'Write the main point you want to remember.', 1),
  ('6fbe31f9-1e95-462c-b7fa-2abfc3726193', 'Supporting details', 'Add context, examples, or key details.', 2),
  ('6fbe31f9-1e95-462c-b7fa-2abfc3726193', 'Action items', 'List next steps (things to do).', 3),
  ('6fbe31f9-1e95-462c-b7fa-2abfc3726193', 'Follow-up needed', 'What needs a reply, check-in, or reminder?', 4),
  ('6fbe31f9-1e95-462c-b7fa-2abfc3726193', 'Resources/links', 'Paste URLs, files, or references.', 5);

UPDATE public.templates SET item_count = 5 WHERE id = '6fbe31f9-1e95-462c-b7fa-2abfc3726193';
