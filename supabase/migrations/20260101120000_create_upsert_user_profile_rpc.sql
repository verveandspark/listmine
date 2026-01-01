DROP FUNCTION IF EXISTS public.upsert_user_profile_for_team_member(UUID, TEXT, TEXT, TEXT, INTEGER, INTEGER, UUID);
DROP FUNCTION IF EXISTS public.upsert_user_profile(UUID, TEXT, TEXT, TEXT, INTEGER, INTEGER);

CREATE OR REPLACE FUNCTION public.upsert_user_profile(
    p_user_id UUID,
    p_email TEXT,
    p_name TEXT DEFAULT NULL,
    p_tier TEXT DEFAULT 'free',
    p_list_limit INTEGER DEFAULT 5,
    p_items_per_list_limit INTEGER DEFAULT 20
)
RETURNS public.users AS $$
DECLARE
    upserted_user public.users;
BEGIN
    IF p_user_id <> auth.uid() THEN
        RAISE EXCEPTION 'Cannot upsert profile for another user';
    END IF;

    INSERT INTO public.users (id, email, name, tier, list_limit, items_per_list_limit, created_at, updated_at)
    VALUES (
        p_user_id,
        p_email,
        COALESCE(p_name, split_part(p_email, '@', 1)),
        p_tier,
        p_list_limit,
        p_items_per_list_limit,
        NOW(),
        NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        name = COALESCE(EXCLUDED.name, public.users.name),
        updated_at = NOW()
    RETURNING * INTO upserted_user;

    RETURN upserted_user;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.upsert_user_profile_for_team_member(
    p_user_id UUID,
    p_email TEXT,
    p_name TEXT DEFAULT NULL,
    p_tier TEXT DEFAULT 'free',
    p_list_limit INTEGER DEFAULT 5,
    p_items_per_list_limit INTEGER DEFAULT 20,
    p_account_id UUID DEFAULT NULL
)
RETURNS public.users AS $$
DECLARE
    upserted_user public.users;
    is_team_member BOOLEAN;
BEGIN
    IF p_user_id = auth.uid() THEN
        INSERT INTO public.users (id, email, name, tier, list_limit, items_per_list_limit, created_at, updated_at)
        VALUES (
            p_user_id,
            p_email,
            COALESCE(p_name, split_part(p_email, '@', 1)),
            p_tier,
            p_list_limit,
            p_items_per_list_limit,
            NOW(),
            NOW()
        )
        ON CONFLICT (id) DO UPDATE SET
            email = EXCLUDED.email,
            name = COALESCE(EXCLUDED.name, public.users.name),
            updated_at = NOW()
        RETURNING * INTO upserted_user;

        RETURN upserted_user;
    END IF;

    IF p_account_id IS NOT NULL THEN
        SELECT EXISTS (
            SELECT 1 FROM public.account_team_members atm
            WHERE atm.account_id = p_account_id
              AND atm.user_id = auth.uid()
        ) INTO is_team_member;

        IF NOT is_team_member THEN
            RAISE EXCEPTION 'Cannot upsert profile: not a member of the specified team';
        END IF;

        INSERT INTO public.users (id, email, name, tier, list_limit, items_per_list_limit, created_at, updated_at)
        VALUES (
            p_user_id,
            p_email,
            COALESCE(p_name, split_part(p_email, '@', 1)),
            p_tier,
            p_list_limit,
            p_items_per_list_limit,
            NOW(),
            NOW()
        )
        ON CONFLICT (id) DO UPDATE SET
            email = EXCLUDED.email,
            name = COALESCE(EXCLUDED.name, public.users.name),
            updated_at = NOW()
        RETURNING * INTO upserted_user;

        RETURN upserted_user;
    END IF;

    RAISE EXCEPTION 'Cannot upsert profile for another user without team context';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.update_user_profile(
    p_user_id UUID,
    p_email TEXT DEFAULT NULL,
    p_name TEXT DEFAULT NULL,
    p_tier TEXT DEFAULT NULL,
    p_list_limit INTEGER DEFAULT NULL,
    p_items_per_list_limit INTEGER DEFAULT NULL,
    p_avatar_url TEXT DEFAULT NULL
)
RETURNS public.users AS $$
DECLARE
    updated_user public.users;
BEGIN
    IF p_user_id <> auth.uid() THEN
        RAISE EXCEPTION 'Cannot update profile for another user';
    END IF;

    UPDATE public.users
    SET
        email = COALESCE(p_email, email),
        name = COALESCE(p_name, name),
        tier = COALESCE(p_tier, tier),
        list_limit = COALESCE(p_list_limit, list_limit),
        items_per_list_limit = COALESCE(p_items_per_list_limit, items_per_list_limit),
        avatar_url = COALESCE(p_avatar_url, avatar_url),
        updated_at = NOW()
    WHERE id = p_user_id
    RETURNING * INTO updated_user;

    RETURN updated_user;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
