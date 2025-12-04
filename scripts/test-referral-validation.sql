-- Test referral validation as it would happen during signup
-- This simulates the queries that the app makes

-- 1. Test referral code lookup (what the validation function does)
SELECT 'Testing referral code validation...' as test_step;

SELECT user_id, is_active 
FROM referral_codes 
WHERE referral_code = 'JOYINL559' AND is_active = true;

-- 2. Test profile lookup for username
SELECT 'Testing profile lookup...' as test_step;

SELECT username 
FROM profiles 
WHERE id = '006a8ffe-5373-4963-8f9b-9af7bbf73ac6';

-- 3. Test inserting a referral tracking record (what trackReferralClick does)
SELECT 'Testing referral tracking insert...' as test_step;

INSERT INTO referrals (
    referrer_id, 
    referral_code, 
    status, 
    link_clicked_at, 
    ip_address, 
    user_agent
) VALUES (
    '006a8ffe-5373-4963-8f9b-9af7bbf73ac6',
    'JOYINL559',
    'pending',
    NOW(),
    '127.0.0.1',
    'Test Browser'
) RETURNING id, status;

-- 4. Test completing a referral (what completeReferral does)
SELECT 'Testing referral completion...' as test_step;

-- First, let's see what referrals exist for this code
SELECT id, status, referred_user_id 
FROM referrals 
WHERE referral_code = 'JOYINL559' 
ORDER BY created_at DESC 
LIMIT 1;

-- Clean up the test record
DELETE FROM referrals 
WHERE referral_code = 'JOYINL559' 
AND ip_address = '127.0.0.1' 
AND user_agent = 'Test Browser';

SELECT 'Referral validation test completed!' as result;
