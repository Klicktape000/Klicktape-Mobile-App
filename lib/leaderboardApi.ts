import { supabase } from './supabase';

export interface LeaderboardEntry {
  rank_position: number;
  user_id: string;
  username: string;
  avatar_url: string;
  total_points: number;
  is_current_user: boolean;
}

export interface UserLeaderboardStats {
  rank_position: number | null;
  total_points: number;
  points_to_next_rank: number;
  is_in_top_50: boolean;
}

export interface UserReward {
  id: string;
  reward_type: 'premium_badge' | 'normal_badge' | 'premium_title' | 'normal_title';
  rank_achieved: number;
  title_text?: string;
  badge_icon?: string;
  earned_at: string;
  rank_tier?: 'Loki of Klicktape' | 'Odin of Klicktape' | 'Poseidon of Klicktape' | 'Zeus of Klicktape' | 'Hercules of Klicktape';
}

export interface LeaderboardPeriod {
  id: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  is_completed: boolean;
}

export const leaderboardAPI = {
  /**
   * Initialize leaderboard system (call this once when app starts)
   */
  initialize: async (): Promise<boolean> => {
    try {
      // Check if leaderboard tables exist by trying a simple query
      const { error } = await supabase
        .from('leaderboard_periods')
        .select('id')
        .limit(1);

      if (error) {
// console.warn('Leaderboard system not set up yet:', error.message);
        return false;
      }

      // Ensure current period exists
      await leaderboardAPI.ensureCurrentPeriod();
      return true;
    } catch (error) {
// console.warn('Leaderboard system not available:', error);
      return false;
    }
  },

  /**
   * Ensure current leaderboard period exists - OPTIMIZED
   */
  ensureCurrentPeriod: async (): Promise<void> => {
    try {
      // OPTIMIZED: Just check if period exists, don't call slow RPC
      const { data: period } = await supabase
        .from('leaderboard_periods')
        .select('id')
        .eq('is_active', true)
        .limit(1)
        .single();

      if (!period) {
        console.log('No active leaderboard period found');
      }
    } catch (error) {
      // Silent fail - period check is not critical for loading
    }
  },

  /**
   * Get current leaderboard rankings (top 50) - OPTIMIZED
   */
  getCurrentLeaderboard: async (): Promise<LeaderboardEntry[]> => {
    try {
      const { data, error } = await (supabase as any).rpc('get_current_leaderboard');
      if (error) {
        console.error('Error fetching current leaderboard via RPC:', error);
        return [];
      }

      return (data || []).map((item: any) => ({
        rank_position: item.rank_position,
        total_points: Number(item.total_points || 0),
        user_id: item.user_id,
        username: item.username || 'Unknown',
        avatar_url: item.avatar_url || '',
        is_current_user: !!item.is_current_user
      }));
    } catch (error) {
      console.error('Error in getCurrentLeaderboard:', error);
      return [];
    }
  },

  /**
   * Get current user's leaderboard stats - OPTIMIZED
   */
  getUserStats: async (userId?: string): Promise<UserLeaderboardStats> => {
    try {
      const params = userId ? { p_user_id: userId } : {};
      const { data, error } = await (supabase as any).rpc('get_user_leaderboard_stats', params as any);
      if (error) {
        console.error('Error fetching user stats via RPC:', error);
        return {
          rank_position: null,
          total_points: 0,
          points_to_next_rank: 0,
          is_in_top_50: false
        };
      }

      const stats = (Array.isArray(data) ? data[0] : data) || {};
      return {
        rank_position: stats.rank_position ?? null,
        total_points: Number(stats.total_points || 0),
        points_to_next_rank: Number(stats.points_to_next_rank || 0),
        is_in_top_50: !!stats.is_in_top_50,
      };
    } catch (error) {
      console.error('Error in getUserStats:', error);
      return {
        rank_position: null,
        total_points: 0,
        points_to_next_rank: 0,
        is_in_top_50: false
      };
    }
  },

  /**
   * Get current leaderboard period info
   */
  getCurrentPeriod: async (): Promise<LeaderboardPeriod | null> => {
    try {
      const { data, error } = await supabase
        .from('leaderboard_periods')
        .select('*')
        .eq('is_active', true)
        .single();
      
      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('Error fetching current period:', error);
        throw error;
      }

      return data || null;
    } catch (error) {
      console.error('Error in getCurrentPeriod:', error);
      return null;
    }
  },

  /**
   * Get user's rewards for a specific period
   */
  getUserRewards: async (userId?: string, periodId?: string): Promise<UserReward[]> => {
    try {
      let query = supabase
        .from('user_rewards')
        .select('*')
        .order('earned_at', { ascending: false });

      if (userId) {
        query = query.eq('user_id', userId);
      }

      if (periodId) {
        query = query.eq('period_id', periodId);
      }

      const { data, error } = await query;
      
      if (error) {
        console.error('Error fetching user rewards:', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Error in getUserRewards:', error);
      return [];
    }
  },

  /**
   * Get user's badges for profile display (only badges, not titles)
   */
  getUserBadges: async (userId: string): Promise<UserReward[]> => {
    try {
      const { data, error } = await supabase
        .from('user_rewards')
        .select('*')
        .eq('user_id', userId)
        .in('reward_type', ['premium_badge', 'normal_badge'])
        .order('earned_at', { ascending: false })
        .limit(3); // Show only top 3 badges

      if (error) {
        console.error('Error fetching user badges:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error in getUserBadges:', error);
      return [];
    }
  },

  /**
   * Add engagement points manually (for testing or special cases)
   */
  addEngagementPoints: async (
    userId: string,
    engagementType: string,
    contentType: string,
    contentId: string
  ): Promise<boolean> => {
    try {
      const { data, error } = await (supabase as any).rpc('add_engagement_points', {
        p_user_id: userId,
        p_engagement_type: engagementType,
        p_content_type: contentType,
        p_content_id: contentId
      });
      
      if (error) {
        console.error('Error adding engagement points:', error);
        throw error;
      }

      return data || false;
    } catch (error) {
      console.error('Error in addEngagementPoints:', error);
      throw error;
    }
  },

  /**
   * Share content and track points
   */
  shareContent: async (
    contentType: 'story' | 'post' | 'reel',
    contentId: string,
    sharedTo: string = 'external'
  ): Promise<boolean> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { error } = await (supabase as any)
        .from('shares')
        .insert({
          user_id: user.id,
          content_type: contentType,
          content_id: contentId,
          shared_to: sharedTo
        });
      
      if (error) {
        console.error('Error sharing content:', error);
        throw error;
      }

      return true;
    } catch (error) {
      console.error('Error in shareContent:', error);
      throw error;
    }
  },

  /**
   * Like a story
   */
  likeStory: async (storyId: string): Promise<boolean> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { error } = await (supabase as any)
        .from('story_likes')
        .insert({
          user_id: user.id,
          story_id: storyId
        });
      
      if (error && error.code !== '23505') { // 23505 = unique violation (already liked)
        console.error('Error liking story:', error);
        throw error;
      }

      return true;
    } catch (error) {
      console.error('Error in likeStory:', error);
      throw error;
    }
  },

  /**
   * Unlike a story
   */
  unlikeStory: async (storyId: string): Promise<boolean> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('story_likes')
        .delete()
        .eq('user_id', user.id)
        .eq('story_id', storyId);
      
      if (error) {
        console.error('Error unliking story:', error);
        throw error;
      }

      return true;
    } catch (error) {
      console.error('Error in unlikeStory:', error);
      throw error;
    }
  },

  /**
   * Comment on a story
   */
  commentOnStory: async (storyId: string, content: string): Promise<boolean> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { error } = await (supabase as any)
        .from('story_comments')
        .insert({
          story_id: storyId,
          user_id: user.id,
          content: content
        });
      
      if (error) {
        console.error('Error commenting on story:', error);
        throw error;
      }

      return true;
    } catch (error) {
      console.error('Error in commentOnStory:', error);
      throw error;
    }
  },

  /**
   * Get engagement breakdown for current user
   */
  getUserEngagementBreakdown: async (userId?: string): Promise<any> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const targetUserId = userId || user?.id;
      
      if (!targetUserId) throw new Error('User not authenticated');

      // Get current period
      const period = await leaderboardAPI.getCurrentPeriod();
      if (!period) return {};

      const { data, error } = await supabase
        .from('engagement_points')
        .select('engagement_type, points, created_at')
        .eq('user_id', targetUserId)
        .eq('period_id', period.id)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error fetching engagement breakdown:', error);
        throw error;
      }

      // Group by engagement type
      const breakdown = (data || []).reduce((acc: any, item: any) => {
        if (!acc[item.engagement_type]) {
          acc[item.engagement_type] = {
            count: 0,
            total_points: 0,
            recent_activities: []
          };
        }
        acc[item.engagement_type].count += 1;
        acc[item.engagement_type].total_points += parseFloat(item.points);
        acc[item.engagement_type].recent_activities.push({
          points: item.points,
          created_at: item.created_at
        });
        return acc;
      }, {});

      return breakdown;
    } catch (error) {
      console.error('Error in getUserEngagementBreakdown:', error);
      throw error;
    }
  },

  /**
   * Complete current leaderboard period (admin function)
   */
  completePeriod: async (): Promise<boolean> => {
    try {
      const { data, error } = await (supabase as any).rpc('complete_leaderboard_period');
      
      if (error) {
        console.error('Error completing period:', error);
        throw error;
      }

      return data || false;
    } catch (error) {
      console.error('Error in completePeriod:', error);
      throw error;
    }
  }
};

export default leaderboardAPI;

