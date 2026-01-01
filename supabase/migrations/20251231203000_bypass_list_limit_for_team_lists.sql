CREATE OR REPLACE FUNCTION check_list_limit()
RETURNS TRIGGER AS $$
DECLARE
  user_tier TEXT;
  list_limit INTEGER;
  current_count INTEGER;
BEGIN
  -- Skip limit check for team lists (account_id not null)
  IF NEW.account_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

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
