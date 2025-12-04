-- Fix the referral progress trigger function
CREATE OR REPLACE FUNCTION update_referral_progress()
RETURNS TRIGGER AS $$
DECLARE
    referrer_record RECORD;
    completed_referrals INTEGER;
BEGIN
    -- Process when status is 'completed' and either:
    -- 1. This is an INSERT (OLD is NULL)
    -- 2. This is an UPDATE where status changed to 'completed'
    IF NEW.status = 'completed' AND (OLD IS NULL OR OLD.status != 'completed') THEN
        
        -- Get referrer information
        SELECT * INTO referrer_record FROM profiles WHERE id = NEW.referrer_id;
        
        -- Count completed referrals for this user
        SELECT COUNT(*) INTO completed_referrals
        FROM referrals 
        WHERE referrer_id = NEW.referrer_id 
        AND status = 'completed';
        
        -- Update user's premium feature progress
        UPDATE user_premium_features 
        SET 
            referrals_completed = completed_referrals,
            is_active = CASE 
                WHEN completed_referrals >= referrals_required THEN true 
                ELSE false 
            END,
            unlocked_at = CASE 
                WHEN completed_referrals >= referrals_required AND unlocked_at IS NULL 
                THEN NOW() 
                ELSE unlocked_at 
            END,
            updated_at = NOW()
        WHERE user_id = NEW.referrer_id 
        AND feature = 'profile_views';
        
        RAISE NOTICE 'Updated referral progress for user %, completed referrals: %', NEW.referrer_id, completed_referrals;
        
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Also fix the can_view_profile_visitors function
CREATE OR REPLACE FUNCTION can_view_profile_visitors(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    has_premium BOOLEAN := false;
BEGIN
    SELECT is_active INTO has_premium
    FROM user_premium_features 
    WHERE user_premium_features.user_id = p_user_id 
    AND feature = 'profile_views';
    
    RETURN COALESCE(has_premium, false);
END;
$$ LANGUAGE plpgsql;

SELECT 'Trigger function fixed!' as status;
