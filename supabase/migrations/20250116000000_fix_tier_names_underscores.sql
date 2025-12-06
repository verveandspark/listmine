CREATE OR REPLACE FUNCTION check_list_limit()
RETURNS TRIGGER AS $$
DECLARE
  user_tier TEXT;
  list_limit INTEGER;
  current_count INTEGER;
BEGIN
  SELECT tier INTO user_tier FROM users WHERE id = NEW.user_id;
  
  CASE user_tier
    WHEN 'free' THEN list_limit := 5;
    WHEN 'good' THEN list_limit := 50;
    WHEN 'even_better' THEN list_limit := 100;
    WHEN 'even-better' THEN list_limit := 100;
    WHEN 'lots_more' THEN list_limit := -1;
    WHEN 'lots-more' THEN list_limit := -1;
    ELSE list_limit := 5;
  END CASE;
  
  IF list_limit != -1 THEN
    SELECT COUNT(*) INTO current_count FROM lists WHERE user_id = NEW.user_id;
    
    IF current_count >= list_limit THEN
      RAISE EXCEPTION 'List limit reached. You can only create % lists on your current tier.', list_limit;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION check_item_limit()
RETURNS TRIGGER AS $$
DECLARE
  user_tier TEXT;
  item_limit INTEGER;
  current_count INTEGER;
  list_user_id UUID;
BEGIN
  SELECT user_id INTO list_user_id FROM lists WHERE id = NEW.list_id;
  SELECT tier INTO user_tier FROM users WHERE id = list_user_id;
  
  CASE user_tier
    WHEN 'free' THEN item_limit := 20;
    WHEN 'good' THEN item_limit := 150;
    WHEN 'even_better' THEN item_limit := 500;
    WHEN 'even-better' THEN item_limit := 500;
    WHEN 'lots_more' THEN item_limit := -1;
    WHEN 'lots-more' THEN item_limit := -1;
    ELSE item_limit := 20;
  END CASE;
  
  IF item_limit != -1 THEN
    SELECT COUNT(*) INTO current_count FROM list_items WHERE list_id = NEW.list_id;
    
    IF current_count >= item_limit THEN
      RAISE EXCEPTION 'Item limit reached. You can only add % items per list on your current tier.', item_limit;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
