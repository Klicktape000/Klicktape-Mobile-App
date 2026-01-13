import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  FlatList,
  TouchableOpacity,
  Image,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Alert
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/src/context/ThemeContext';
import { leaderboardAPI, LeaderboardEntry, UserLeaderboardStats, UserReward } from '@/lib/leaderboardApi';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import FallbackCache from '@/lib/utils/fallbackCache';
import CachedImage from '@/components/CachedImage';

interface LeaderboardProps {
  onClose?: () => void;
}

const Leaderboard: React.FC<LeaderboardProps> = ({ onClose }) => {
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'rankings' | 'rewards' | 'stats'>('rankings');

  // Get current user ID
  useEffect(() => {
    const getCurrentUser = async () => {
      try {
        const userData = await AsyncStorage.getItem('user');
        if (userData) {
          const user = JSON.parse(userData);
          setCurrentUserId(user.id);
        }
      } catch (__error) {
        // console.error('Error getting current user:', error);
      }
    };
    getCurrentUser();
  }, []);

  // Hydrate query cache from AsyncStorage snapshots for instant first render
  useEffect(() => {
    const hydrateFromSnapshots = async () => {
      try {
        const leaderboardSnap = await FallbackCache.get<LeaderboardEntry[]>('leaderboard:current');
        if (leaderboardSnap && leaderboardSnap.length > 0) {
          queryClient.setQueryData(['leaderboard', 'current'], leaderboardSnap);
        }

        const uid = currentUserId || (JSON.parse((await AsyncStorage.getItem('user')) || '{}')?.id || null);
        if (uid) {
          const statsSnap = await FallbackCache.get<UserLeaderboardStats>(`leaderboard:stats:${uid}`);
          if (statsSnap) {
            queryClient.setQueryData(['leaderboard', 'stats', uid], statsSnap);
          }

          const rewardsSnap = await FallbackCache.get<UserReward[]>(`leaderboard:rewards:${uid}`);
          if (rewardsSnap && rewardsSnap.length >= 0) {
            queryClient.setQueryData(['leaderboard', 'rewards', uid], rewardsSnap);
          }
        }
      } catch (__err) {
        // Silent snapshot hydration failure
      }
    };
    hydrateFromSnapshots();
    // Re-run when currentUserId resolves so user-scoped keys hydrate
  }, [currentUserId, queryClient]);

  // INSTAGRAM-STYLE: Ultra-aggressive cache for instant loading
  const { data: leaderboardData, isLoading: leaderboardLoading, refetch: refetchLeaderboard, isFetched: leaderboardFetched } = useQuery<LeaderboardEntry[]>({
    queryKey: ['leaderboard', 'current'],
    queryFn: async () => {
      await leaderboardAPI.ensureCurrentPeriod();
      return await leaderboardAPI.getCurrentLeaderboard();
    },
    staleTime: Infinity, // Never stale - instant from cache
    gcTime: 24 * 60 * 1000, // 24 hours
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const { data: userStats, isLoading: statsLoading, refetch: refetchStats, isFetched: statsFetched } = useQuery<UserLeaderboardStats>({
    queryKey: ['leaderboard', 'stats', currentUserId],
    queryFn: () => leaderboardAPI.getUserStats(),
    staleTime: Infinity,
    gcTime: 24 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const { data: userRewardsData, isLoading: rewardsLoading, refetch: refetchRewards, isFetched: rewardsFetched } = useQuery<UserReward[]>({
    queryKey: ['leaderboard', 'rewards', currentUserId],
    queryFn: async () => {
      const rewards = await leaderboardAPI.getUserRewards(currentUserId || undefined);
      if (rewards.length === 0) {
        return await leaderboardAPI.getUserRewards('d265428e-92ab-4b36-9e27-1d9c1fe32832');
      }
      return rewards;
    },
    staleTime: Infinity,
    gcTime: 24 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const leaderboard = leaderboardData || [];
  const userRewards = userRewardsData || [];

  // Save data to cache when it changes (replaces deprecated onSuccess)
  useEffect(() => {
    if (leaderboardData) {
      FallbackCache.set<LeaderboardEntry[]>('leaderboard:current', leaderboardData, 600);
    }
  }, [leaderboardData]);

  useEffect(() => {
    if (userStats && currentUserId) {
      FallbackCache.set<UserLeaderboardStats>(`leaderboard:stats:${currentUserId}`, userStats, 600);
    }
  }, [userStats, currentUserId]);

  useEffect(() => {
    if (userRewardsData && currentUserId) {
      FallbackCache.set<UserReward[]>(`leaderboard:rewards:${currentUserId}`, userRewardsData, 600);
    }
  }, [userRewardsData, currentUserId]);

  // Show skeleton ONLY when loading with no cached data at all
  const shouldShowSkeleton = (leaderboardLoading && !leaderboardFetched && !leaderboardData);

  // Show cached data immediately, even if it's being refreshed in background
  const hasAnyData = leaderboardData || userStats || userRewardsData;

  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      refetchLeaderboard(),
      refetchStats(),
      refetchRewards()
    ]);
    setRefreshing(false);
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1: return '🥇';
      case 2: return '🥈';
      case 3: return '🥉';
      default: return `#${rank}`;
    }
  };

  const getRewardIcon = (rewardType: string, badgeIcon?: string, rank?: number) => {
    // Use mythological tier-appropriate icons based on rank
    if (rank) {
      if (rank >= 1 && rank <= 10) {
        return <Text style={{ fontSize: 20 }}>🔥</Text>; // Loki - Fire/Trickster
      } else if (rank >= 11 && rank <= 20) {
        return <Text style={{ fontSize: 20 }}>⚡</Text>; // Odin - Lightning/Wisdom
      } else if (rank >= 21 && rank <= 30) {
        return <Text style={{ fontSize: 20 }}>🌊</Text>; // Poseidon - Ocean/Trident
      } else if (rank >= 31 && rank <= 40) {
        return <Text style={{ fontSize: 20 }}>⚡</Text>; // Zeus - Lightning/Thunder
      } else if (rank >= 41 && rank <= 50) {
        return <Text style={{ fontSize: 20 }}>💪</Text>; // Hercules - Strength
      }
    }

    // Fallback to professional Feather icons
    switch (badgeIcon || rewardType) {
      case 'star-gold':
      case 'premium_badge':
        return <Feather name="star" size={20} color="#FFD700" />; // Gold
      case 'star-silver':
      case 'normal_badge':
        return <Feather name="star" size={20} color="#C0C0C0" />; // Silver
      case 'crown-gold':
      case 'premium_title':
        return <Feather name="award" size={20} color="#FFD700" />; // Gold Crown
      case 'shield-blue':
      case 'normal_title':
        return <Feather name="shield" size={20} color="#4A90E2" />; // Blue Shield
      default:
        return <Feather name="award" size={20} color={colors.primary} />;
    }
  };

  const getMythologicalTierTitle = (reward: any) => {
    // If we have a mythological tier, use it
    if (reward.rank_tier) {
      return reward.rank_tier;
    }

    // Fallback to mythological tier based on rank position
    const rank = reward.rank_achieved;
    if (rank >= 1 && rank <= 10) {
      return 'Loki of Klicktape';
    } else if (rank >= 11 && rank <= 20) {
      return 'Odin of Klicktape';
    } else if (rank >= 21 && rank <= 30) {
      return 'Poseidon of Klicktape';
    } else if (rank >= 31 && rank <= 40) {
      return 'Zeus of Klicktape';
    } else if (rank >= 41 && rank <= 50) {
      return 'Hercules of Klicktape';
    }

    // Legacy fallback
    return reward.title_text || `${reward.reward_type.replace('_', ' ').toUpperCase()}`;
  };

  const renderLeaderboardEntry = (entry: LeaderboardEntry, index: number) => (
    <View
      key={entry.user_id}
      style={[
        styles.leaderboardEntry,
        {
          backgroundColor: entry.is_current_user ? `${colors.primary}20` : colors.card,
          borderColor: entry.is_current_user ? colors.primary : colors.cardBorder,
          borderWidth: entry.is_current_user ? 2 : 1
        }
      ]}
    >
      <View style={styles.rankContainer}>
        <Text style={[styles.rankText, { color: colors.text }]}>
          {getRankIcon(entry.rank_position)}
        </Text>
      </View>
      
      <CachedImage
        uri={entry.avatar_url || 'https://via.placeholder.com/40'}
        fallbackUri={'https://via.placeholder.com/40'}
        style={[styles.avatar, { borderColor: colors.cardBorder }]}
      />
      
      <View style={styles.userInfo}>
        <Text style={[styles.username, { color: colors.text }]} numberOfLines={1}>
          {entry.username}
        </Text>
        <Text style={[styles.points, { color: colors.primary }]}>
          {entry.total_points} pts
        </Text>
      </View>
      
      {entry.is_current_user && (
        <View style={[styles.currentUserBadge, { backgroundColor: colors.primary }]}>
          <Text style={[styles.currentUserText, { color: colors.background }]}>You</Text>
        </View>
      )}
    </View>
  );

  const renderUserStats = () => (
    <View style={[styles.statsContainer, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>Your Performance</Text>
      
      <View style={styles.statRow}>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: colors.primary }]}>
            {userStats?.rank_position || 'Unranked'}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Current Rank</Text>
        </View>
        
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: colors.primary }]}>
            {userStats?.total_points || 0}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Total Points</Text>
        </View>
        
        {userStats?.rank_position !== 1 && (
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.primary }]}>
              {userStats?.points_to_next_rank || 0}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>To Next Rank</Text>
          </View>
        )}
      </View>
      
      <View style={[styles.progressContainer, { backgroundColor: colors.backgroundSecondary }]}>
        <View
          style={[
            styles.progressBar,
            {
              backgroundColor: colors.primary,
              width: userStats?.is_in_top_50 ? '100%' : '50%'
            }
          ]}
        />
      </View>
      
      <Text style={[styles.progressText, { color: colors.textSecondary }]}>
        {userStats?.is_in_top_50 ? 'You\'re in the top 50!' : 'Keep engaging to reach top 50!'}
      </Text>
    </View>
  );

  const renderRewards = () => (
    <View style={[styles.rewardsContainer, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>Your Rewards</Text>
      
      {userRewards.length === 0 ? (
        <Text style={[styles.noRewardsText, { color: colors.textSecondary }]}>
          No rewards yet. Keep engaging to earn rewards!
        </Text>
      ) : (
        userRewards.map((reward) => (
          <View key={reward.id} style={[styles.rewardItem, { borderColor: colors.cardBorder }]}>
            <View style={styles.rewardIcon}>
              {getRewardIcon(reward.reward_type, reward.badge_icon, reward.rank_achieved)}
            </View>
            <View style={styles.rewardInfo}>
              <Text style={[styles.rewardTitle, { color: colors.text }]}>
                {getMythologicalTierTitle(reward)}
              </Text>
            </View>
            <Text style={[styles.rewardDate, { color: colors.textTertiary }]}>
              {new Date(reward.earned_at).toLocaleDateString()}
            </Text>
          </View>
        ))
      )}
    </View>
  );

  const renderPointsGuide = () => (
    <View style={[styles.pointsGuide, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>How to Earn Points</Text>
      
      <View style={styles.pointsGrid}>
        <View style={styles.pointItem}>
          <Text style={[styles.pointValue, { color: colors.primary }]}>1</Text>
          <Text style={[styles.pointAction, { color: colors.textSecondary }]}>Story Like</Text>
        </View>
        <View style={styles.pointItem}>
          <Text style={[styles.pointValue, { color: colors.primary }]}>2</Text>
          <Text style={[styles.pointAction, { color: colors.textSecondary }]}>Story Comment</Text>
        </View>
        <View style={styles.pointItem}>
          <Text style={[styles.pointValue, { color: colors.primary }]}>2</Text>
          <Text style={[styles.pointAction, { color: colors.textSecondary }]}>Photo Like</Text>
        </View>
        <View style={styles.pointItem}>
          <Text style={[styles.pointValue, { color: colors.primary }]}>1.5</Text>
          <Text style={[styles.pointAction, { color: colors.textSecondary }]}>Photo Comment</Text>
        </View>
        <View style={styles.pointItem}>
          <Text style={[styles.pointValue, { color: colors.primary }]}>2</Text>
          <Text style={[styles.pointAction, { color: colors.textSecondary }]}>Reel Like</Text>
        </View>
        <View style={styles.pointItem}>
          <Text style={[styles.pointValue, { color: colors.primary }]}>3</Text>
          <Text style={[styles.pointAction, { color: colors.textSecondary }]}>Reel Comment</Text>
        </View>
        <View style={styles.pointItem}>
          <Text style={[styles.pointValue, { color: colors.primary }]}>3</Text>
          <Text style={[styles.pointAction, { color: colors.textSecondary }]}>Any Share</Text>
        </View>
      </View>
    </View>
  );

  // Skeleton loader component
  const renderSkeleton = () => (
    <View style={styles.skeletonContainer}>
      <View style={[styles.skeletonBox, { backgroundColor: colors.card, height: 120 }]} />
      <View style={[styles.skeletonBox, { backgroundColor: colors.card, height: 80 }]} />
      <View style={[styles.skeletonBox, { backgroundColor: colors.card, height: 200 }]} />
    </View>
  );

  if (shouldShowSkeleton && !hasAnyData) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { borderBottomColor: colors.cardBorder }]}>
          <Text style={[styles.title, { color: colors.text }]}>Leaderboard</Text>
          {onClose && (
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Feather name="x" size={24} color={colors.text} />
            </TouchableOpacity>
          )}
        </View>
        {renderSkeleton()}
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.cardBorder }]}>
        <Text style={[styles.title, { color: colors.text }]}>Leaderboard</Text>
        {onClose && (
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Feather name="x" size={24} color={colors.text} />
          </TouchableOpacity>
        )}
      </View>

      <View style={[styles.tabContainer, { borderBottomColor: colors.cardBorder }]}>
        {(['rankings', 'stats', 'rewards'] as const).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[
              styles.tab,
              activeTab === tab && { borderBottomColor: colors.primary, borderBottomWidth: 2 }
            ]}
            onPress={() => setActiveTab(tab)}
          >
            <Text
              style={[
                styles.tabText,
                { color: activeTab === tab ? colors.primary : colors.textSecondary }
              ]}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
        }
        showsVerticalScrollIndicator={false}
      >
        {activeTab === 'rankings' && (
          <>
            {userStats && renderUserStats()}
            <View style={[styles.leaderboardContainer, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Top 50 Rankings</Text>
              {leaderboard.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={[styles.emptyStateTitle, { color: colors.text }]}>🏆 Leaderboard Coming Soon!</Text>
                  <Text style={[styles.emptyStateText, { color: colors.textSecondary }]}>
                    The leaderboard system is being set up. Start engaging with posts, reels, and stories to earn points when it&apos;s ready!
                  </Text>
                </View>
              ) : (
                <View style={styles.rankingsScrollContainer}>
                  {leaderboard.map(renderLeaderboardEntry)}
                </View>
              )}
            </View>
          </>
        )}

        {activeTab === 'stats' && (
          <>
            {userStats && renderUserStats()}
            {renderPointsGuide()}
          </>
        )}

        {activeTab === 'rewards' && renderRewards()}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    fontFamily: 'Rubik-Medium',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 24,
    fontFamily: 'Rubik-Bold',
  },
  closeButton: {
    padding: 8,
  },
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
  },
  tabText: {
    fontSize: 16,
    fontFamily: 'Rubik-Medium',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 20, // Extra padding at bottom for better scrolling
  },
  statsContainer: {
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Rubik-Bold',
    marginBottom: 16,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 24,
    fontFamily: 'Rubik-Bold',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    fontFamily: 'Rubik-Regular',
    textAlign: 'center',
  },
  progressContainer: {
    height: 8,
    borderRadius: 4,
    marginBottom: 8,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    fontFamily: 'Rubik-Medium',
    textAlign: 'center',
  },
  leaderboardContainer: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  rankingsScrollContainer: {
    // This container will allow the rankings to scroll within the main ScrollView
  },
  leaderboardEntry: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  rankContainer: {
    width: 40,
    alignItems: 'center',
  },
  rankText: {
    fontSize: 16,
    fontFamily: 'Rubik-Bold',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginHorizontal: 12,
    borderWidth: 1,
  },
  userInfo: {
    flex: 1,
  },
  username: {
    fontSize: 16,
    fontFamily: 'Rubik-Medium',
    marginBottom: 2,
  },
  points: {
    fontSize: 14,
    fontFamily: 'Rubik-Bold',
  },
  currentUserBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  currentUserText: {
    fontSize: 12,
    fontFamily: 'Rubik-Bold',
  },
  rewardsContainer: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
  },
  noRewardsText: {
    fontSize: 16,
    fontFamily: 'Rubik-Regular',
    textAlign: 'center',
    padding: 20,
  },
  rewardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    marginBottom: 8,
  },
  rewardIcon: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  rewardInfo: {
    flex: 1,
  },
  rewardTitle: {
    fontSize: 16,
    fontFamily: 'Rubik-Medium',
    marginBottom: 2,
  },
  rewardRank: {
    fontSize: 14,
    fontFamily: 'Rubik-Regular',
  },
  rewardDate: {
    fontSize: 12,
    fontFamily: 'Rubik-Regular',
  },
  pointsGuide: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  pointsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  pointItem: {
    width: '48%',
    alignItems: 'center',
    padding: 12,
    marginBottom: 8,
  },
  pointValue: {
    fontSize: 20,
    fontFamily: 'Rubik-Bold',
    marginBottom: 4,
  },
  pointAction: {
    fontSize: 12,
    fontFamily: 'Rubik-Regular',
    textAlign: 'center',
  },
  emptyState: {
    padding: 32,
    alignItems: 'center',
  },
  emptyStateTitle: {
    fontSize: 18,
    fontFamily: 'Rubik-Bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateText: {
    fontSize: 14,
    fontFamily: 'Rubik-Regular',
    textAlign: 'center',
    lineHeight: 20,
  },
  skeletonContainer: {
    padding: 16,
    gap: 12,
  },
  skeletonBox: {
    borderRadius: 12,
    opacity: 0.5,
  },
});

export default Leaderboard;

