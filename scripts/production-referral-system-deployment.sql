-- =====================================================
-- KLICKTAPE REFERRAL PROGRAMME - PRODUCTION DEPLOYMENT
-- Complete referral system with Profile Views premium feature
-- =====================================================

-- Create enum for referral status
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'referral_status') THEN
        CREATE TYPE referral_status AS ENUM (
            'pending',      -- Link shared but not yet signed up
            'registered',   -- User registered but not verified
            'completed',    -- Fully verified and counted
            'invalid'       -- Duplicate or fraudulent
        );
    END IF;
END $$;

-- Create enum for premium features
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'premium_feature') THEN
        CREATE TYPE premium_feature AS ENUM (
            'profile_views',
            'advanced_analytics',
            'priority_support',
            'custom_themes'
        );
    END IF;
END $$;

-- Referral codes table - stores unique referral codes for each user
CREATE TABLE IF NOT EXISTS referral_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    referral_code VARCHAR(20) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true,
    
    -- Constraints
    CONSTRAINT unique_user_referral UNIQUE(user_id)
);

-- Referrals table - tracks all referral attempts and their status
CREATE TABLE IF NOT EXISTS referrals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referrer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    referred_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    referral_code VARCHAR(20) NOT NULL,
    
    -- Tracking information
    status referral_status DEFAULT 'pending',
    referred_email VARCHAR(255),
    referred_phone VARCHAR(20),
    ip_address INET,
    user_agent TEXT,
    
    -- Timestamps
    link_clicked_at TIMESTAMP WITH TIME ZONE,
    registered_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Validation
    is_valid BOOLEAN DEFAULT true,
    validation_notes TEXT
);

-- User premium features - tracks which premium features users have unlocked
CREATE TABLE IF NOT EXISTS user_premium_features (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    feature premium_feature NOT NULL,
    
    -- How they unlocked it
    unlocked_via VARCHAR(50) DEFAULT 'referral',
    referrals_required INTEGER DEFAULT 5,
    referrals_completed INTEGER DEFAULT 0,
    
    -- Status
    is_active BOOLEAN DEFAULT false,
    unlocked_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT unique_user_feature UNIQUE(user_id, feature)
);

-- Profile views tracking - stores who viewed whose profile
CREATE TABLE IF NOT EXISTS profile_views (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    viewer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    viewed_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    
    -- Privacy settings
    is_anonymous BOOLEAN DEFAULT false,
    
    -- Timestamps
    viewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Prevent self-views
    CONSTRAINT no_self_view CHECK (viewer_id != viewed_profile_id)
);

-- Referral campaigns (optional - for future A/B testing)
CREATE TABLE IF NOT EXISTS referral_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    
    -- Campaign settings
    referrals_required INTEGER DEFAULT 5,
    reward_feature premium_feature DEFAULT 'profile_views',
    
    -- Timing
    start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    end_date TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Create indexes if they don't exist
DO $$ 
BEGIN
    -- Referral codes indexes
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_referral_codes_user_id') THEN
        CREATE INDEX idx_referral_codes_user_id ON referral_codes(user_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_referral_codes_code') THEN
        CREATE INDEX idx_referral_codes_code ON referral_codes(referral_code);
    END IF;
    
    -- Referrals indexes
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_referrals_referrer_id') THEN
        CREATE INDEX idx_referrals_referrer_id ON referrals(referrer_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_referrals_referred_user_id') THEN
        CREATE INDEX idx_referrals_referred_user_id ON referrals(referred_user_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_referrals_status') THEN
        CREATE INDEX idx_referrals_status ON referrals(status);
    END IF;
    
    -- Premium features indexes
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_user_premium_features_user_id') THEN
        CREATE INDEX idx_user_premium_features_user_id ON user_premium_features(user_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_user_premium_features_feature') THEN
        CREATE INDEX idx_user_premium_features_feature ON user_premium_features(feature);
    END IF;
    
    -- Profile views indexes
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_profile_views_viewer_id') THEN
        CREATE INDEX idx_profile_views_viewer_id ON profile_views(viewer_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_profile_views_viewed_profile_id') THEN
        CREATE INDEX idx_profile_views_viewed_profile_id ON profile_views(viewed_profile_id);
    END IF;
END $$;

-- =====================================================
-- FUNCTIONS AND TRIGGERS
-- =====================================================

-- Function to generate unique referral code
CREATE OR REPLACE FUNCTION generate_referral_code(username TEXT)
RETURNS TEXT AS $$
DECLARE
    base_code TEXT;
    final_code TEXT;
    counter INTEGER := 0;
BEGIN
    -- Create base code from username (first 6 chars + random number)
    base_code := UPPER(LEFT(REGEXP_REPLACE(username, '[^a-zA-Z0-9]', '', 'g'), 6));
    
    LOOP
        IF counter = 0 THEN
            final_code := base_code || LPAD((RANDOM() * 999)::INTEGER::TEXT, 3, '0');
        ELSE
            final_code := base_code || LPAD((RANDOM() * 9999)::INTEGER::TEXT, 4, '0');
        END IF;
        
        -- Check if code already exists
        IF NOT EXISTS (SELECT 1 FROM referral_codes WHERE referral_code = final_code) THEN
            RETURN final_code;
        END IF;
        
        counter := counter + 1;
        IF counter > 10 THEN
            -- Fallback to completely random code
            final_code := 'KT' || LPAD((RANDOM() * 999999)::INTEGER::TEXT, 6, '0');
            EXIT;
        END IF;
    END LOOP;
    
    RETURN final_code;
END;
$$ LANGUAGE plpgsql;

-- Function to create referral code for new users
CREATE OR REPLACE FUNCTION create_user_referral_code()
RETURNS TRIGGER AS $$
DECLARE
    new_code TEXT;
BEGIN
    -- Generate unique referral code
    new_code := generate_referral_code(NEW.username);
    
    -- Insert referral code
    INSERT INTO referral_codes (user_id, referral_code)
    VALUES (NEW.id, new_code)
    ON CONFLICT (user_id) DO NOTHING;
    
    -- Initialize profile views feature tracking
    INSERT INTO user_premium_features (user_id, feature, referrals_required, referrals_completed)
    VALUES (NEW.id, 'profile_views', 5, 0)
    ON CONFLICT (user_id, feature) DO NOTHING;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for new users (only if it doesn't exist)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_create_referral_code') THEN
        CREATE TRIGGER trigger_create_referral_code
            AFTER INSERT ON profiles
            FOR EACH ROW
            EXECUTE FUNCTION create_user_referral_code();
    END IF;
END $$;

-- Function to update referral progress
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

    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for referral progress (only if they don't exist)
DO $$
BEGIN
    -- UPDATE trigger
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_update_referral_progress') THEN
        CREATE TRIGGER trigger_update_referral_progress
            AFTER UPDATE OF status ON referrals
            FOR EACH ROW
            EXECUTE FUNCTION update_referral_progress();
    END IF;

    -- INSERT trigger
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_insert_referral_progress') THEN
        CREATE TRIGGER trigger_insert_referral_progress
            AFTER INSERT ON referrals
            FOR EACH ROW
            EXECUTE FUNCTION update_referral_progress();
    END IF;
END $$;

-- Function to check if user can view profile visitors
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

-- =====================================================
-- VIEWS FOR EASY DATA ACCESS
-- =====================================================

-- View for referral dashboard
CREATE OR REPLACE VIEW referral_dashboard AS
SELECT 
    p.id as user_id,
    p.username,
    rc.referral_code,
    upf.referrals_completed,
    upf.referrals_required,
    upf.is_active as has_premium,
    upf.unlocked_at,
    
    -- Referral stats
    COALESCE(stats.total_referrals, 0) as total_referrals,
    COALESCE(stats.pending_referrals, 0) as pending_referrals,
    COALESCE(stats.completed_referrals, 0) as completed_referrals,
    
    -- Progress
    CASE 
        WHEN upf.referrals_required > 0 
        THEN ROUND((upf.referrals_completed::DECIMAL / upf.referrals_required) * 100, 1)
        ELSE 0 
    END as progress_percentage
    
FROM profiles p
LEFT JOIN referral_codes rc ON p.id = rc.user_id
LEFT JOIN user_premium_features upf ON p.id = upf.user_id AND upf.feature = 'profile_views'
LEFT JOIN (
    SELECT 
        referrer_id,
        COUNT(*) as total_referrals,
        COUNT(*) FILTER (WHERE status = 'pending') as pending_referrals,
        COUNT(*) FILTER (WHERE status = 'completed') as completed_referrals
    FROM referrals 
    GROUP BY referrer_id
) stats ON p.id = stats.referrer_id;

-- View for profile views (only for premium users)
CREATE OR REPLACE VIEW profile_view_history AS
SELECT 
    pv.id,
    pv.viewed_profile_id as profile_owner_id,
    pv.viewer_id,
    viewer.username as viewer_username,
    viewer.avatar_url as viewer_avatar,
    pv.viewed_at,
    pv.is_anonymous
FROM profile_views pv
JOIN profiles viewer ON pv.viewer_id = viewer.id
WHERE NOT pv.is_anonymous
ORDER BY pv.viewed_at DESC;

-- =====================================================
-- INITIALIZE EXISTING USERS
-- =====================================================

-- Create referral codes for existing users who don't have them
INSERT INTO referral_codes (user_id, referral_code)
SELECT 
    p.id,
    generate_referral_code(p.username)
FROM profiles p
WHERE NOT EXISTS (
    SELECT 1 FROM referral_codes rc WHERE rc.user_id = p.id
);

-- Initialize premium features for existing users
INSERT INTO user_premium_features (user_id, feature, referrals_required, referrals_completed)
SELECT 
    p.id,
    'profile_views',
    5,
    0
FROM profiles p
WHERE NOT EXISTS (
    SELECT 1 FROM user_premium_features upf 
    WHERE upf.user_id = p.id AND upf.feature = 'profile_views'
);

-- =====================================================
-- PERMISSIONS
-- =====================================================

-- Grant permissions to authenticated users
GRANT SELECT ON referral_dashboard TO authenticated;
GRANT SELECT ON profile_view_history TO authenticated;
GRANT SELECT, INSERT, UPDATE ON referral_codes TO authenticated;
GRANT SELECT, INSERT, UPDATE ON referrals TO authenticated;
GRANT SELECT, INSERT, UPDATE ON user_premium_features TO authenticated;
GRANT SELECT, INSERT ON profile_views TO authenticated;
GRANT SELECT ON referral_campaigns TO authenticated;

-- =====================================================
-- VERIFICATION
-- =====================================================

SELECT '🎉 REFERRAL SYSTEM DEPLOYMENT COMPLETED! 🎉' as status;

-- Verify tables exist
SELECT 'Tables created:' as info;
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND (table_name LIKE '%referral%' OR table_name LIKE '%profile_view%' OR table_name = 'user_premium_features')
ORDER BY table_name;

-- Verify enums exist
SELECT 'Enums created:' as info;
SELECT typname FROM pg_type WHERE typname IN ('referral_status', 'premium_feature');

-- Verify functions exist
SELECT 'Functions created:' as info;
SELECT proname FROM pg_proc WHERE proname IN ('generate_referral_code', 'create_user_referral_code', 'update_referral_progress', 'can_view_profile_visitors');

-- Verify views exist
SELECT 'Views created:' as info;
SELECT viewname FROM pg_views WHERE viewname IN ('referral_dashboard', 'profile_view_history');

-- Show sample referral codes for existing users
SELECT 'Sample referral codes:' as info;
SELECT p.username, rc.referral_code 
FROM profiles p 
JOIN referral_codes rc ON p.id = rc.user_id 
LIMIT 5;

SELECT '✅ Referral Programme ready for KlickTape users!' as final_status;
SELECT '🔗 Users can now invite friends to unlock Profile Views!' as feature_status;
