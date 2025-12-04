import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { useTheme } from '@/src/context/ThemeContext';
import BadgeDisplay from '@/components/BadgeDisplay';
import { UserLeaderboardStats } from '@/lib/leaderboardApi';

interface RedesignedProfileProps {
  username: string;
  avatar: string;
  stats: {
    posts: number;
    followers: number;
    following: number;
    rank?: number | null;
    points?: number;
  };
  name: string;
  description: string;
  website?: string;
  rankTag?: string | null;
  accountType?: string;
  gender?: string;
  badgeUserId?: string | null;
  userRankStats?: UserLeaderboardStats | null;
  onEditProfile?: () => void;
  onFollowersPress?: () => void;
  onFollowingPress?: () => void;
}

const ProfileRedesign: React.FC<RedesignedProfileProps> = ({
  username,
  avatar,
  stats,
  name,
  description,
  website,
  rankTag,
  accountType,
  gender,
  badgeUserId,
  onEditProfile,
  onFollowersPress,
  onFollowingPress,
}) => {
  const { colors, isDarkMode } = useTheme();

  // Function to get tier icon based on mythological tier
  const getTierIcon = (tier: string) => {
    switch (tier) {
      case 'Loki of Klicktape':
        return '🎭'; // Trickster mask
      case 'Odin of Klicktape':
        return '👁️'; // All-seeing eye
      case 'Poseidon of Klicktape':
        return '🔱'; // Trident
      case 'Zeus of Klicktape':
        return '⚡'; // Lightning bolt
      case 'Hercules of Klicktape':
        return '💪'; // Strength
      default:
        return '🏆'; // Default trophy
    }
  };

  // Function to get tier name based on mythological tier
  const getTierName = (tier: string) => {
    switch (tier) {
      case 'Loki of Klicktape': // Top 10
        return 'Loki of Klicktape';
      case 'Odin of Klicktape': // 11-20
        return 'Odin of Klicktape';
      case 'Poseidon of Klicktape': // 21-30
        return 'Poseidon of Klicktape';
      case 'Zeus of Klicktape': // 31-40
        return 'Zeus of Klicktape';
      case 'Hercules of Klicktape': // 41-50
        return 'Hercules of Klicktape';
      default:
        return tier; // Return the tier as is if not in the list
    }
  };

  const renderStat = (value: string | number, label: string, onPress?: () => void) => {
    const content = (
      <View style={styles.statItem}>
        <Text style={[styles.statValue, { color: colors.text }]}>{value}</Text>
        <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{label}</Text>
      </View>
    );

    if (onPress) {
      return (
        <TouchableOpacity onPress={onPress} style={styles.statItem}>
          <Text style={[styles.statValue, { color: colors.text }]}>{value}</Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{label}</Text>
        </TouchableOpacity>
      );
    }

    return content;
  };

  return (
    <View style={[styles.wrapper, { backgroundColor: 'transparent' }]}>

      
      {/* Centered avatar */}
      <View style={styles.avatarContainer}>
        <Image source={{ uri: avatar || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(username || 'User') + '&background=E5E7EB&color=9CA3AF&size=110' }} style={[styles.avatar, { borderColor: isDarkMode ? '#FFFFFF' : '#000000' }]} />
      </View>

      {/* Stats */}
      <View style={[styles.statsRow, { backgroundColor: colors.backgroundSecondary, borderColor: `${colors.primary}15` }]}>
        {renderStat(stats.posts ?? 0, 'Posts')}
        {renderStat(stats.followers ?? 0, 'Followers', onFollowersPress)}
        {renderStat(stats.following ?? 0, 'Following', onFollowingPress)}
      </View>



      {/* Bio Section */}
      <View style={[styles.bioCard, { backgroundColor: colors.card, shadowColor: colors.text, borderColor: `${colors.primary}15` }]}>
        <View style={styles.nameRow}>
          <Text style={[styles.nameText, { color: colors.text }]}>{name || 'No Name'}</Text>
        </View>

        {/* Only show rank if user has a mythological tier */}
        {!!rankTag && (
          <View style={[styles.rankTag, { 
            backgroundColor: `${colors.primary}20`, 
            borderColor: `${colors.primary}40` 
          }]}>
            <Text style={styles.tierIcon}>{getTierIcon(rankTag)}</Text>
            <Text style={[styles.rankText, { color: colors.primary }]}>{getTierName(rankTag)}</Text>
          </View>
        )}

        {/* Always show description */}
        <Text style={[styles.bioText, { color: colors.textSecondary }]}>
          {description || 'No bio available'}
        </Text>
        
        {!!website && (
          <TouchableOpacity onPress={() => Linking.openURL(website.startsWith('http') ? website : `https://${website}`)}>
            <Text style={[styles.linkText, { color: '#1B74E4' }]}>{website}</Text>
          </TouchableOpacity>
        )}

        {/* Badges */}
        {!!badgeUserId && (
          <View style={{ marginTop: 10 }}>
            <BadgeDisplay userId={badgeUserId} showTitle={false} maxBadges={3} />
          </View>
        )}

        {/* Additional info - always show account type and gender */}
        <View style={{ marginTop: 8 }}>
          <Text style={[styles.infoText, { color: colors.textTertiary }]}>
            {accountType ? `${accountType.charAt(0).toUpperCase() + accountType.slice(1).toLowerCase()} Account` : 'Account Type: Not specified'}
          </Text>
          <Text style={[styles.infoText, { color: colors.textTertiary }]}>
            {gender ? `Gender: ${gender.charAt(0).toUpperCase() + gender.slice(1).toLowerCase()}` : 'Gender: Not specified'}
          </Text>
        </View>

        {/* Edit Profile */}
        {onEditProfile && (
          <TouchableOpacity
            style={[styles.editButton, { backgroundColor: isDarkMode ? 'rgba(128,128,128,0.1)' : 'rgba(128,128,128,0.1)', borderColor: isDarkMode ? 'rgba(128,128,128,0.3)' : 'rgba(128,128,128,0.3)' }]}
            onPress={onEditProfile}
          >
            <Text style={[styles.editButtonText, { color: colors.text }]}>Edit Profile</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: 16,
    marginBottom: 20, // Add bottom margin for spacing
  },
  avatarContainer: {
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 10,
  },
  avatar: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 2.5, // Increased from 2 to accommodate the 0.5px theme border
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 14,
    borderWidth: 1,
    borderRadius: 14,
  },
  statItem: {
    alignItems: 'center',
    minWidth: 90,
  },
  statValue: {
    fontSize: 18,
    fontFamily: 'Rubik-Regular',
  },
  statLabel: {
    fontSize: 12,
    fontFamily: 'Rubik-Regular',
    marginTop: 4,
    opacity: 0.7,
  },
  bioCard: {
    marginTop: 16,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    boxShadow: "0px 4px 8px rgba(0, 0, 0, 0.08)",
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  nameText: {
    fontSize: 16,
    fontFamily: 'Rubik-Bold',
  },
  rankTag: {
    marginTop: 10,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
  },
  tierIcon: {
    fontSize: 14,
  },
  rankText: {
    fontSize: 12,
    fontFamily: 'Rubik-Medium',
  },
  bioText: {
    marginTop: 8,
    fontSize: 14,
    fontFamily: 'Rubik-Regular',
  },
  linkText: {
    marginTop: 6,
    fontSize: 14,
    fontFamily: 'Rubik-Regular',
  },
  infoText: {
    fontSize: 14,
    fontFamily: 'Rubik-Regular',
  },
  editButton: {
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  editButtonText: {
    fontSize: 14,
    fontFamily: 'Rubik-Regular',
  },
  rankInfoCard: {
    marginTop: 12,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    boxShadow: "0px 2px 4px rgba(0, 0, 0, 0.05)",
  },
  rankInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  rankInfoItem: {
    alignItems: 'center',
    flex: 1,
  },
  rankInfoLabel: {
    fontSize: 12,
    fontFamily: 'Rubik-Regular',
    marginBottom: 4,
    opacity: 0.8,
  },
  rankInfoValue: {
    fontSize: 16,
    fontFamily: 'Rubik-Bold',
  },
  topRankBadge: {
    marginTop: 12,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    alignSelf: 'center',
  },
  topRankText: {
    fontSize: 12,
    fontFamily: 'Rubik-Medium',
    textAlign: 'center',
  },
  mythologicalTierSection: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  mythologicalTierIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  mythologicalTierInfo: {
    flex: 1,
  },
  mythologicalTierName: {
    fontSize: 16,
    fontFamily: 'Rubik-Bold',
    marginBottom: 2,
  },
  mythologicalTierDescription: {
    fontSize: 12,
    fontFamily: 'Rubik-Regular',
    opacity: 0.8,
  },
});

export default ProfileRedesign;
