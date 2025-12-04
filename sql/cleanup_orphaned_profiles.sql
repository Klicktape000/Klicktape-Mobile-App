-- ============================================
-- Cleanup Orphaned Profiles Function
-- ============================================
-- This function automatically removes profiles that don't have
-- corresponding auth.users records, freeing up emails for reuse.
--
-- Run this periodically or set up as a scheduled job.
-- ============================================

CREATE OR REPLACE FUNCTION cleanup_orphaned_profiles()
RETURNS TABLE(
    deleted_count INTEGER,
    freed_emails TEXT[]
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    orphaned_emails TEXT[];
    deleted_rows INTEGER;
BEGIN
    -- Collect emails that will be freed
    SELECT ARRAY_AGG(p.email)
    INTO orphaned_emails
    FROM profiles p
    LEFT JOIN auth.users a ON p.id = a.id
    WHERE a.id IS NULL;

    -- Delete orphaned profiles
    DELETE FROM profiles p
    WHERE NOT EXISTS (
        SELECT 1 FROM auth.users a WHERE a.id = p.id
    );

    GET DIAGNOSTICS deleted_rows = ROW_COUNT;

    -- Return results
    RETURN QUERY SELECT deleted_rows, COALESCE(orphaned_emails, ARRAY[]::TEXT[]);
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION cleanup_orphaned_profiles() TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_orphaned_profiles() TO service_role;

-- Example usage:
-- SELECT * FROM cleanup_orphaned_profiles();

COMMENT ON FUNCTION cleanup_orphaned_profiles() IS 
'Removes profiles that do not have corresponding auth.users records, freeing up emails for reuse. Returns count of deleted profiles and list of freed emails.';

