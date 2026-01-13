-- =============================================
-- Create function to get user conversations efficiently
-- Returns only the latest message per conversation
-- MUCH faster than fetching all messages
-- =============================================

CREATE OR REPLACE FUNCTION get_user_conversations(user_id_param UUID)
RETURNS TABLE (
  other_user_id UUID,
  username TEXT,
  avatar_url TEXT,
  last_message_content TEXT,
  last_message_type TEXT,
  last_message_time TIMESTAMPTZ,
  is_read BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH latest_messages AS (
    -- Get the most recent message for each conversation
    SELECT DISTINCT ON (
      CASE 
        WHEN m.sender_id = user_id_param THEN m.receiver_id
        ELSE m.sender_id
      END
    )
      CASE 
        WHEN m.sender_id = user_id_param THEN m.receiver_id
        ELSE m.sender_id
      END AS other_user_id,
      m.content AS last_message_content,
      m.message_type AS last_message_type,
      m.created_at AS last_message_time,
      m.is_read,
      m.sender_id
    FROM messages m
    WHERE m.sender_id = user_id_param OR m.receiver_id = user_id_param
    ORDER BY 
      CASE 
        WHEN m.sender_id = user_id_param THEN m.receiver_id
        ELSE m.sender_id
      END,
      m.created_at DESC
  )
  SELECT 
    lm.other_user_id,
    COALESCE(p.username, 'User') AS username,
    p.avatar_url,
    lm.last_message_content,
    COALESCE(lm.last_message_type, 'text') AS last_message_type,
    lm.last_message_time,
    -- If user sent the message, it's always "read" from their perspective
    -- If user received it, use the actual is_read status
    CASE 
      WHEN lm.sender_id = user_id_param THEN true
      ELSE lm.is_read
    END AS is_read
  FROM latest_messages lm
  LEFT JOIN profiles p ON p.id = lm.other_user_id
  ORDER BY lm.last_message_time DESC;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_user_conversations(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_conversations(UUID) TO anon;

-- Add comment
COMMENT ON FUNCTION get_user_conversations(UUID) IS 
  'Efficiently retrieves user conversations with only the latest message per conversation. 
   Returns other user info, last message content/type, timestamp, and read status.
   Much faster than fetching all messages.';
