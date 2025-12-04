-- Fix RLS policies for user_premium_features table
-- This script adds the missing INSERT and UPDATE policies that are required
-- for the ensurePremiumFeatureRecord function to work properly

-- Allow inserting premium features records
-- This is needed when a user unlocks a premium feature for the first time
CREATE POLICY "Allow inserting premium features" ON user_premium_features
    FOR INSERT WITH CHECK (true);

-- Allow updating premium features for referral progress
-- This is needed when updating referral counts and activation status
CREATE POLICY "Allow updating premium features" ON user_premium_features
    FOR UPDATE USING (true);

-- Verify the policies were created
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'user_premium_features'
ORDER BY policyname;