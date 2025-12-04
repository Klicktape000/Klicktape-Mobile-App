// =====================================================
// KLICKTAPE REFERRAL API
// Complete API for referral system and profile views
// =====================================================

import { supabase } from './supabase';

// =====================================================
// TYPES AND INTERFACES
// =====================================================

export type ReferralStatus = 'pending' | 'registered' | 'completed' | 'invalid';
export type PremiumFeature = 'profile_views' | 'advanced_analytics' | 'priority_support' | 'custom_themes';

export interface ReferralCode {
  id: string;
  user_id: string;
  referral_code: string;
  created_at: string;
  is_active: boolean;
}

export interface Referral {
  id: string;
  referrer_id: string;
  referred_user_id?: string;
  referral_code: string;
  status: ReferralStatus;
  referred_email?: string;
  referred_phone?: string;
  link_clicked_at?: string;
  registered_at?: string;
  completed_at?: string;
  created_at: string;
  is_valid: boolean;
}

export interface UserPremiumFeature {
  id: string;
  user_id: string;
  feature: PremiumFeature;
  unlocked_via: string;
  referrals_required: number;
  referrals_completed: number;
  is_active: boolean;
  unlocked_at?: string;
  expires_at?: string;
}

export interface ReferralDashboard {
  user_id: string;
  username: string;
  referral_code: string;
  referrals_completed: number;
  referrals_required: number;
  has_premium: boolean;
  unlocked_at?: string;
  total_referrals: number;
  pending_referrals: number;
  completed_referrals: number;
  progress_percentage: number;
}

export interface ProfileView {
  id: string;
  viewer_id: string;
  viewed_profile_id: string;
  viewer_username: string;
  viewer_avatar?: string;
  viewed_at: string;
  is_anonymous: boolean;
}

// =====================================================
// REFERRAL API FUNCTIONS
// =====================================================

export const referralAPI = {
  
  /**
   * Get user's referral dashboard data - OPTIMIZED
   */
  getReferralDashboard: async (userId: string): Promise<ReferralDashboard | null> => {
    try {
      // OPTIMIZED: Build dashboard data directly instead of using slow view
      const [codeData, referralsData, premiumData, profileData] = await Promise.all([
        supabase.from('referral_codes').select('referral_code').eq('user_id', userId).eq('is_active', true).single(),
        supabase.from('referrals').select('status').eq('referrer_id', userId),
        supabase.from('user_premium_features').select('is_active, unlocked_at, referrals_completed, referrals_required').eq('user_id', userId).eq('feature', 'profile_views').single(),
        supabase.from('profiles').select('username').eq('id', userId).single()
      ]);

      if (!codeData.data) {
        return null;
      }

      const referrals = (referralsData.data || []) as any[];
      const completed = referrals.filter((r: any) => r.status === 'completed').length;
      const pending = referrals.filter((r: any) => r.status === 'pending').length;
      const total = referrals.length;
      
      const premium = premiumData.data || { is_active: false, referrals_completed: 0, referrals_required: 5 };
      const required = (premium as any).referrals_required || 5;
      const completedCount = (premium as any).referrals_completed || completed;
      const progress = Math.min(Math.round((completedCount / required) * 100), 100);

      const refCode = (codeData as any).data?.referral_code || '';

      return {
        user_id: userId,
        username: (profileData.data as any)?.username || 'User',
        referral_code: refCode,
        referrals_completed: completedCount,
        referrals_required: required,
        has_premium: (premium as any).is_active || false,
        unlocked_at: (premium as any).unlocked_at,
        total_referrals: total,
        pending_referrals: pending,
        completed_referrals: completed,
        progress_percentage: progress
      };
    } catch (__error) {
      console.error('Error in getReferralDashboard:', __error);
      return null;
    }
  },

  /**
   * Get user's referral code (creates one if it doesn't exist)
   */
  getUserReferralCode: async (userId: string): Promise<string | null> => {
    try {
      // First, try to get existing referral code
      const { data, error } = await supabase
        .from('referral_codes')
        .select('referral_code')
        .eq('user_id', userId)
        .eq('is_active', true)
        .single();

      if (data && (data as any).referral_code) {
        return (data as any).referral_code;
      }

      // If no referral code exists, create one
      if (error?.code === 'PGRST116') { // No rows returned
// console.log('No referral code found, creating one for user:', userId);

        // Get user's username for code generation
        const { data: profile } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', userId)
          .single();

        if (!profile || !(profile as any).username) {
          // User profile not found
          return null;
        }

        // Generate a referral code using fallback method
        const generatedCode = referralUtils.generateFallbackCode((profile as any).username);
// console.log('Generated referral code:', generatedCode);

        // Insert the new referral code
        const { data: insertData, error: insertError } = await supabase
          .from('referral_codes')
          .insert({
            user_id: userId,
            referral_code: generatedCode,
            is_active: true
          } as any)
          .select('referral_code')
          .single();

        if (insertError) {
          // Error inserting referral code
          return generatedCode; // Return the generated code even if insert fails
        }

        // Also ensure user has premium features record
        try {
          await supabase
            .from('user_premium_features')
            .insert({
              user_id: userId,
              feature: 'profile_views',
              referrals_required: 5,
              referrals_completed: 0,
              is_active: false
            } as any);
        } catch (__premiumError) {
          // Ignore if already exists (conflict error)
// console.log('Premium features record may already exist');
        }

        return (insertData as any)?.referral_code || generatedCode;
      }

      // Error fetching referral code
      return null;
    } catch (__error) {
      // Error in getUserReferralCode
      return null;
    }
  },

  /**
   * Generate referral link
   */
  generateReferralLink: async (userId: string): Promise<string | null> => {
    try {
      const referralCode = await referralAPI.getUserReferralCode(userId);
      if (!referralCode) return null;

      // You can customize this URL based on your app's deep linking setup
      return `https://klicktape.com/invite/${referralCode}`;
    } catch (__error) {
      console.error('Error generating referral link:', __error);
      return null;
    }
  },

  /**
   * Track referral link click
   */
  trackReferralClick: async (referralCode: string, metadata?: {
    ip_address?: string;
    user_agent?: string;
    referred_email?: string;
  }): Promise<boolean> => {
    try {
      // Get referrer info
      const { data: codeData, error: codeError } = await supabase
        .from('referral_codes')
        .select('user_id')
        .eq('referral_code', referralCode)
        .eq('is_active', true)
        .single();

      if (codeError || !codeData) {
        console.error('Invalid referral code:', referralCode);
        return false;
      }

      // Create referral tracking record
      const { error } = await (supabase as any)
        .from('referrals')
        .insert({
          referrer_id: (codeData as any).user_id,
          referral_code: referralCode,
          status: 'pending',
          link_clicked_at: new Date().toISOString(),
          ip_address: metadata?.ip_address,
          user_agent: metadata?.user_agent,
          referred_email: metadata?.referred_email
        });

      if (error) {
        console.error('Error tracking referral click:', error);
        return false;
      }

      return true;
    } catch (__error) {
      console.error('Error in trackReferralClick:', __error);
      return false;
    }
  },

  /**
   * Validate referral code
   */
  validateReferralCode: async (referralCode: string, currentUserId?: string): Promise<{
    isValid: boolean;
    error?: string;
    referrerInfo?: { username: string; user_id: string };
  }> => {
    try {
      if (!referralCode || referralCode.trim().length === 0) {
        return { isValid: false, error: 'Referral code cannot be empty' };
      }

      const cleanCode = referralCode.trim().toUpperCase();

      // Check if referral code format is valid
      if (!referralUtils.isValidReferralCode(cleanCode)) {
        return { isValid: false, error: 'Invalid referral code format' };
      }

      // Check if referral code exists and is active
      const { data: codeData, error: codeError } = await supabase
        .from('referral_codes')
        .select('user_id, is_active')
        .eq('referral_code', cleanCode)
        .eq('is_active', true)
        .single();

      if (codeError || !codeData) {
        console.error('Referral code validation error:', codeError);
        return { isValid: false, error: 'Referral code not found or inactive' };
      }

      // Get the username separately
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', (codeData as any).user_id)
        .single();

      if (profileError || !profileData) {
        console.error('Profile lookup error:', profileError);
        return { isValid: false, error: 'Referral code owner not found' };
      }

      // Prevent self-referral
      if (currentUserId && (codeData as any).user_id === currentUserId) {
        return { isValid: false, error: 'You cannot use your own referral code' };
      }

      return {
        isValid: true,
        referrerInfo: {
          username: (profileData as any).username,
          user_id: (codeData as any).user_id
        }
      };
    } catch (__error) {
      console.error('Error validating referral code:', __error);
      return { isValid: false, error: 'Failed to validate referral code' };
    }
  },

  /**
   * Complete referral when user registers
   */
  completeReferral: async (referralCode: string, newUserId: string): Promise<boolean> => {
    try {
      // First validate the referral code
      const validation = await referralAPI.validateReferralCode(referralCode, newUserId);
      if (!validation.isValid) {
        console.error('Invalid referral code during completion:', validation.error);
        return false;
      }

      // Update the most recent pending referral for this code
      const { error } = await (supabase as any)
        .from('referrals')
        .update({
          referred_user_id: newUserId,
          status: 'completed',
          registered_at: new Date().toISOString(),
          completed_at: new Date().toISOString()
        })
        .eq('referral_code', referralCode.trim().toUpperCase())
        .eq('status', 'pending')
        .is('referred_user_id', null)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) {
        console.error('Error completing referral:', error);
        return false;
      }

// console.log(`✅ Referral completed: ${referralCode} -> ${newUserId}`);
      return true;
    } catch (__error) {
      console.error('Error in completeReferral:', __error);
      return false;
    }
  },

  /**
   * Get user's referral history
   */
  getUserReferrals: async (userId: string): Promise<Referral[]> => {
    try {
      const { data, error } = await supabase
        .from('referrals')
        .select(`
          *,
          referred_user:profiles!referrals_referred_user_id_fkey(username, avatar_url)
        `)
        .eq('referrer_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching user referrals:', error);
        return [];
      }

      return data || [];
    } catch (__error) {
      console.error('Error in getUserReferrals:', __error);
      return [];
    }
  },

  /**
   * Check if user has premium feature
   * Only allows authenticated users to check their own premium features
   */
  hasPremiumFeature: async (userId: string, feature: PremiumFeature): Promise<boolean> => {
    try {
// console.log(`🔍 Checking premium feature: ${feature} for user: ${userId}`);
      
      // Basic validation - ensure userId is provided
      if (!userId) {
// console.log('🔐 No userId provided for premium feature check');
        return false;
      }
      
      const { data, error } = await supabase
        .from('user_premium_features')
        .select('is_active')
        .eq('user_id', userId)
        .eq('feature', feature)
        .single();

      if (error) {
        // PGRST116 means no rows returned - user doesn't have this premium feature record
        if (error.code === 'PGRST116') {
// console.log(`ℹ️ No premium feature record found for ${feature}, user does not have this feature`);
          return false;
        }
        // Only log non-PGRST116 errors
        console.error('❌ Error checking premium feature:', error);
        return false;
      }

      const hasFeature = (data as any)?.is_active || false;
// console.log(`✅ Premium feature ${feature} status:`, hasFeature);
      return hasFeature;
    } catch (__error) {
      // Check if it's a PGRST116 error in the catch block too
      if (__error && typeof __error === 'object' && 'code' in __error && __error.code === 'PGRST116') {
// console.log(`ℹ️ No premium feature record found for ${feature} (catch block), user does not have this feature`);
        return false;
      }
      console.error('❌ Error in hasPremiumFeature:', __error);
      return false;
    }
  },

  /**
   * Ensure premium feature record exists and is up-to-date based on referral count
   */
  ensurePremiumFeatureRecord: async (userId: string, feature: PremiumFeature = 'profile_views'): Promise<boolean> => {
    try {
// console.log('🔄 ensurePremiumFeatureRecord: Starting for userId:', userId, 'feature:', feature);
      
      // First, count the user's completed referrals
      const { data: referrals, error: referralError } = await supabase
        .from('referrals')
        .select('id')
        .eq('referrer_id', userId)
        .eq('status', 'completed');

      if (referralError) {
        console.error('Error counting referrals:', referralError);
        return false;
      }

      const completedReferrals = referrals?.length || 0;
      const requiredReferrals = 5; // Profile views requires 5 referrals
      const shouldBeActive = completedReferrals >= requiredReferrals;

// console.log('📊 Referral count:', {
// completedReferrals,
// requiredReferrals,
// shouldBeActive
// });

      // Check if record exists first to preserve unlocked_at timestamp
      const { data: existingRecord } = await supabase
        .from('user_premium_features')
        .select('unlocked_at')
        .eq('user_id', userId)
        .eq('feature', feature)
        .single();

      // Use upsert to handle both insert and update cases gracefully
      const { error: upsertError } = await (supabase as any)
        .from('user_premium_features')
        .upsert({
          user_id: userId,
          feature: feature,
          unlocked_via: 'referral',
          referrals_required: requiredReferrals,
          referrals_completed: completedReferrals,
          is_active: shouldBeActive,
          unlocked_at: shouldBeActive ? ((existingRecord as any)?.unlocked_at || new Date().toISOString()) : null,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,feature',
          ignoreDuplicates: false
        });

      if (upsertError) {
        console.error('Error upserting premium feature record:', upsertError);
        return false;
      }

      return shouldBeActive;
    } catch (__error) {
      console.error('Error in ensurePremiumFeatureRecord:', __error);
      return false;
    }
  }
};

// =====================================================
// PROFILE VIEWS API FUNCTIONS
// =====================================================

export const profileViewsAPI = {

  /**
   * Track a profile view - shows only the last visit for frequent visitors
   */
  trackProfileView: async (viewerId: string, viewedProfileId: string, isAnonymous: boolean = false): Promise<boolean> => {
    try {
      // Don't track self-views
      if (viewerId === viewedProfileId) return false;

      // Use UPSERT to update existing record or insert new one
      // This ensures only the LAST visit is stored for each viewer-viewed pair
      const { error } = await (supabase as any)
        .from('profile_views')
        .upsert({
          viewer_id: viewerId,
          viewed_profile_id: viewedProfileId,
          is_anonymous: isAnonymous,
          viewed_at: new Date().toISOString()
        }, {
          onConflict: 'viewer_id,viewed_profile_id',
          ignoreDuplicates: false // Always update the viewed_at timestamp
        });

      if (error) {
        console.error('Error tracking profile view:', error);
        return false;
      }

// console.log('Profile view tracked successfully');
      return true;
    } catch (__error) {
      console.error('Error in trackProfileView:', __error);
      return false;
    }
  },

  /**
   * Get who viewed user's profile (premium feature)
   */
  getProfileViewers: async (userId: string, limit: number = 50): Promise<ProfileView[]> => {
    try {
// console.log('getProfileViewers: Starting for userId:', userId);
      // Check if user has premium access
      const hasPremium = await referralAPI.hasPremiumFeature(userId, 'profile_views');
// console.log('getProfileViewers: Premium status:', hasPremium);
      if (!hasPremium) {
// console.log('getProfileViewers: User does not have premium access');
        return [];
      }

      const { data, error } = await supabase
        .from('profile_views')
        .select(`
          id,
          viewer_id,
          viewed_profile_id,
          viewed_at,
          is_anonymous,
          profiles!profile_views_viewer_id_fkey (
            username,
            name,
            avatar_url
          )
        `)
        .eq('viewed_profile_id', userId)
        .order('viewed_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error fetching profile viewers:', error);
        return [];
      }

      // Transform the data to match ProfileView interface
      const transformedData: ProfileView[] = (data || []).map((item: any) => ({
        id: item.id,
        viewer_id: item.viewer_id,
        viewed_profile_id: item.viewed_profile_id,
        viewer_username: item.profiles?.username || 'Unknown User',
        viewer_avatar: item.profiles?.avatar_url || '',
        viewed_at: item.viewed_at,
        is_anonymous: item.is_anonymous
      }));

      return transformedData;
    } catch (__error) {
      console.error('Error in getProfileViewers:', __error);
      return [];
    }
  },

  /**
   * Get profile view count for user
   */
  getProfileViewCount: async (userId: string, days: number = 30): Promise<number> => {
    try {
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

      const { count, error } = await supabase
        .from('profile_views')
        .select('*', { count: 'exact', head: true })
        .eq('viewed_profile_id', userId)
        .gte('viewed_at', startDate);

      if (error) {
        console.error('Error getting profile view count:', error);
        return 0;
      }

      return count || 0;
    } catch (__error) {
      console.error('Error in getProfileViewCount:', __error);
      return 0;
    }
  },

  /**
   * Get profile view analytics (premium feature)
   */
  getProfileViewAnalytics: async (userId: string): Promise<{
    total_views: number;
    views_today: number;
    views_this_week: number;
    views_this_month: number;
    unique_viewers: number;
  } | null> => {
    try {
// console.log('getProfileViewAnalytics: Starting for userId:', userId);
      // Check if user has premium access
      const hasPremium = await referralAPI.hasPremiumFeature(userId, 'profile_views');
// console.log('getProfileViewAnalytics: Premium status:', hasPremium);
      if (!hasPremium) {
// console.log('getProfileViewAnalytics: User does not have premium access');
        return null;
      }

      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

      // Get total views
      const { count: totalViews } = await supabase
        .from('profile_views')
        .select('*', { count: 'exact', head: true })
        .eq('viewed_profile_id', userId);

      // Get views today
      const { count: viewsToday } = await supabase
        .from('profile_views')
        .select('*', { count: 'exact', head: true })
        .eq('viewed_profile_id', userId)
        .gte('viewed_at', today);

      // Get views this week
      const { count: viewsThisWeek } = await supabase
        .from('profile_views')
        .select('*', { count: 'exact', head: true })
        .eq('viewed_profile_id', userId)
        .gte('viewed_at', weekAgo);

      // Get views this month
      const { count: viewsThisMonth } = await supabase
        .from('profile_views')
        .select('*', { count: 'exact', head: true })
        .eq('viewed_profile_id', userId)
        .gte('viewed_at', monthAgo);

      // Get unique viewers
      const { data: uniqueViewersData } = await supabase
        .from('profile_views')
        .select('viewer_id')
        .eq('viewed_profile_id', userId);

      const uniqueViewers = new Set(uniqueViewersData?.map((v: any) => v.viewer_id) || []).size;

      return {
        total_views: totalViews || 0,
        views_today: viewsToday || 0,
        views_this_week: viewsThisWeek || 0,
        views_this_month: viewsThisMonth || 0,
        unique_viewers: uniqueViewers
      };
    } catch (__error) {
      console.error('Error in getProfileViewAnalytics:', __error);
      return null;
    }
  }
};

// =====================================================
// UTILITY FUNCTIONS
// =====================================================

export const referralUtils = {

  /**
   * Generate fallback referral code when database function is not available
   */
  generateFallbackCode: (username: string): string => {
    // Clean username and take first 6 characters
    const cleanUsername = username.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    const userPart = cleanUsername.substring(0, 6).padEnd(6, '0');

    // Add random numbers
    const randomPart = Math.floor(Math.random() * 1000).toString().padStart(3, '0');

    return `${userPart}${randomPart}`.substring(0, 9);
  },

  /**
   * Validate referral code format
   */
  isValidReferralCode: (code: string): boolean => {
    return /^[A-Z0-9]{6,10}$/.test(code);
  },

  /**
   * Get referral code from AsyncStorage
   */
  getPendingReferralCode: async (): Promise<string | null> => {
    try {
      const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
      return await AsyncStorage.getItem('pendingReferralCode');
    } catch (__error) {
      console.error('Error getting pending referral code:', __error);
      return null;
    }
  },

  /**
   * Clear pending referral code from AsyncStorage
   */
  clearPendingReferralCode: async (): Promise<void> => {
    try {
      const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
      await AsyncStorage.removeItem('pendingReferralCode');
    } catch (__error) {
      console.error('Error clearing pending referral code:', __error);
    }
  },

  /**
   * Store pending referral code in AsyncStorage
   */
  storePendingReferralCode: async (code: string): Promise<void> => {
    try {
      const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
      await AsyncStorage.setItem('pendingReferralCode', code.trim().toUpperCase());
    } catch (__error) {
      console.error('Error storing pending referral code:', __error);
    }
  },

  /**
   * Generate share message for referral
   */
  generateShareMessage: (referralLink: string, username: string): string => {
    return `Hey! I'm loving KlickTape - it's like Instagram but way cooler! 📸✨

Join me using my invite link and let's connect:
${referralLink}

See you there! 🚀
- ${username}`;
  },

  /**
   * Calculate progress percentage
   */
  calculateProgress: (completed: number, required: number): number => {
    if (required === 0) return 100;
    return Math.min(Math.round((completed / required) * 100), 100);
  },

  /**
   * Get time until feature expires (if applicable)
   */
  getTimeUntilExpiry: (expiresAt?: string): string | null => {
    if (!expiresAt) return null;

    const now = new Date();
    const expiry = new Date(expiresAt);
    const diff = expiry.getTime() - now.getTime();

    if (diff <= 0) return 'Expired';

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    if (days > 0) return `${days} day${days > 1 ? 's' : ''} left`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} left`;
    return 'Less than 1 hour left';
  },

  /**
   * Format referral link for sharing
   */
  formatReferralLink: (code: string): string => {
    return `https://klicktape.com/invite/${code}`;
  }
};

