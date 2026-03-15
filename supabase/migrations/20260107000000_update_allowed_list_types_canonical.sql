CREATE OR REPLACE FUNCTION get_allowed_list_types(user_tier TEXT)
RETURNS TEXT[] AS $$
BEGIN
  CASE user_tier
    WHEN 'free' THEN
      RETURN ARRAY['custom', 'todo', 'todo-list'];
    WHEN 'good' THEN
      RETURN ARRAY['custom', 'todo', 'todo-list', 'grocery', 'grocery-list', 'idea', 'idea-list'];
    WHEN 'even_better', 'even-better' THEN
      RETURN ARRAY['custom', 'todo', 'todo-list', 'grocery', 'grocery-list', 'idea', 'idea-list', 'registry', 'registry-list', 'shopping', 'shopping-list', 'wishlist'];
    WHEN 'lots_more', 'lots-more' THEN
      RETURN ARRAY['custom', 'todo', 'todo-list', 'grocery', 'grocery-list', 'idea', 'idea-list', 'registry', 'registry-list', 'shopping', 'shopping-list', 'wishlist', 'task-list', 'checklist', 'multi-topic', 'compare-contrast', 'pro-con', 'multi-option'];
    ELSE
      RETURN ARRAY['custom', 'todo', 'todo-list'];
  END CASE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
