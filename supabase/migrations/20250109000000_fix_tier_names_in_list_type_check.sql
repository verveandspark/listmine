CREATE OR REPLACE FUNCTION get_allowed_list_types(user_tier TEXT)
RETURNS TEXT[] AS $$
BEGIN
  CASE user_tier
    WHEN 'free' THEN
      RETURN ARRAY['custom', 'todo-list'];
    WHEN 'good' THEN
      RETURN ARRAY['custom', 'todo-list', 'grocery-list', 'idea-list'];
    WHEN 'even_better', 'even-better' THEN
      RETURN ARRAY['custom', 'todo-list', 'grocery-list', 'idea-list', 'registry-list', 'shopping-list'];
    WHEN 'lots_more', 'lots-more' THEN
      RETURN ARRAY['custom', 'todo-list', 'grocery-list', 'idea-list', 'registry-list', 'shopping-list', 'task-list', 'checklist', 'multi-topic', 'compare-contrast', 'pro-con', 'multi-option'];
    ELSE
      RETURN ARRAY['custom', 'todo-list'];
  END CASE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
