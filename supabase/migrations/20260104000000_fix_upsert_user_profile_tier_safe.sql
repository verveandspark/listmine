-- Migration: Make upsert_user_profile tier-safe
-- 
-- ISSUE: The older version of upsert_user_profile was updating tier on conflict,
-- which could reset user tier to 'free' during operations.
--
-- FIX: Ensure the upsert_user_profile function ONLY updates email/name on conflict,
-- NEVER updates tier. The tier should only be changed through:
-- 1. Initial registration (new user gets 'free')
-- 2. Admin update via update_user_tier RPC
-- 3. Upgrade/downgrade flow via updateUserTier in AuthContextProvider

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
    -- Security check: users can only upsert their own profile
    IF p_user_id <> auth.uid() THEN
        RAISE EXCEPTION 'Cannot upsert profile for another user';
    END IF;

    -- Insert new user with provided values, OR on conflict:
    -- ONLY update email, name, and updated_at
    -- NEVER update tier, list_limit, or items_per_list_limit on conflict
    -- This prevents accidental tier resets during normal operations
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
        -- IMPORTANT: tier, list_limit, items_per_list_limit are NOT updated on conflict
        -- This is intentional to prevent tier reset bugs
    RETURNING * INTO upserted_user;

    RETURN upserted_user;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Also fix the team member version to be tier-safe
DROP FUNCTION IF EXISTS public.upsert_user_profile_for_team_member(UUID, TEXT, TEXT, TEXT, INTEGER, INTEGER, UUID);

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
    -- If upserting own profile, allow it
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
            -- IMPORTANT: tier is NOT updated on conflict
        RETURNING * INTO upserted_user;

        RETURN upserted_user;
    END IF;

    -- If account_id provided, check team membership
    IF p_account_id IS NOT NULL THEN
        SELECT EXISTS (
            SELECT 1 FROM public.account_team_members atm
            WHERE atm.account_id = p_account_id
              AND atm.user_id = auth.uid()
        ) INTO is_team_member;

        IF NOT is_team_member THEN
            RAISE EXCEPTION 'Cannot upsert profile: not a member of the specified team';
        END IF;

        -- Team member can create profile for invited user (e.g., during invite flow)
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
            -- IMPORTANT: tier is NOT updated on conflict
        RETURNING * INTO upserted_user;

        RETURN upserted_user;
    END IF;

    RAISE EXCEPTION 'Cannot upsert profile for another user without team context';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.upsert_user_profile(UUID, TEXT, TEXT, TEXT, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_user_profile_for_team_member(UUID, TEXT, TEXT, TEXT, INTEGER, INTEGER, UUID) TO authenticated;
