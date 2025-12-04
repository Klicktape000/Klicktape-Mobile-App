-- ============================================
-- Free Up Email for Reuse
-- ============================================
-- This script completely removes a user from both auth.users and profiles
-- allowing the email to be used for a new account.
--
-- USAGE:
-- 1. Replace 'user@example.com' with the actual email
-- 2. Run this in Supabase SQL Editor
-- 3. The email will be immediately available for signup
--
-- ============================================

DO $$
DECLARE
    user_id_to_delete UUID;
    email_to_free TEXT := 'user@example.com';  -- ⚠️ CHANGE THIS EMAIL
    rows_deleted INT;
BEGIN
    -- Step 1: Find the user ID from auth.users
    SELECT id INTO user_id_to_delete
    FROM auth.users
    WHERE email = email_to_free;

    IF user_id_to_delete IS NULL THEN
        RAISE NOTICE '✅ Email "%" is already available (not found in auth.users)', email_to_free;
        
        -- Check if it exists in profiles only
        SELECT COUNT(*) INTO rows_deleted
        FROM public.profiles
        WHERE email = email_to_free;
        
        IF rows_deleted > 0 THEN
            RAISE NOTICE '⚠️  Found % orphaned profile(s) with this email. Cleaning up...', rows_deleted;
            DELETE FROM public.profiles WHERE email = email_to_free;
            RAISE NOTICE '✅ Orphaned profile(s) deleted';
        END IF;
        
        RETURN;
    END IF;

    RAISE NOTICE '🔍 Found user: % (ID: %)', email_to_free, user_id_to_delete;

    -- Step 2: Delete from profiles table
    DELETE FROM public.profiles WHERE id = user_id_to_delete;
    GET DIAGNOSTICS rows_deleted = ROW_COUNT;
    RAISE NOTICE '✅ Deleted % row(s) from profiles table', rows_deleted;

    -- Step 3: Delete related data (optional - uncomment if needed)
    /*
    DELETE FROM public.posts WHERE user_id = user_id_to_delete;
    DELETE FROM public.comments WHERE user_id = user_id_to_delete;
    DELETE FROM public.likes WHERE user_id = user_id_to_delete;
    DELETE FROM public.followers WHERE follower_id = user_id_to_delete OR following_id = user_id_to_delete;
    DELETE FROM public.bookmarks WHERE user_id = user_id_to_delete;
    DELETE FROM public.notifications WHERE user_id = user_id_to_delete OR actor_id = user_id_to_delete;
    DELETE FROM public.messages WHERE sender_id = user_id_to_delete OR receiver_id = user_id_to_delete;
    RAISE NOTICE '✅ Deleted related data (posts, comments, likes, etc.)';
    */

    -- Step 4: Delete from auth.users (THIS IS THE KEY STEP!)
    DELETE FROM auth.users WHERE id = user_id_to_delete;
    GET DIAGNOSTICS rows_deleted = ROW_COUNT;
    RAISE NOTICE '✅ Deleted % row(s) from auth.users table', rows_deleted;

    RAISE NOTICE '🎉 SUCCESS! Email "%" is now available for reuse', email_to_free;

EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '❌ ERROR: %', SQLERRM;
    RAISE NOTICE '💡 Make sure you have admin privileges to delete from auth.users';
END $$;

-- Verify the email is now available
SELECT 
    CASE 
        WHEN COUNT(*) = 0 THEN '✅ Email is available for signup'
        ELSE '❌ Email is still blocked'
    END as status
FROM auth.users
WHERE email = 'user@example.com';  -- ⚠️ CHANGE THIS EMAIL TO MATCH ABOVE

