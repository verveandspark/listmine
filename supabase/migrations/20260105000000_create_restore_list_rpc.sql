-- Migration: Create restore_list_for_user RPC with SECURITY DEFINER
-- 
-- This RPC bypasses RLS to restore a deleted list for the authenticated user.
-- Security is enforced by checking that the user is authenticated and either:
-- 1. The list belongs to the user directly (personal list)
-- 2. The user is a member of the team that owns the list (team list)

DROP FUNCTION IF EXISTS public.restore_list_for_user(
    UUID, UUID, TEXT, TEXT, TEXT, BOOLEAN, BOOLEAN, BOOLEAN, TEXT, TEXT[], TEXT, BOOLEAN, TEXT, BOOLEAN, TEXT, UUID, TIMESTAMPTZ
);

CREATE OR REPLACE FUNCTION public.restore_list_for_user(
    p_list_id UUID,
    p_user_id UUID,
    p_title TEXT,
    p_category TEXT,
    p_list_type TEXT DEFAULT 'standard',
    p_is_archived BOOLEAN DEFAULT FALSE,
    p_is_pinned BOOLEAN DEFAULT FALSE,
    p_is_shared BOOLEAN DEFAULT FALSE,
    p_share_link TEXT DEFAULT NULL,
    p_tags TEXT[] DEFAULT '{}',
    p_description TEXT DEFAULT NULL,
    p_is_public BOOLEAN DEFAULT FALSE,
    p_public_link TEXT DEFAULT NULL,
    p_show_purchaser_info BOOLEAN DEFAULT FALSE,
    p_share_mode TEXT DEFAULT NULL,
    p_account_id UUID DEFAULT NULL,
    p_created_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS public.lists
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_auth_uid UUID;
    v_restored_list public.lists;
    v_is_team_member BOOLEAN := FALSE;
BEGIN
    -- Get the authenticated user
    v_auth_uid := auth.uid();
    
    IF v_auth_uid IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;
    
    -- Security check: User can only restore their own lists or team lists they're a member of
    IF p_account_id IS NOT NULL THEN
        -- Team list: verify user is a member of the team
        SELECT EXISTS (
            SELECT 1 FROM public.account_team_members atm
            WHERE atm.account_id = p_account_id
              AND atm.user_id = v_auth_uid
        ) INTO v_is_team_member;
        
        IF NOT v_is_team_member THEN
            RAISE EXCEPTION 'Not authorized to restore this team list';
        END IF;
    ELSE
        -- Personal list: verify user owns the list
        IF p_user_id != v_auth_uid THEN
            RAISE EXCEPTION 'Cannot restore list for another user';
        END IF;
    END IF;
    
    -- Insert the list with all provided data
    INSERT INTO public.lists (
        id,
        user_id,
        title,
        category,
        list_type,
        is_archived,
        is_pinned,
        is_shared,
        share_link,
        tags,
        description,
        is_public,
        public_link,
        show_purchaser_info,
        share_mode,
        account_id,
        created_at,
        updated_at,
        last_edited_by_user_id,
        last_edited_by_email,
        last_edited_at
    )
    VALUES (
        p_list_id,
        p_user_id,
        p_title,
        p_category,
        p_list_type,
        p_is_archived,
        p_is_pinned,
        p_is_shared,
        p_share_link,
        COALESCE(p_tags, '{}'),
        p_description,
        p_is_public,
        p_public_link,
        p_show_purchaser_info,
        p_share_mode,
        p_account_id,
        COALESCE(p_created_at, NOW()),
        NOW(),
        v_auth_uid,
        (SELECT email FROM auth.users WHERE id = v_auth_uid),
        NOW()
    )
    RETURNING * INTO v_restored_list;
    
    RETURN v_restored_list;
END;
$$;

-- Also create an RPC for restoring list items
DROP FUNCTION IF EXISTS public.restore_list_items_for_user(UUID, JSONB);

CREATE OR REPLACE FUNCTION public.restore_list_items_for_user(
    p_list_id UUID,
    p_items JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_auth_uid UUID;
    v_list_owner_id UUID;
    v_account_id UUID;
    v_is_authorized BOOLEAN := FALSE;
    v_item JSONB;
BEGIN
    -- Get the authenticated user
    v_auth_uid := auth.uid();
    
    IF v_auth_uid IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;
    
    -- Get the list's owner and account_id
    SELECT user_id, account_id INTO v_list_owner_id, v_account_id
    FROM public.lists
    WHERE id = p_list_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'List not found';
    END IF;
    
    -- Check authorization
    IF v_account_id IS NOT NULL THEN
        -- Team list: check team membership
        SELECT EXISTS (
            SELECT 1 FROM public.account_team_members atm
            WHERE atm.account_id = v_account_id
              AND atm.user_id = v_auth_uid
        ) INTO v_is_authorized;
    ELSE
        -- Personal list: check ownership
        v_is_authorized := (v_list_owner_id = v_auth_uid);
    END IF;
    
    IF NOT v_is_authorized THEN
        RAISE EXCEPTION 'Not authorized to restore items for this list';
    END IF;
    
    -- Insert all items
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        INSERT INTO public.list_items (
            id,
            list_id,
            text,
            quantity,
            priority,
            due_date,
            notes,
            assigned_to,
            completed,
            links,
            attributes,
            item_order,
            created_at,
            updated_at,
            last_edited_by_user_id,
            last_edited_by_email,
            last_edited_at
        )
        VALUES (
            (v_item->>'id')::UUID,
            p_list_id,
            v_item->>'text',
            COALESCE((v_item->>'quantity')::INTEGER, 1),
            v_item->>'priority',
            (v_item->>'due_date')::TIMESTAMPTZ,
            v_item->>'notes',
            v_item->>'assigned_to',
            COALESCE((v_item->>'completed')::BOOLEAN, FALSE),
            COALESCE((v_item->'links')::JSONB, '[]'::JSONB),
            COALESCE((v_item->'attributes')::JSONB, '{}'::JSONB),
            COALESCE((v_item->>'item_order')::INTEGER, 0),
            COALESCE((v_item->>'created_at')::TIMESTAMPTZ, NOW()),
            NOW(),
            v_auth_uid,
            (SELECT email FROM auth.users WHERE id = v_auth_uid),
            NOW()
        );
    END LOOP;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.restore_list_for_user(
    UUID, UUID, TEXT, TEXT, TEXT, BOOLEAN, BOOLEAN, BOOLEAN, TEXT, TEXT[], TEXT, BOOLEAN, TEXT, BOOLEAN, TEXT, UUID, TIMESTAMPTZ
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.restore_list_items_for_user(UUID, JSONB) TO authenticated;
