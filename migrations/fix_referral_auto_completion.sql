-- Migration: Fix Referral Auto-Completion After Email Confirmation
-- Date: 2024-12-19
-- Description: Enhances the referral system to complete referrals when users confirm their email
-- This addresses the issue where referrals were not being completed after email verification

-- Drop existing triggers and functions if they exist
DROP TRIGGER IF EXISTS trigger_auto_complete_referrals ON profiles;
DROP TRIGGER IF EXISTS trigger_complete_referrals_on_email_confirmation ON auth.users;
DROP FUNCTION IF EXISTS auto_complete_referrals();
DROP FUNCTION IF EXISTS complete_referrals_on_email_confirmation();

-- Enhanced auto-complete referrals function
-- This function is triggered when a new profile is created
CREATE OR REPLACE FUNCTION auto_complete_referrals()
RETURNS TRIGGER AS $$
DECLARE
    affected_rows INTEGER;
BEGIN
    -- Log the trigger execution
    RAISE LOG 'auto_complete_referrals triggered for profile: %', NEW.id;
    
    -- Update pending referrals that match this user's profile creation
    -- Match based on timing: link clicked within 5 minutes before to 1 minute after profile creation
    UPDATE referrals 
    SET 
        referred_user_id = NEW.id,
        status = 'completed',
        registered_at = NEW.created_at,
        completed_at = NOW()
    WHERE 
        status = 'pending'
        AND link_clicked_at IS NOT NULL
        AND link_clicked_at >= (NEW.created_at - INTERVAL '5 minutes')
        AND link_clicked_at <= (NEW.created_at + INTERVAL '1 minute');
    
    -- Log how many referrals were completed
    GET DIAGNOSTICS affected_rows = ROW_COUNT;
    RAISE LOG 'auto_complete_referrals completed % referrals for profile: %', affected_rows, NEW.id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to complete referrals when email is confirmed
-- This function is triggered when a user's email is confirmed
CREATE OR REPLACE FUNCTION complete_referrals_on_email_confirmation()
RETURNS TRIGGER AS $$
DECLARE
    user_profile_id UUID;
    affected_rows INTEGER;
BEGIN
    -- Only proceed if email_confirmed_at was just set (changed from NULL to a timestamp)
    IF OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL THEN
        
        -- Log the trigger execution
        RAISE LOG 'complete_referrals_on_email_confirmation triggered for user: %', NEW.id;
        
        -- Get the user's profile ID
        SELECT id INTO user_profile_id 
        FROM profiles 
        WHERE id = NEW.id;
        
        IF user_profile_id IS NOT NULL THEN
            -- Complete any pending referrals for this user
            -- Match based on timing and user profile
            UPDATE referrals 
            SET 
                referred_user_id = user_profile_id,
                status = 'completed',
                registered_at = NEW.created_at,
                completed_at = NOW()
            WHERE 
                status = 'pending'
                AND (
                    -- Match by timing (link clicked around profile creation time)
                    (link_clicked_at IS NOT NULL 
                     AND link_clicked_at >= (NEW.created_at - INTERVAL '10 minutes')
                     AND link_clicked_at <= (NEW.created_at + INTERVAL '5 minutes'))
                    OR
                    -- Match by user if somehow the referral was partially completed
                    referred_user_id = user_profile_id
                );
            
            -- Log how many referrals were completed
            GET DIAGNOSTICS affected_rows = ROW_COUNT;
            RAISE LOG 'complete_referrals_on_email_confirmation completed % referrals for user: %', affected_rows, NEW.id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for auto-completing referrals on profile creation
CREATE TRIGGER trigger_auto_complete_referrals
    AFTER INSERT ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION auto_complete_referrals();

-- Create trigger for completing referrals on email confirmation
CREATE TRIGGER trigger_complete_referrals_on_email_confirmation
    AFTER UPDATE OF email_confirmed_at ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION complete_referrals_on_email_confirmation();

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION auto_complete_referrals() TO authenticated;
GRANT EXECUTE ON FUNCTION complete_referrals_on_email_confirmation() TO authenticated;

-- Verify the migration was applied successfully
DO $$
BEGIN
    -- Check if functions exist
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'auto_complete_referrals') THEN
        RAISE LOG 'auto_complete_referrals function created successfully';
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'complete_referrals_on_email_confirmation') THEN
        RAISE LOG 'complete_referrals_on_email_confirmation function created successfully';
    END IF;
    
    -- Check if triggers exist
    IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_auto_complete_referrals') THEN
        RAISE LOG 'trigger_auto_complete_referrals created successfully';
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_complete_referrals_on_email_confirmation') THEN
        RAISE LOG 'trigger_complete_referrals_on_email_confirmation created successfully';
    END IF;
    
    RAISE LOG 'Referral auto-completion migration completed successfully at %', NOW();
END $$;