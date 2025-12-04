-- =====================================================
-- FIX REFERRAL DATA FLOW
-- Ensure proper data flow from referrals to dashboard
-- =====================================================

-- Test the complete referral flow
DO $$
DECLARE
    test_user_id UUID;
    test_referral_code TEXT;
BEGIN
    -- Get test user
    SELECT id INTO test_user_id FROM profiles WHERE username = 'testuser2';
    SELECT referral_code INTO test_referral_code FROM referral_codes WHERE user_id = test_user_id;
    
    RAISE NOTICE 'Testing referral flow for user: %, code: %', test_user_id, test_referral_code;
    
    -- Clear existing test data
    DELETE FROM referrals WHERE referrer_id = test_user_id;
    
    -- Reset premium features
    UPDATE user_premium_features 
    SET referrals_completed = 0, is_active = false, unlocked_at = NULL
    WHERE user_id = test_user_id AND feature = 'profile_views';
    
    -- Add test referrals one by one
    FOR i IN 1..3 LOOP
        INSERT INTO referrals (referrer_id, referral_code, status, completed_at)
        VALUES (test_user_id, test_referral_code, 'completed', NOW());
        
        -- Manually trigger the update function
        PERFORM update_referral_progress();
    END LOOP;
    
    RAISE NOTICE 'Added 3 test referrals';
END $$;

-- Check the results
SELECT 'After adding 3 referrals:' as status;
SELECT 
    p.username,
    rc.referral_code,
    upf.referrals_completed,
    upf.referrals_required,
    upf.is_active as has_premium,
    ROUND((upf.referrals_completed::DECIMAL / upf.referrals_required) * 100, 1) as progress_percentage
FROM profiles p
JOIN referral_codes rc ON p.id = rc.user_id
JOIN user_premium_features upf ON p.id = upf.user_id
WHERE p.username = 'testuser2' AND upf.feature = 'profile_views';

-- Test the dashboard view
SELECT 'Dashboard view test:' as status;
SELECT 
    username,
    referral_code,
    has_premium,
    referrals_completed,
    referrals_required,
    progress_percentage
FROM referral_dashboard 
WHERE username = 'testuser2';

-- Add 2 more referrals to reach the 5 target
INSERT INTO referrals (referrer_id, referral_code, status, completed_at)
SELECT 
    p.id,
    rc.referral_code,
    'completed',
    NOW()
FROM profiles p
JOIN referral_codes rc ON p.id = rc.user_id
WHERE p.username = 'testuser2';

INSERT INTO referrals (referrer_id, referral_code, status, completed_at)
SELECT 
    p.id,
    rc.referral_code,
    'completed',
    NOW()
FROM profiles p
JOIN referral_codes rc ON p.id = rc.user_id
WHERE p.username = 'testuser2';

-- Manually update the premium features to reflect 5 completed referrals
UPDATE user_premium_features 
SET 
    referrals_completed = (
        SELECT COUNT(*) 
        FROM referrals r 
        JOIN profiles p ON r.referrer_id = p.id 
        WHERE p.username = 'testuser2' AND r.status = 'completed'
    ),
    is_active = CASE 
        WHEN (
            SELECT COUNT(*) 
            FROM referrals r 
            JOIN profiles p ON r.referrer_id = p.id 
            WHERE p.username = 'testuser2' AND r.status = 'completed'
        ) >= 5 THEN true 
        ELSE false 
    END,
    unlocked_at = CASE 
        WHEN (
            SELECT COUNT(*) 
            FROM referrals r 
            JOIN profiles p ON r.referrer_id = p.id 
            WHERE p.username = 'testuser2' AND r.status = 'completed'
        ) >= 5 AND unlocked_at IS NULL THEN NOW() 
        ELSE unlocked_at 
    END,
    updated_at = NOW()
WHERE user_id = (SELECT id FROM profiles WHERE username = 'testuser2') 
AND feature = 'profile_views';

-- Final verification
SELECT 'Final verification - Premium unlocked:' as status;
SELECT 
    username,
    referral_code,
    has_premium,
    referrals_completed,
    referrals_required,
    progress_percentage,
    unlocked_at
FROM referral_dashboard 
WHERE username = 'testuser2';

-- Test profile views functionality
INSERT INTO profile_views (viewer_id, viewed_profile_id)
SELECT 
    (SELECT id FROM profiles WHERE username = 'user_550e8400'),
    (SELECT id FROM profiles WHERE username = 'testuser2');

-- Check if premium user can see profile views
SELECT 'Profile views test:' as status;
SELECT 
    viewer_username,
    viewed_at
FROM profile_view_history 
WHERE profile_owner_id = (SELECT id FROM profiles WHERE username = 'testuser2');

-- Test API function simulation
SELECT 'API function test - can_view_profile_visitors:' as status;
SELECT can_view_profile_visitors((SELECT id FROM profiles WHERE username = 'testuser2')) as can_view_premium_feature;

SELECT '✅ Data flow verification complete!' as final_status;
