-- ============================================================================
-- FOLLOW OPTIMIZATION FUNCTION - KLICKTAPE
-- ============================================================================
-- Fast atomic follow/unfollow operation similar to lightning_toggle_like_v4
-- Created: 2025-10-30
-- ============================================================================

CREATE OR REPLACE FUNCTION lightning_toggle_follow(
    p_follower_id UUID,
    p_following_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_is_following BOOLEAN;
    v_follow_id UUID;
BEGIN
    -- Validate inputs
    IF p_follower_id IS NULL OR p_following_id IS NULL THEN
        RAISE EXCEPTION 'Both follower_id and following_id are required';
    END IF;

    -- Cannot follow yourself
    IF p_follower_id = p_following_id THEN
        RAISE EXCEPTION 'Cannot follow yourself';
    END IF;

    -- Check if already following
    SELECT id INTO v_follow_id
    FROM follows
    WHERE follower_id = p_follower_id
    AND following_id = p_following_id;

    IF v_follow_id IS NOT NULL THEN
        -- Already following, so unfollow
        DELETE FROM follows
        WHERE id = v_follow_id;
        
        v_is_following := FALSE;
    ELSE
        -- Not following, so follow
        INSERT INTO follows (follower_id, following_id, created_at)
        VALUES (p_follower_id, p_following_id, NOW());
        
        -- Create notification for the followed user
        INSERT INTO notifications (
            recipient_id,
            sender_id,
            type,
            created_at,
            is_read
        )
        VALUES (
            p_following_id,
            p_follower_id,
            'follow',
            NOW(),
            FALSE
        );
        
        v_is_following := TRUE;
    END IF;

    RETURN v_is_following;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION lightning_toggle_follow(UUID, UUID) TO authenticated;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Test the function (replace with actual user IDs)
-- SELECT lightning_toggle_follow('00000000-0000-0000-0000-000000000000'::uuid, '11111111-1111-1111-1111-111111111111'::uuid);

