DROP FUNCTION IF EXISTS public.create_list_for_user(UUID, TEXT, TEXT, TEXT, UUID);
DROP FUNCTION IF EXISTS public.create_list_for_user(UUID, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.create_list_for_user(
    p_user_id UUID,
    p_list_name TEXT,
    p_category TEXT,
    p_list_type TEXT,
    p_account_id UUID DEFAULT NULL
)
RETURNS public.lists AS $$
DECLARE
    team_owner_id UUID;
    is_team_member BOOLEAN;
    new_list public.lists;
BEGIN
    -- Check if creating for a team account
    IF p_account_id IS NOT NULL THEN
        -- Verify the caller is a member of the team account
        SELECT EXISTS (
            SELECT 1 FROM public.account_team_members atm
            WHERE atm.account_id = p_account_id
              AND atm.user_id = auth.uid()
        ) INTO is_team_member;

        IF NOT is_team_member THEN
            RAISE EXCEPTION 'Cannot create list for a team you are not a member of';
        END IF;

        -- Get the team owner id for the account
        SELECT a.owner_id INTO team_owner_id FROM public.accounts a WHERE a.id = p_account_id;

        -- Insert the list with team owner as user_id and specified account_id
        INSERT INTO public.lists (user_id, title, category, list_type, account_id)
        VALUES (team_owner_id, p_list_name, p_category, p_list_type, p_account_id)
        RETURNING * INTO new_list;

    ELSE
        -- Personal list creation: only allow if p_user_id = auth.uid()
        IF p_user_id <> auth.uid() THEN
            RAISE EXCEPTION 'Cannot create list for another user';
        END IF;

        -- Insert personal list with user_id and null account_id
        INSERT INTO public.lists (user_id, title, category, list_type, account_id)
        VALUES (p_user_id, p_list_name, p_category, p_list_type, NULL)
        RETURNING * INTO new_list;
    END IF;

    RETURN new_list;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
