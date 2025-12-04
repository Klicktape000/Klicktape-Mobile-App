-- =====================================================
-- GENERATE MISSING REFERRAL CODES FOR EXISTING USERS
-- This script creates referral codes for users who don't have them
-- =====================================================

-- First, let's see how many users are missing referral codes
SELECT 
    COUNT(*) as total_users,
    COUNT(rc.referral_code) as users_with_codes,
    COUNT(*) - COUNT(rc.referral_code) as users_missing_codes
FROM profiles p 
LEFT JOIN referral_codes rc ON p.id = rc.user_id;

-- Generate referral codes for users who don't have them
DO $$
DECLARE
    user_record RECORD;
    new_code TEXT;
    code_exists BOOLEAN;
    attempt_count INTEGER;
BEGIN
    -- Loop through all users who don't have referral codes
    FOR user_record IN 
        SELECT p.id, p.username 
        FROM profiles p 
        LEFT JOIN referral_codes rc ON p.id = rc.user_id 
        WHERE rc.referral_code IS NULL 
        AND p.username IS NOT NULL
    LOOP
        attempt_count := 0;
        code_exists := TRUE;
        
        -- Generate a unique referral code
        WHILE code_exists AND attempt_count < 10 LOOP
            -- Use the existing generate_referral_code function
            new_code := generate_referral_code(user_record.username);
            
            -- Check if this code already exists
            SELECT EXISTS(
                SELECT 1 FROM referral_codes WHERE referral_code = new_code
            ) INTO code_exists;
            
            attempt_count := attempt_count + 1;
        END LOOP;
        
        -- If we found a unique code, insert it
        IF NOT code_exists THEN
            -- Insert referral code
            INSERT INTO referral_codes (user_id, referral_code, is_active)
            VALUES (user_record.id, new_code, true);
            
            -- Insert premium features record if it doesn't exist
            INSERT INTO user_premium_features (user_id, feature, referrals_required, referrals_completed, is_active)
            VALUES (user_record.id, 'profile_views', 5, 0, false)
            ON CONFLICT (user_id, feature) DO NOTHING;
            
            RAISE NOTICE 'Generated referral code % for user % (username: %)', 
                new_code, user_record.id, user_record.username;
        ELSE
            RAISE WARNING 'Failed to generate unique referral code for user % after % attempts', 
                user_record.username, attempt_count;
        END IF;
    END LOOP;
END $$;

-- Verify the results
SELECT 
    COUNT(*) as total_users,
    COUNT(rc.referral_code) as users_with_codes,
    COUNT(*) - COUNT(rc.referral_code) as users_still_missing_codes
FROM profiles p 
LEFT JOIN referral_codes rc ON p.id = rc.user_id;

-- Show some sample referral codes
SELECT 
    p.username,
    rc.referral_code,
    upf.referrals_completed,
    upf.referrals_required,
    upf.is_active as has_premium
FROM profiles p
JOIN referral_codes rc ON p.id = rc.user_id
LEFT JOIN user_premium_features upf ON p.id = upf.user_id AND upf.feature = 'profile_views'
ORDER BY rc.created_at DESC
LIMIT 10;

-- Final summary
SELECT 'Referral code generation completed!' as status;
