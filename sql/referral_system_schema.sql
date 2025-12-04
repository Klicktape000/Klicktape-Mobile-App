-- =====================================================
-- KLICKTAPE REFERRAL PROGRAMME DATABASE SCHEMA
-- Implements complete referral system with Profile Views reward
-- =====================================================

-- Create enum for referral status
CREATE TYPE referral_status AS ENUM (
    'pending',      -- Link shared but not yet signed up
    'registered',   -- User registered but not verified
    'completed',    -- Fully verified and counted
    'invalid'       -- Duplicate or fraudulent
);

-- Create enum for premium features
CREATE TYPE premium_feature AS ENUM (
    'profile_views',
    'advanced_analytics',
    'priority_support',
    'custom_themes'
);

-- Referral codes table - stores unique referral codes for each user
CREATE TABLE referral_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    referral_code VARCHAR(20) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true,
    
    -- Indexes
    CONSTRAINT unique_user_referral UNIQUE(user_id)
);

-- Referrals table - tracks all referral attempts and their status
CREATE TABLE referrals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referrer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    referred_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    referral_code VARCHAR(20) NOT NULL REFERENCES referral_codes(referral_code),
    
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
CREATE TABLE user_premium_features (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    feature premium_feature NOT NULL,
    
    -- How they unlocked it
    unlocked_via VARCHAR(50) DEFAULT 'referral', -- 'referral', 'purchase', 'promotion'
    referrals_required INTEGER DEFAULT 5,
    referrals_completed INTEGER DEFAULT 0,
    
    -- Status
    is_active BOOLEAN DEFAULT false,
    unlocked_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE, -- NULL for permanent
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT unique_user_feature UNIQUE(user_id, feature)
);

-- Profile views tracking - stores who viewed whose profile
CREATE TABLE profile_views (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    viewer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    viewed_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    
    -- Privacy settings
    is_anonymous BOOLEAN DEFAULT false, -- If viewer wants to browse privately
    
    -- Timestamps
    viewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Prevent self-views and duplicates within short time
    CONSTRAINT no_self_view CHECK (viewer_id != viewed_profile_id)
);

-- Referral campaigns (optional - for future A/B testing)
CREATE TABLE referral_campaigns (
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

-- Referral codes indexes
CREATE INDEX idx_referral_codes_user_id ON referral_codes(user_id);
CREATE INDEX idx_referral_codes_code ON referral_codes(referral_code);

-- Referrals indexes
CREATE INDEX idx_referrals_referrer_id ON referrals(referrer_id);
CREATE INDEX idx_referrals_referred_user_id ON referrals(referred_user_id);
CREATE INDEX idx_referrals_status ON referrals(status);
CREATE INDEX idx_referrals_created_at ON referrals(created_at);

-- Premium features indexes
CREATE INDEX idx_user_premium_features_user_id ON user_premium_features(user_id);
CREATE INDEX idx_user_premium_features_feature ON user_premium_features(feature);
CREATE INDEX idx_user_premium_features_active ON user_premium_features(is_active);

-- Profile views indexes
CREATE INDEX idx_profile_views_viewer_id ON profile_views(viewer_id);
CREATE INDEX idx_profile_views_viewed_profile_id ON profile_views(viewed_profile_id);
CREATE INDEX idx_profile_views_viewed_at ON profile_views(viewed_at);

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
    VALUES (NEW.id, new_code);
    
    -- Initialize profile views feature tracking
    INSERT INTO user_premium_features (user_id, feature, referrals_required, referrals_completed)
    VALUES (NEW.id, 'profile_views', 5, 0);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to create referral code when user registers
CREATE TRIGGER trigger_create_referral_code
    AFTER INSERT ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION create_user_referral_code();

-- Function to update referral progress
CREATE OR REPLACE FUNCTION update_referral_progress()
RETURNS TRIGGER AS $$
DECLARE
    referrer_record RECORD;
    completed_referrals INTEGER;
BEGIN
    -- Only process when status changes to 'completed'
    IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
        
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
        
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update referral progress
CREATE TRIGGER trigger_update_referral_progress
    AFTER UPDATE OF status ON referrals
    FOR EACH ROW
    EXECUTE FUNCTION update_referral_progress();

-- Function to track profile views (only for premium users)
CREATE OR REPLACE FUNCTION can_view_profile_visitors(user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    has_premium BOOLEAN := false;
BEGIN
    SELECT is_active INTO has_premium
    FROM user_premium_features 
    WHERE user_id = can_view_profile_visitors.user_id 
    AND feature = 'profile_views';
    
    RETURN COALESCE(has_premium, false);
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- VIEWS FOR EASY DATA ACCESS
-- =====================================================

-- View for referral dashboard
CREATE VIEW referral_dashboard AS
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
        -- Cap pending referrals at 0 after 5 completions (premium unlocked)
        CASE 
            WHEN (SELECT referrals_completed FROM user_premium_features WHERE user_id = referrer_id AND feature = 'profile_views') >= 5 
            THEN 0 
            ELSE COUNT(*) FILTER (WHERE status = 'pending') 
        END as pending_referrals,
        -- Show all referrals as completed after premium unlock
        CASE 
            WHEN (SELECT referrals_completed FROM user_premium_features WHERE user_id = referrer_id AND feature = 'profile_views') >= 5 
            THEN COUNT(*) 
            ELSE COUNT(*) FILTER (WHERE status = 'completed') 
        END as completed_referrals
    FROM referrals 
    GROUP BY referrer_id
) stats ON p.id = stats.referrer_id;

-- View for profile views (only for premium users)
CREATE VIEW profile_view_history AS
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

-- Grant permissions
GRANT SELECT ON referral_dashboard TO authenticated;
GRANT SELECT ON profile_view_history TO authenticated;
GRANT SELECT, INSERT, UPDATE ON referral_codes TO authenticated;
GRANT SELECT, INSERT, UPDATE ON referrals TO authenticated;
GRANT SELECT, INSERT, UPDATE ON user_premium_features TO authenticated;
GRANT SELECT, INSERT ON profile_views TO authenticated;

-- =====================================================
-- INITIAL DATA AND VERIFICATION
-- =====================================================

SELECT 'Referral system schema created successfully!' as status;
SELECT 'Tables created: referral_codes, referrals, user_premium_features, profile_views' as tables_info;
SELECT 'Views created: referral_dashboard, profile_view_history' as views_info;
SELECT 'Functions created: generate_referral_code, can_view_profile_visitors' as functions_info;
