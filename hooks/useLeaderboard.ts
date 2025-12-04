import { useState, useEffect, useCallback } from 'react';
import { leaderboardAPI, LeaderboardEntry, UserLeaderboardStats, UserReward } from '@/lib/leaderboardApi';

export interface UseLeaderboardReturn {
  // Data
  leaderboard: LeaderboardEntry[];
  userStats: UserLeaderboardStats | null;
  userRewards: UserReward[];
  
  // Loading states
  loading: boolean;
  refreshing: boolean;
  
  // Actions
  refresh: () => Promise<void>;
  shareContent: (contentType: 'story' | 'post' | 'reel', contentId: string) => Promise<boolean>;
  likeStory: (storyId: string) => Promise<boolean>;
  unlikeStory: (storyId: string) => Promise<boolean>;
  commentOnStory: (storyId: string, content: string) => Promise<boolean>;
  
  // Utilities
  getRankIcon: (rank: number) => string;
  getRewardIcon: (rewardType: string) => string;
  getPointsForAction: (actionType: string) => number;
}

export const useLeaderboard = (): UseLeaderboardReturn => {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [userStats, setUserStats] = useState<UserLeaderboardStats | null>(null);
  const [userRewards, setUserRewards] = useState<UserReward[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchLeaderboardData = useCallback(async () => {
    try {
      const [leaderboardData, statsData, rewardsData] = await Promise.all([
        leaderboardAPI.getCurrentLeaderboard(),
        leaderboardAPI.getUserStats(),
        leaderboardAPI.getUserRewards()
      ]);

      setLeaderboard(leaderboardData);
      setUserStats(statsData);
      setUserRewards(rewardsData);
    } catch (error) {
      // console.error('Error fetching leaderboard data:', error);
      throw error;
    }
  }, []);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchLeaderboardData();
    } finally {
      setRefreshing(false);
    }
  }, [fetchLeaderboardData]);

  const shareContent = useCallback(async (
    contentType: 'story' | 'post' | 'reel',
    contentId: string
  ): Promise<boolean> => {
    try {
      const result = await leaderboardAPI.shareContent(contentType, contentId);
      if (result) {
        // Refresh user stats to show updated points
        const newStats = await leaderboardAPI.getUserStats();
        setUserStats(newStats);
      }
      return result;
    } catch (error) {
      // console.error('Error sharing content:', error);
      throw error;
    }
  }, []);

  const likeStory = useCallback(async (storyId: string): Promise<boolean> => {
    try {
      const result = await leaderboardAPI.likeStory(storyId);
      if (result) {
        // Refresh user stats to show updated points
        const newStats = await leaderboardAPI.getUserStats();
        setUserStats(newStats);
      }
      return result;
    } catch (error) {
      // console.error('Error liking story:', error);
      throw error;
    }
  }, []);

  const unlikeStory = useCallback(async (storyId: string): Promise<boolean> => {
    try {
      const result = await leaderboardAPI.unlikeStory(storyId);
      if (result) {
        // Refresh user stats to show updated points
        const newStats = await leaderboardAPI.getUserStats();
        setUserStats(newStats);
      }
      return result;
    } catch (error) {
      // console.error('Error unliking story:', error);
      throw error;
    }
  }, []);

  const commentOnStory = useCallback(async (storyId: string, content: string): Promise<boolean> => {
    try {
      const result = await leaderboardAPI.commentOnStory(storyId, content);
      if (result) {
        // Refresh user stats to show updated points
        const newStats = await leaderboardAPI.getUserStats();
        setUserStats(newStats);
      }
      return result;
    } catch (error) {
      // console.error('Error commenting on story:', error);
      throw error;
    }
  }, []);

  const getRankIcon = useCallback((rank: number): string => {
    switch (rank) {
      case 1: return '🥇';
      case 2: return '🥈';
      case 3: return '🥉';
      default: return `#${rank}`;
    }
  }, []);

  const getRewardIcon = useCallback((rewardType: string): string => {
    switch (rewardType) {
      case 'premium_badge': return '⭐';
      case 'normal_badge': return '🌟';
      case 'premium_title': return '👑';
      case 'normal_title': return '🏆';
      default: return '🎖️';
    }
  }, []);

  const getPointsForAction = useCallback((actionType: string): number => {
    const pointsMap: { [key: string]: number } = {
      'story_like': 1,
      'story_comment': 2,
      'photo_like': 2,
      'photo_comment': 1.5,
      'reel_like': 2,
      'reel_comment': 3,
      'share_story': 3,
      'share_photo': 3,
      'share_reel': 3
    };
    return pointsMap[actionType] || 0;
  }, []);

  // Initial data fetch
  useEffect(() => {
    fetchLeaderboardData().finally(() => setLoading(false));
  }, [fetchLeaderboardData]);

  return {
    // Data
    leaderboard,
    userStats,
    userRewards,
    
    // Loading states
    loading,
    refreshing,
    
    // Actions
    refresh,
    shareContent,
    likeStory,
    unlikeStory,
    commentOnStory,
    
    // Utilities
    getRankIcon,
    getRewardIcon,
    getPointsForAction
  };
};

export default useLeaderboard;
