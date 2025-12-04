-- Fix for Referral Auto-Completion After Email Confirmation
-- This script ensures pending referrals are automatically completed when users confirm their email

-- Enhanced auto-complete referrals function
CREATE OR REPLACE FUNCTION auto_complete_referrals()
RETURNS TRIGGER AS $$
DECLARE
    pending_referral RECORD;
    user_email TEXT;
BEGIN
    -- Get user email from auth.users table
    SELECT email INTO user_email 
    FROM auth.users 
    WHERE id = NEW.id;
    
    -- Look for pending referrals that might match this new user
    -- We'll match based on timing (within 10 minutes of profile creation)
    -- and prioritize more recent clicks
    FOR pending_referral IN 
        SELECT * FROM referrals 
        WHERE status = 'pending' 
        AND referred_user_id IS NULL 
        AND link_clicked_at >= (NEW.created_at - INTERVAL '10 minutes')
        AND link_clicked_at <= (NEW.created_at + INTERVAL '2 minutes')
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
        
        RAISE NOTICE 'Auto-completed referral % for user % (email: %)', 
            pending_referral.referral_code, NEW.username, user_email;
        
        -- Exit after completing one referral
        EXIT;
    END LOOP;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to complete referrals when email is confirmed
CREATE OR REPLACE FUNCTION complete_referrals_on_email_confirmation()
RETURNS TRIGGER AS $$
DECLARE
    pending_referral RECORD;
    user_profile RECORD;
BEGIN
    -- Only proceed if email_confirmed_at was just set (not null and previously was null)
    IF NEW.email_confirmed_at IS NOT NULL AND OLD.email_confirmed_at IS NULL THEN
        
        -- Get user profile information
        SELECT * INTO user_profile 
        FROM profiles 
        WHERE id = NEW.id;
        
        -- Look for pending referrals for this user
        FOR pending_referral IN 
            SELECT * FROM referrals 
            WHERE status = 'pending' 
            AND referred_user_id IS NULL 
            AND link_clicked_at >= (NEW.created_at - INTERVAL '24 hours')
            AND link_clicked_at <= (NEW.email_confirmed_at + INTERVAL '5 minutes')
            ORDER BY link_clicked_at DESC 
            LIMIT 1
        LOOP
            -- Update the referral to completed
            UPDATE referrals 
            SET 
                referred_user_id = NEW.id,
                status = 'completed',
                registered_at = NEW.created_at,
                completed_at = NEW.email_confirmed_at
            WHERE id = pending_referral.id;
            
            RAISE NOTICE 'Completed referral % on email confirmation for user % (email: %)', 
                pending_referral.referral_code, user_profile.username, NEW.email;
            
            -- Exit after completing one referral
            EXIT;
        END LOOP;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS trigger_auto_complete_referrals ON profiles;
DROP TRIGGER IF EXISTS trigger_complete_referrals_on_email_confirmation ON auth.users;

-- Create trigger to auto-complete referrals when profiles are created
CREATE TRIGGER trigger_auto_complete_referrals
    AFTER INSERT ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION auto_complete_referrals();

-- Create trigger to complete referrals when email is confirmed
CREATE TRIGGER trigger_complete_referrals_on_email_confirmation
    AFTER UPDATE ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION complete_referrals_on_email_confirmation();

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION auto_complete_referrals() TO authenticated;
GRANT EXECUTE ON FUNCTION complete_referrals_on_email_confirmation() TO authenticated;

-- Test the triggers (optional - can be run to verify)
-- SELECT 'Referral auto-completion triggers deployed successfully' as status;