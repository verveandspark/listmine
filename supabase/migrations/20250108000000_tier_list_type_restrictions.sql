CREATE OR REPLACE FUNCTION get_allowed_list_types(user_tier TEXT)
RETURNS TEXT[] AS $$
BEGIN
  CASE user_tier
    WHEN 'free' THEN
      RETURN ARRAY['custom', 'todo-list'];
    WHEN 'good' THEN
      RETURN ARRAY['custom', 'todo-list', 'grocery-list', 'idea-list'];
    WHEN 'even-better' THEN
      RETURN ARRAY['custom', 'todo-list', 'grocery-list', 'idea-list', 'registry-list', 'shopping-list'];
    WHEN 'lots-more' THEN
      RETURN ARRAY['custom', 'todo-list', 'grocery-list', 'idea-list', 'registry-list', 'shopping-list', 'task-list', 'checklist', 'multi-topic', 'compare-contrast', 'pro-con', 'multi-option'];
    ELSE
      RETURN ARRAY['custom', 'todo-list'];
  END CASE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION check_list_type_access()
RETURNS TRIGGER AS $$
DECLARE
  user_tier TEXT;
  allowed_types TEXT[];
BEGIN
  SELECT tier INTO user_tier FROM users WHERE id = NEW.user_id;
  
  IF user_tier IS NULL THEN
    user_tier := 'free';
  END IF;
  
  allowed_types := get_allowed_list_types(user_tier);
  
  IF NEW.list_type IS NULL THEN
    NEW.list_type := 'custom';
  END IF;
  
  IF NOT (NEW.list_type = ANY(allowed_types)) THEN
    RAISE EXCEPTION 'List type % is not available for your tier. Please upgrade to access this list type.', NEW.list_type;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS enforce_list_type_access ON lists;

CREATE TRIGGER enforce_list_type_access
  BEFORE INSERT OR UPDATE ON lists
  FOR EACH ROW
  EXECUTE FUNCTION check_list_type_access();
