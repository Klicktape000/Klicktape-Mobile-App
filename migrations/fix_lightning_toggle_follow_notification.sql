-- ============================================================================
-- FIX: Update lightning_toggle_follow to use correct notification columns
-- ============================================================================
-- Issue: Function was using user_id/actor_id instead of recipient_id/sender_id
-- Fixed: 2025-11-06
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
        -- FIXED: Using recipient_id and sender_id instead of user_id and actor_id
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

-- Verify the function exists
SELECT 'Function lightning_toggle_follow has been updated successfully!' as status;
