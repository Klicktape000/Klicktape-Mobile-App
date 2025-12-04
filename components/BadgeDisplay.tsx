import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/src/context/ThemeContext';
import { leaderboardAPI, UserReward } from '@/lib/leaderboardApi';

interface BadgeDisplayProps {
  userId: string;
  showTitle?: boolean;
  maxBadges?: number;
}

const BadgeDisplay: React.FC<BadgeDisplayProps> = ({ 
  userId, 
  showTitle = true, 
  maxBadges = 3 
}) => {
  const { colors } = useTheme();
  const [badges, setBadges] = useState<UserReward[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUserBadges();
  }, [userId]);

  const fetchUserBadges = async () => {
    try {
      const userBadges = await leaderboardAPI.getUserBadges(userId);
      setBadges(userBadges.slice(0, maxBadges));
    } catch (__error) {
      console.error('Error fetching user badges:', __error);
    } finally {
      setLoading(false);
    }
  };

  const getBadgeIcon = (rewardType: string, badgeIcon?: string) => {
    switch (badgeIcon || rewardType) {
      case 'star-gold':
      case 'premium_badge': 
        return <Feather name="star" size={16} color="#FFD700" />; // Gold
      case 'star-silver':
      case 'normal_badge': 
        return <Feather name="star" size={16} color="#C0C0C0" />; // Silver
      case 'crown-gold':
      case 'premium_title': 
        return <Feather name="award" size={16} color="#FFD700" />; // Gold Crown
      case 'shield-blue':
      case 'normal_title': 
        return <Feather name="shield" size={16} color="#4A90E2" />; // Blue Shield
      default: 
        return <Feather name="award" size={16} color={colors.primary} />;
    }
  };

  const getBadgeTitle = (rewardType: string, rank: number, rankTier?: string) => {
    // If we have a mythological tier, use it instead of generic titles
    if (rankTier) {
      return rankTier;
    }

    // Fallback to mythological tier based on rank position
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

    // Legacy fallback for old reward types - use mythological titles instead of rank numbers
    switch (rewardType) {
      case 'premium_badge':
        return 'Elite Performer';
      case 'normal_badge':
        return 'Top Contributor';
      case 'premium_title':
        return 'Community Leader';
      case 'normal_title':
        return 'Active Member';
      default:
        return 'Klicktape Member';
    }
  };

  if (loading || badges.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.badgesContainer}>
        {badges.map((badge, index) => (
          <View 
            key={badge.id} 
            style={[
              styles.badge, 
              { 
                backgroundColor: colors.card,
                borderColor: colors.cardBorder 
              }
            ]}
          >
            <View style={styles.badgeIcon}>
              {getBadgeIcon(badge.reward_type, badge.badge_icon)}
            </View>
            <Text style={[styles.badgeText, { color: colors.textSecondary }]}>
              {getBadgeTitle(badge.reward_type, badge.rank_achieved, badge.rank_tier)}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
  },
  title: {
    fontSize: 14,
    fontFamily: 'Rubik-Medium',
    marginBottom: 8,
  },
  badgesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  badgeIcon: {
    marginRight: 4,
  },
  badgeText: {
    fontSize: 12,
    fontFamily: 'Rubik-Regular',
  },
});

export default BadgeDisplay;

