-- Fix Orphaned Referrals - Complete Referrals That Should Be Marked as Completed
-- Date: 2024-12-19
-- Description: Identifies and fixes referrals that are stuck in 'pending' status
-- when the referred users have actually registered and should be marked as 'completed'

-- =====================================================
-- DIAGNOSTIC QUERIES - Run these first to see the current state
-- =====================================================

-- 1. Show current referral status overview
SELECT 'Current Referral Status Overview' as section;
SELECT 
    status,
    COUNT(*) as count,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM referrals 
GROUP BY status
ORDER BY count DESC;

-- 2. Show users with pending referrals vs their actual registration status
SELECT 'Users with Pending Referrals Analysis' as section;
SELECT 
    r.referral_code,
    r.status as referral_status,
    r.link_clicked_at,
    r.created_at as referral_created,
    p_referrer.username as referrer_username,
    CASE 
        WHEN r.referred_user_id IS NOT NULL THEN 'Has referred_user_id'
        ELSE 'No referred_user_id'
    END as has_referred_user,
    CASE 
        WHEN p_referred.id IS NOT NULL THEN 'User exists'
        ELSE 'User does not exist'
    END as referred_user_exists
FROM referrals r
JOIN profiles p_referrer ON r.referrer_id = p_referrer.id
LEFT JOIN profiles p_referred ON r.referred_user_id = p_referred.id
WHERE r.status = 'pending'
ORDER BY r.created_at DESC;

-- 3. Identify orphaned referrals that should be completed
-- These are referrals where:
-- - Status is 'pending' 
-- - Link was clicked (indicating genuine interest)
-- - Created more than 10 minutes ago (enough time for registration)
-- - No referred_user_id set (but user might have registered)
SELECT 'Orphaned Referrals That Should Be Completed' as section;
SELECT 
    r.id as referral_id,
    r.referral_code,
    r.referrer_id,
    p_referrer.username as referrer_username,
    r.link_clicked_at,
    r.created_at as referral_created,
    EXTRACT(EPOCH FROM (NOW() - r.created_at))/60 as minutes_old,
    r.referred_user_id,
    r.status
FROM referrals r
JOIN profiles p_referrer ON r.referrer_id = p_referrer.id
WHERE r.status = 'pending'
    AND r.link_clicked_at IS NOT NULL
    AND r.created_at < NOW() - INTERVAL '10 minutes'
    AND r.referred_user_id IS NULL
ORDER BY r.created_at ASC;

-- 4. Show current dashboard stats before fix
SELECT 'Current Dashboard Stats (Before Fix)' as section;
SELECT 
    username,
    referral_code,
    has_premium,
    referrals_completed,
    referrals_required,
    total_referrals,
    pending_referrals,
    completed_referrals,
    progress_percentage
FROM referral_dashboard
WHERE total_referrals > 0
ORDER BY total_referrals DESC, username;

-- =====================================================
-- FIX IMPLEMENTATION
-- =====================================================

-- 5. Fix orphaned referrals by matching them with users who registered
-- Strategy: Look for users who registered around the time of pending referrals
-- and match them based on timing patterns

SELECT 'Starting Orphaned Referral Fix...' as section;

-- Create a temporary function to help with the matching
CREATE OR REPLACE FUNCTION fix_orphaned_referrals()
RETURNS TABLE(
    referral_id UUID,
    referral_code VARCHAR,
    referrer_username VARCHAR,
    matched_user_id UUID,
    matched_username VARCHAR,
    action_taken VARCHAR
) AS $$
DECLARE
    orphaned_referral RECORD;
    potential_user RECORD;
    matched_user_id UUID;
    affected_count INTEGER := 0;
BEGIN
    -- Loop through orphaned referrals
    FOR orphaned_referral IN 
        SELECT 
            r.id,
            r.referral_code,
            r.referrer_id,
            r.link_clicked_at,
            r.created_at,
            p.username as referrer_username
        FROM referrals r
        JOIN profiles p ON r.referrer_id = p.id
        WHERE r.status = 'pending'
            AND r.link_clicked_at IS NOT NULL
            AND r.created_at < NOW() - INTERVAL '10 minutes'
            AND r.referred_user_id IS NULL
        ORDER BY r.created_at ASC
    LOOP
        matched_user_id := NULL;
        
        -- Try to find a user who registered around the time of this referral
        -- Look for users created within 30 minutes after the referral link was clicked
        SELECT p.id INTO matched_user_id
        FROM profiles p
        WHERE p.created_at >= orphaned_referral.link_clicked_at
            AND p.created_at <= orphaned_referral.link_clicked_at + INTERVAL '30 minutes'
            AND p.id != orphaned_referral.referrer_id  -- Not the referrer themselves
            AND NOT EXISTS (
                -- Make sure this user isn't already associated with another completed referral
                SELECT 1 FROM referrals r2 
                WHERE r2.referred_user_id = p.id 
                AND r2.status = 'completed'
            )
        ORDER BY p.created_at ASC
        LIMIT 1;
        
        IF matched_user_id IS NOT NULL THEN
            -- Get the matched user's info
            SELECT username INTO potential_user.username
            FROM profiles 
            WHERE id = matched_user_id;
            
            -- Update the referral to completed
            UPDATE referrals 
            SET 
                referred_user_id = matched_user_id,
                status = 'completed',
                registered_at = (SELECT created_at FROM profiles WHERE id = matched_user_id),
                completed_at = NOW(),
                updated_at = NOW()
            WHERE id = orphaned_referral.id;
            
            affected_count := affected_count + 1;
            
            -- Return the result
            referral_id := orphaned_referral.id;
            referral_code := orphaned_referral.referral_code;
            referrer_username := orphaned_referral.referrer_username;
            matched_user_id := matched_user_id;
            matched_username := potential_user.username;
            action_taken := 'COMPLETED';
            
            RETURN NEXT;
            
            RAISE NOTICE 'Fixed referral % for % -> % (user: %)', 
                orphaned_referral.referral_code, 
                orphaned_referral.referrer_username,
                potential_user.username,
                matched_user_id;
        ELSE
            -- No match found, just return info
            referral_id := orphaned_referral.id;
            referral_code := orphaned_referral.referral_code;
            referrer_username := orphaned_referral.referrer_username;
            matched_user_id := NULL;
            matched_username := NULL;
            action_taken := 'NO_MATCH_FOUND';
            
            RETURN NEXT;
        END IF;
    END LOOP;
    
    RAISE NOTICE 'Fixed % orphaned referrals', affected_count;
END;
$$ LANGUAGE plpgsql;

-- 6. Execute the fix
SELECT 'Executing Fix...' as section;
SELECT * FROM fix_orphaned_referrals();

-- 7. Clean up the temporary function
DROP FUNCTION fix_orphaned_referrals();

-- =====================================================
-- VERIFICATION QUERIES - Run these after the fix
-- =====================================================

-- 8. Show updated referral status overview
SELECT 'Updated Referral Status Overview (After Fix)' as section;
SELECT 
    status,
    COUNT(*) as count,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM referrals 
GROUP BY status
ORDER BY count DESC;

-- 9. Show updated dashboard stats
SELECT 'Updated Dashboard Stats (After Fix)' as section;
SELECT 
    username,
    referral_code,
    has_premium,
    referrals_completed,
    referrals_required,
    total_referrals,
    pending_referrals,
    completed_referrals,
    progress_percentage
FROM referral_dashboard
WHERE total_referrals > 0
ORDER BY total_referrals DESC, username;

-- 10. Show users who now have premium unlocked
SELECT 'Users Who Unlocked Premium Features' as section;
SELECT 
    p.username,
    upf.referrals_completed,
    upf.referrals_required,
    upf.is_active as has_premium,
    upf.unlocked_at
FROM user_premium_features upf
JOIN profiles p ON upf.user_id = p.id
WHERE upf.feature = 'profile_views'
    AND upf.is_active = true
ORDER BY upf.unlocked_at DESC;

-- 11. Final summary
SELECT 'Fix Summary' as section;
SELECT 
    'Total referrals' as metric,
    COUNT(*) as value
FROM referrals
UNION ALL
SELECT 
    'Completed referrals' as metric,
    COUNT(*) as value
FROM referrals WHERE status = 'completed'
UNION ALL
SELECT 
    'Pending referrals' as metric,
    COUNT(*) as value
FROM referrals WHERE status = 'pending'
UNION ALL
SELECT 
    'Users with premium' as metric,
    COUNT(*) as value
FROM user_premium_features 
WHERE feature = 'profile_views' AND is_active = true;

SELECT 'Orphaned referral fix completed successfully!' as status;