-- Test Script for Referral Fix Verification
-- Run this after executing fix-orphaned-referrals.sql

-- 1. Quick overview of referral statuses
SELECT 'Referral Status Summary' as test_section;
SELECT 
    status,
    COUNT(*) as count
FROM referrals 
GROUP BY status
ORDER BY count DESC;

-- 2. Check if any users now have premium unlocked
SELECT 'Premium Users After Fix' as test_section;
SELECT 
    p.username,
    upf.referrals_completed,
    upf.referrals_required,
    upf.is_active as has_premium
FROM user_premium_features upf
JOIN profiles p ON upf.user_id = p.id
WHERE upf.feature = 'profile_views'
    AND upf.referrals_completed > 0
ORDER BY upf.referrals_completed DESC;

-- 3. Sample dashboard data
SELECT 'Sample Dashboard Data' as test_section;
SELECT 
    username,
    total_referrals,
    pending_referrals,
    completed_referrals,
    progress_percentage
FROM referral_dashboard
WHERE total_referrals > 0
ORDER BY completed_referrals DESC
LIMIT 10;

-- 4. Check for remaining orphaned referrals
SELECT 'Remaining Orphaned Referrals' as test_section;
SELECT COUNT(*) as remaining_orphaned_count
FROM referrals r
WHERE r.status = 'pending'
    AND r.link_clicked_at IS NOT NULL
    AND r.created_at < NOW() - INTERVAL '10 minutes'
    AND r.referred_user_id IS NULL;

SELECT 'Test completed!' as status;