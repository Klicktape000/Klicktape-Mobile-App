-- =====================================================
-- KLICKTAPE MESSAGES OPTIMIZATION
-- Optimized function for fetching conversation messages
-- =====================================================

-- Function to get conversation messages with optimized performance
CREATE OR REPLACE FUNCTION get_conversation_messages_optimized(
    p_user_id UUID,
    p_recipient_id UUID,
    p_limit INTEGER DEFAULT 30,
    p_offset INTEGER DEFAULT 0
)
RETURNS JSON
LANGUAGE plpgsql
STABLE SECURITY DEFINER
AS $$
DECLARE
    result JSON;
    cleared_at_time TIMESTAMPTZ;
BEGIN
    -- Check if chat was cleared
    SELECT cleared_at INTO cleared_at_time
    FROM cleared_chats
    WHERE user_id = p_user_id AND other_user_id = p_recipient_id;

    -- Build result with single query using CTEs for parallel execution
    WITH conversation_messages AS (
        SELECT 
            m.id,
            m.content,
            m.sender_id,
            m.receiver_id,
            m.created_at,
            m.is_read,
            m.status,
            m.delivered_at,
            m.read_at,
            m.message_type,
            m.reply_to_message_id
        FROM messages m
        WHERE (
            (m.sender_id = p_user_id AND m.receiver_id = p_recipient_id)
            OR
            (m.sender_id = p_recipient_id AND m.receiver_id = p_user_id)
        )
        AND (cleared_at_time IS NULL OR m.created_at > cleared_at_time)
        ORDER BY m.created_at DESC
        LIMIT p_limit
        OFFSET p_offset
    ),
    reply_messages AS (
        SELECT DISTINCT
            rm.id,
            rm.content,
            rm.sender_id,
            rm.message_type,
            rp.username as sender_username
        FROM conversation_messages cm
        INNER JOIN messages rm ON cm.reply_to_message_id = rm.id
        LEFT JOIN profiles rp ON rm.sender_id = rp.id
        WHERE cm.reply_to_message_id IS NOT NULL
    ),
    total_count AS (
        SELECT COUNT(*) as count
        FROM messages m
        WHERE (
            (m.sender_id = p_user_id AND m.receiver_id = p_recipient_id)
            OR
            (m.sender_id = p_recipient_id AND m.receiver_id = p_user_id)
        )
        AND (cleared_at_time IS NULL OR m.created_at > cleared_at_time)
    )
    SELECT json_build_object(
        'messages', (
            SELECT json_agg(
                json_build_object(
                    'id', cm.id,
                    'content', cm.content,
                    'sender_id', cm.sender_id,
                    'receiver_id', cm.receiver_id,
                    'created_at', cm.created_at,
                    'is_read', cm.is_read,
                    'status', cm.status,
                    'delivered_at', cm.delivered_at,
                    'read_at', cm.read_at,
                    'message_type', cm.message_type,
                    'reply_to_message_id', cm.reply_to_message_id,
                    'reply_to_message', CASE 
                        WHEN cm.reply_to_message_id IS NOT NULL THEN (
                            SELECT json_build_object(
                                'id', rm.id,
                                'content', rm.content,
                                'sender_id', rm.sender_id,
                                'message_type', rm.message_type,
                                'sender', json_build_object('username', rm.sender_username)
                            )
                            FROM reply_messages rm
                            WHERE rm.id = cm.reply_to_message_id
                        )
                        ELSE NULL
                    END
                )
            )
            FROM conversation_messages cm
        ),
        'hasMore', (SELECT count > (p_offset + p_limit) FROM total_count),
        'totalCount', (SELECT count FROM total_count)
    )
    INTO result;
    
    RETURN COALESCE(result, '{"messages": [], "hasMore": false, "totalCount": 0}'::json);
END;
$$;

-- Create indexes for optimal performance
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created 
ON messages(sender_id, receiver_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_reverse 
ON messages(receiver_id, sender_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_cleared_chats_user_other 
ON cleared_chats(user_id, other_user_id);

-- Analyze tables to update query planner statistics
ANALYZE messages;
ANALYZE cleared_chats;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_conversation_messages_optimized TO authenticated;

COMMENT ON FUNCTION get_conversation_messages_optimized IS 
'Optimized function to fetch conversation messages with reply data in a single query. 
Includes pagination support and respects cleared chat status.';

