-- Check if a user exists in auth.users by email
-- Run this in Supabase SQL Editor to verify if user is truly deleted

-- Replace 'user@example.com' with the email you're checking
SELECT 
    id,
    email,
    email_confirmed_at,
    created_at,
    deleted_at,
    is_sso_user,
    banned_until
FROM auth.users
WHERE email = 'user@example.com';  -- REPLACE THIS WITH THE ACTUAL EMAIL

-- If this returns a row, the user still exists in auth.users
-- If this returns nothing, the user is fully deleted

-- To manually delete a user from auth.users (requires admin privileges):
-- DELETE FROM auth.users WHERE email = 'user@example.com';

