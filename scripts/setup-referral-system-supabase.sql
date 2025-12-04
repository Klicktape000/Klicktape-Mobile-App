-- =====================================================
-- COMPLETE REFERRAL SYSTEM SETUP FOR SUPABASE
-- Run this in Supabase SQL Editor
-- =====================================================

-- 1. Create ENUM types
DO $$ 
BEGIN
    -- Create referral_status enum if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'referral_status') THEN
        CREATE TYPE referral_status AS ENUM ('pending', 'registered', 'completed', 'invalid');
    END IF;
    
    -- Create premium_feature enum if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'premium_feature') THEN
        CREATE TYPE premium_feature AS ENUM ('profile_views', 'advanced_analytics', 'priority_support', 'custom_themes');
    END IF;
END $$;

-- 2. Create referral_codes table (preserving existing data if any)
CREATE TABLE IF NOT EXISTS referral_codes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    referral_code TEXT NOT NULL UNIQUE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add columns if they don't exist (for existing tables)
DO $$
BEGIN
    -- Add updated_at column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'referral_codes' AND column_name = 'updated_at') THEN
        ALTER TABLE referral_codes ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;
END $$;

-- 3. Create referrals table
CREATE TABLE IF NOT EXISTS referrals (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    referrer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    referred_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    referral_code TEXT NOT NULL,
    status referral_status DEFAULT 'pending',
    link_clicked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    registered_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    ip_address TEXT,
    user_agent TEXT,
    referred_email TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Create user_premium_features table (preserving existing data)
CREATE TABLE IF NOT EXISTS user_premium_features (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    feature premium_feature NOT NULL,
    is_active BOOLEAN DEFAULT false,
    referrals_required INTEGER DEFAULT 5,
    referrals_completed INTEGER DEFAULT 0,
    unlocked_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, feature)
);

-- Add columns if they don't exist (for existing tables)
DO $$
BEGIN
    -- Add referrals_required column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_premium_features' AND column_name = 'referrals_required') THEN
        ALTER TABLE user_premium_features ADD COLUMN referrals_required INTEGER DEFAULT 5;
    END IF;

    -- Add referrals_completed column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_premium_features' AND column_name = 'referrals_completed') THEN
        ALTER TABLE user_premium_features ADD COLUMN referrals_completed INTEGER DEFAULT 0;
    END IF;

    -- Add unlocked_at column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_premium_features' AND column_name = 'unlocked_at') THEN
        ALTER TABLE user_premium_features ADD COLUMN unlocked_at TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- 5. Create profile_views table (preserving existing data)
CREATE TABLE IF NOT EXISTS profile_views (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    viewer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    viewed_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    viewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ip_address TEXT,
    user_agent TEXT
);

-- Add columns if they don't exist (for existing tables)
DO $$
BEGIN
    -- Add ip_address column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profile_views' AND column_name = 'ip_address') THEN
        ALTER TABLE profile_views ADD COLUMN ip_address TEXT;
    END IF;

    -- Add user_agent column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profile_views' AND column_name = 'user_agent') THEN
        ALTER TABLE profile_views ADD COLUMN user_agent TEXT;
    END IF;
END $$;

-- 6. Create referral_campaigns table (optional)
CREATE TABLE IF NOT EXISTS referral_campaigns (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    referrals_required INTEGER DEFAULT 5,
    reward_feature premium_feature DEFAULT 'profile_views',
    is_active BOOLEAN DEFAULT true,
    start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    end_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_referral_codes_user_id ON referral_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_referral_codes_code ON referral_codes(referral_code);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer_id ON referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_code ON referrals(referral_code);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON referrals(status);
CREATE INDEX IF NOT EXISTS idx_user_premium_features_user_id ON user_premium_features(user_id);
CREATE INDEX IF NOT EXISTS idx_profile_views_viewer_id ON profile_views(viewer_id);
CREATE INDEX IF NOT EXISTS idx_profile_views_viewed_profile_id ON profile_views(viewed_profile_id);

-- Create index for profile views performance
-- Note: We'll handle duplicate prevention in the application layer
CREATE INDEX IF NOT EXISTS idx_profile_views_daily
ON profile_views(viewer_id, viewed_profile_id, viewed_at);

-- 8. Drop existing objects first to avoid conflicts (preserving other features)
-- Drop views first (they may depend on functions)
DROP VIEW IF EXISTS referral_dashboard;
DROP VIEW IF EXISTS profile_view_history;

-- Drop triggers first (they depend on functions)
DROP TRIGGER IF EXISTS trigger_create_referral_code ON profiles;
DROP TRIGGER IF EXISTS trigger_update_referral_progress ON referrals;
DROP TRIGGER IF EXISTS trigger_insert_referral_progress ON referrals;

-- Drop functions
DROP FUNCTION IF EXISTS generate_referral_code(TEXT);
DROP FUNCTION IF EXISTS create_user_referral_code();
DROP FUNCTION IF EXISTS update_referral_progress();
DROP FUNCTION IF EXISTS can_view_profile_visitors(UUID);
DROP FUNCTION IF EXISTS track_profile_view(UUID, UUID);

-- 9. Create referral code generation function
CREATE OR REPLACE FUNCTION generate_referral_code(username TEXT)
RETURNS TEXT AS $$
DECLARE
    clean_username TEXT;
    base_code TEXT;
    final_code TEXT;
    counter INTEGER := 0;
BEGIN
    -- Clean username: remove special characters, take first 6 chars, uppercase
    clean_username := UPPER(REGEXP_REPLACE(username, '[^a-zA-Z0-9]', '', 'g'));
    base_code := SUBSTRING(clean_username FROM 1 FOR 6);
    
    -- Pad with zeros if needed
    IF LENGTH(base_code) < 6 THEN
        base_code := RPAD(base_code, 6, '0');
    END IF;
    
    -- Try to find a unique code
    LOOP
        IF counter = 0 THEN
            final_code := base_code || LPAD((RANDOM() * 999)::INTEGER::TEXT, 3, '0');
        ELSE
            final_code := base_code || LPAD(counter::TEXT, 3, '0');
        END IF;
        
        -- Check if code already exists
        IF NOT EXISTS (SELECT 1 FROM referral_codes WHERE referral_code = final_code) THEN
            RETURN final_code;
        END IF;
        
        counter := counter + 1;
        
        -- Prevent infinite loop
        IF counter > 999 THEN
            RAISE EXCEPTION 'Unable to generate unique referral code for username: %', username;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 10. Create trigger function for automatic referral code creation
CREATE OR REPLACE FUNCTION create_user_referral_code()
RETURNS TRIGGER AS $$
BEGIN
    -- Create referral code for new user
    INSERT INTO referral_codes (user_id, referral_code, is_active)
    VALUES (NEW.id, generate_referral_code(NEW.username), true);
    
    -- Create premium features record
    INSERT INTO user_premium_features (user_id, feature, referrals_required, referrals_completed, is_active)
    VALUES (NEW.id, 'profile_views', 5, 0, false)
    ON CONFLICT (user_id, feature) DO NOTHING;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 11. Create trigger function for referral progress tracking
CREATE OR REPLACE FUNCTION update_referral_progress()
RETURNS TRIGGER AS $$
DECLARE
    completed_referrals INTEGER;
BEGIN
    -- Process when status is 'completed' and either:
    -- 1. This is an INSERT (OLD is NULL)
    -- 2. This is an UPDATE where status changed to 'completed'
    IF NEW.status = 'completed' AND (OLD IS NULL OR OLD.status != 'completed') THEN
        
        -- Count completed referrals for this user
        SELECT COUNT(*) INTO completed_referrals
        FROM referrals 
        WHERE referrer_id = NEW.referrer_id AND status = 'completed';
        
        -- Update user premium features
        UPDATE user_premium_features 
        SET 
            referrals_completed = completed_referrals,
            is_active = CASE WHEN completed_referrals >= referrals_required THEN true ELSE false END,
            unlocked_at = CASE 
                WHEN completed_referrals >= referrals_required AND unlocked_at IS NULL 
                THEN NOW() 
                ELSE unlocked_at 
            END,
            updated_at = NOW()
        WHERE user_id = NEW.referrer_id AND feature = 'profile_views';
        
        -- Log the update
        RAISE NOTICE 'Updated referral progress for user %, completed referrals: %', NEW.referrer_id, completed_referrals;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 12. Create premium access check function
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

-- 13. Create function to safely track profile views (prevents duplicates)
CREATE OR REPLACE FUNCTION track_profile_view(p_viewer_id UUID, p_viewed_profile_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    view_exists BOOLEAN := false;
BEGIN
    -- Don't track if viewing own profile
    IF p_viewer_id = p_viewed_profile_id THEN
        RETURN false;
    END IF;

    -- Check if view already exists today
    SELECT EXISTS(
        SELECT 1 FROM profile_views
        WHERE viewer_id = p_viewer_id
        AND viewed_profile_id = p_viewed_profile_id
        AND viewed_at::date = CURRENT_DATE
    ) INTO view_exists;

    -- Insert only if not already viewed today
    IF NOT view_exists THEN
        INSERT INTO profile_views (viewer_id, viewed_profile_id, viewed_at)
        VALUES (p_viewer_id, p_viewed_profile_id, NOW());
        RETURN true;
    END IF;

    RETURN false;
END;
$$ LANGUAGE plpgsql;

-- 14. Create triggers
-- Trigger for automatic referral code creation
DROP TRIGGER IF EXISTS trigger_create_referral_code ON profiles;
CREATE TRIGGER trigger_create_referral_code
    AFTER INSERT ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION create_user_referral_code();

-- Trigger for referral progress tracking (UPDATE)
DROP TRIGGER IF EXISTS trigger_update_referral_progress ON referrals;
CREATE TRIGGER trigger_update_referral_progress
    AFTER UPDATE OF status ON referrals
    FOR EACH ROW
    EXECUTE FUNCTION update_referral_progress();

-- Trigger for referral progress tracking (INSERT)
DROP TRIGGER IF EXISTS trigger_insert_referral_progress ON referrals;
CREATE TRIGGER trigger_insert_referral_progress
    AFTER INSERT ON referrals
    FOR EACH ROW
    EXECUTE FUNCTION update_referral_progress();

-- 15. Create views for easy data access
CREATE OR REPLACE VIEW referral_dashboard AS
SELECT 
    p.id as user_id,
    p.username,
    rc.referral_code,
    upf.is_active as has_premium,
    upf.referrals_completed,
    upf.referrals_required,
    ROUND((upf.referrals_completed::DECIMAL / upf.referrals_required::DECIMAL) * 100, 1) as progress_percentage,
    upf.unlocked_at,
    (SELECT COUNT(*) FROM referrals r WHERE r.referrer_id = p.id) as total_referrals,
    -- Cap pending referrals at 0 after 5 completions (premium unlocked)
    CASE 
        WHEN upf.referrals_completed >= 5 
        THEN 0 
        ELSE (SELECT COUNT(*) FROM referrals r WHERE r.referrer_id = p.id AND r.status = 'pending') 
    END as pending_referrals,
    -- Show all referrals as completed after premium unlock
    CASE 
        WHEN upf.referrals_completed >= 5 
        THEN (SELECT COUNT(*) FROM referrals r WHERE r.referrer_id = p.id) 
        ELSE (SELECT COUNT(*) FROM referrals r WHERE r.referrer_id = p.id AND r.status = 'completed') 
    END as completed_referrals
FROM profiles p
LEFT JOIN referral_codes rc ON p.id = rc.user_id AND rc.is_active = true
LEFT JOIN user_premium_features upf ON p.id = upf.user_id AND upf.feature = 'profile_views';

CREATE OR REPLACE VIEW profile_view_history AS
SELECT
    pv.id,
    pv.viewer_id,
    viewer.username as viewer_username,
    viewer.avatar_url as viewer_avatar,
    pv.viewed_profile_id as profile_owner_id,
    owner.username as profile_owner_username,
    pv.viewed_at,
    pv.ip_address
FROM profile_views pv
JOIN profiles viewer ON pv.viewer_id = viewer.id
JOIN profiles owner ON pv.viewed_profile_id = owner.id
ORDER BY pv.viewed_at DESC;

-- 16. Enable Row Level Security (RLS)
ALTER TABLE referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_premium_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_views ENABLE ROW LEVEL SECURITY;

-- 17. Create RLS policies
-- Referral codes: users can only see their own
CREATE POLICY "Users can view own referral codes" ON referral_codes
    FOR SELECT USING (auth.uid() = user_id);

-- Referrals: users can see referrals they made
CREATE POLICY "Users can view own referrals" ON referrals
    FOR SELECT USING (auth.uid() = referrer_id);

-- Premium features: users can see their own features
CREATE POLICY "Users can view own premium features" ON user_premium_features
    FOR SELECT USING (auth.uid() = user_id);

-- Profile views: users can see views of their profile if they have premium
CREATE POLICY "Users can view profile views if premium" ON profile_views
    FOR SELECT USING (
        auth.uid() = viewed_profile_id AND 
        can_view_profile_visitors(auth.uid())
    );

-- =====================================================
-- SETUP COMPLETE!
-- =====================================================

-- Insert a default campaign (optional)
INSERT INTO referral_campaigns (name, description, referrals_required, reward_feature, is_active)
VALUES (
    'Launch Campaign', 
    'Invite 5 friends to unlock Profile Views', 
    5, 
    'profile_views', 
    true
) ON CONFLICT DO NOTHING;

-- Success message
SELECT '✅ Referral system setup complete! All tables, functions, triggers, and views created successfully.' as status;
