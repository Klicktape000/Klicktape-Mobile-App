-- Auto-complete referrals when new users are created
-- This function will automatically complete pending referrals based on timing

CREATE OR REPLACE FUNCTION auto_complete_referrals()
RETURNS TRIGGER AS $$
DECLARE
    pending_referral RECORD;
BEGIN
    -- Look for pending referrals that might match this new user
    -- We'll match based on timing (within 5 minutes of profile creation)
    FOR pending_referral IN 
        SELECT * FROM referrals 
        WHERE status = 'pending' 
        AND referred_user_id IS NULL 
        AND link_clicked_at >= (NEW.created_at - INTERVAL '5 minutes')
        AND link_clicked_at <= (NEW.created_at + INTERVAL '1 minute')
        ORDER BY link_clicked_at DESC 
        LIMIT 1
    LOOP
        -- Update the referral to completed
        UPDATE referrals 
        SET 
            referred_user_id = NEW.id,
            status = 'completed',
            registered_at = NEW.created_at,
            completed_at = NOW()
        WHERE id = pending_referral.id;
        
        RAISE NOTICE 'Auto-completed referral % for user %', pending_referral.referral_code, NEW.username;
        
        -- Exit after completing one referral
        EXIT;
    END LOOP;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-complete referrals when profiles are created
DROP TRIGGER IF EXISTS trigger_auto_complete_referrals ON profiles;
CREATE TRIGGER trigger_auto_complete_referrals
    AFTER INSERT ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION auto_complete_referrals();
