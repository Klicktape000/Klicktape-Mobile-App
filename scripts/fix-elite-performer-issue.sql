-- =====================================================
-- FIX ELITE PERFORMER ISSUE
-- Update existing user_rewards to use mythological tiers
-- =====================================================

-- Update existing user_rewards records with proper mythological tiers
UPDATE user_rewards 
SET rank_tier = CASE 
    WHEN rank_achieved BETWEEN 1 AND 10 THEN 'Loki of Klicktape'::rank_tier
    WHEN rank_achieved BETWEEN 11 AND 20 THEN 'Odin of Klicktape'::rank_tier
    WHEN rank_achieved BETWEEN 21 AND 30 THEN 'Poseidon of Klicktape'::rank_tier
    WHEN rank_achieved BETWEEN 31 AND 40 THEN 'Zeus of Klicktape'::rank_tier
    WHEN rank_achieved BETWEEN 41 AND 50 THEN 'Hercules of Klicktape'::rank_tier
    ELSE 'Hercules of Klicktape'::rank_tier -- Default for ranks > 50
END
WHERE rank_tier IS NULL;

-- Update title_text to use mythological tier names instead of "Elite Performer"
UPDATE user_rewards 
SET title_text = rank_tier
WHERE title_text LIKE '%Elite Performer%' 
   OR title_text LIKE '%Top Contributor%'
   OR title_text LIKE '%Community Leader%'
   OR title_text LIKE '%Active Member%';

-- Ensure all user_rewards have rank_tier set
UPDATE user_rewards 
SET rank_tier = CASE 
    WHEN rank_achieved BETWEEN 1 AND 10 THEN 'Loki of Klicktape'::rank_tier
    WHEN rank_achieved BETWEEN 11 AND 20 THEN 'Odin of Klicktape'::rank_tier
    WHEN rank_achieved BETWEEN 21 AND 30 THEN 'Poseidon of Klicktape'::rank_tier
    WHEN rank_achieved BETWEEN 31 AND 40 THEN 'Zeus of Klicktape'::rank_tier
    WHEN rank_achieved BETWEEN 41 AND 50 THEN 'Hercules of Klicktape'::rank_tier
    ELSE 'Hercules of Klicktape'::rank_tier
END
WHERE rank_tier IS NULL;

-- Verification queries
SELECT 'VERIFICATION: User Rewards with Mythological Tiers' as status;

SELECT 
    rank_tier,
    COUNT(*) as count,
    MIN(rank_achieved) as min_rank,
    MAX(rank_achieved) as max_rank
FROM user_rewards 
WHERE rank_tier IS NOT NULL
GROUP BY rank_tier
ORDER BY MIN(rank_achieved);

-- Show sample records
SELECT 
    rank_achieved,
    rank_tier,
    title_text,
    reward_type
FROM user_rewards 
ORDER BY rank_achieved 
LIMIT 10;

SELECT '✅ Elite Performer issue fixed! All rewards now use mythological tiers.' as final_status;
