import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Image
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/src/context/ThemeContext';
import { profileViewsAPI, ProfileView, referralAPI } from '@/lib/referralApi';
import { formatTimeAgo } from '@/lib/utils/formatUtils';

interface ProfileViewersProps {
  userId: string;
  onViewProfile?: (userId: string) => void;
}

const ProfileViewers: React.FC<ProfileViewersProps> = ({ userId, onViewProfile }) => {
  const { colors } = useTheme();
  const [viewers, setViewers] = useState<ProfileView[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [hasPremium, setHasPremium] = useState(false);

  useEffect(() => {
    if (!userId) return;
    
    const fetchViewers = async () => {
      try {
        //// console.log('ProfileViewers: Fetching viewers for userId:', userId);
        const viewersData = await profileViewsAPI.getProfileViewers(userId);
        //// console.log('ProfileViewers: Viewers data received:', viewersData);
        setViewers(viewersData);
      } catch {
        // console.error('Error fetching profile views:', error);
      }
    };

    const fetchAnalytics = async () => {
      try {
        //// console.log('ProfileViewers: Fetching analytics for userId:', userId);
        const analyticsData = await profileViewsAPI.getProfileViewAnalytics(userId);
        //// console.log('ProfileViewers: Analytics data received:', analyticsData);
        setAnalytics(analyticsData);
      } catch {
        // console.error('Error fetching analytics:', error);
      }
    };

    const checkPremiumStatus = async () => {
    if (!userId) return;
    
    try {
      //// console.log('🔍 Checking premium status for userId:', userId);
      
      // Get referral dashboard stats to see actual referral count
      await referralAPI.getReferralDashboard(userId);
      //// console.log('📊 Dashboard stats:', dashboardStats);
      
      // Ensure premium feature record is up-to-date based on actual referral count
      //// console.log('🔄 Ensuring premium feature record is up-to-date...');
      await referralAPI.ensurePremiumFeatureRecord(userId, 'profile_views');
      //// console.log('✅ Premium feature record updated, eligible:', isEligible);
      
      // Now check the premium feature status
      const hasPremiumFeature = await referralAPI.hasPremiumFeature(userId, 'profile_views');
      //// console.log('🎯 hasPremiumFeature result:', hasPremiumFeature);
      
      setHasPremium(hasPremiumFeature);
    } catch {
      // console.error('❌ Error checking premium status:', error);
      setHasPremium(false);
    }
  };

    const loadData = async () => {
      setLoading(true);
      //// console.log('ProfileViewers: userId changed to:', userId);
      
      try {
        await Promise.all([
          fetchViewers(),
          fetchAnalytics(),
          checkPremiumStatus()
        ]);
      } catch {
        // console.error('Error loading profile data:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, [userId]);

  const renderAnalytics = () => {
    if (!analytics) return null;

    const stats = [
      { label: 'Today', value: analytics.views_today, icon: 'calendar' },
      { label: 'This Week', value: analytics.views_this_week, icon: 'trending-up' },
      { label: 'This Month', value: analytics.views_this_month, icon: 'bar-chart-2' },
      { label: 'Unique Viewers', value: analytics.unique_viewers, icon: 'users' }
    ];

    return (
      <View style={styles.analyticsContainer}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Profile View Analytics
        </Text>
        
        <View style={styles.statsGrid}>
          {stats.map((stat, index) => (
            <View 
              key={index}
              style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
            >
              <Feather name={stat.icon as any} size={20} color={colors.primary} />
              <Text style={[styles.statValue, { color: colors.text }]}>
                {stat.value ?? 0}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                {stat.label}
              </Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  const renderViewer = ({ item }: { item: ProfileView }) => (
    <TouchableOpacity
      style={[styles.viewerItem, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
      onPress={() => onViewProfile?.(item.viewer_id)}
    >
      <Image
        source={{ 
          uri: item.viewer_avatar || 'https://via.placeholder.com/40x40.png?text=👤' 
        }}
        style={styles.avatar}
      />
      
      <View style={styles.viewerInfo}>
        <Text style={[styles.viewerName, { color: colors.text }]}>
          {item.viewer_username || 'Unknown User'}
        </Text>
        <Text style={[styles.viewTime, { color: colors.textSecondary }]}>
          Viewed {item.viewed_at ? formatTimeAgo(item.viewed_at) : 'recently'}
        </Text>
      </View>
      
      <Feather name="chevron-right" size={20} color={colors.textSecondary} />
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Feather name="eye-off" size={48} color={colors.textSecondary} />
      <Text style={[styles.emptyTitle, { color: colors.text }]}>
        No Profile Views Yet
      </Text>
      <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
        When people view your profile, they&apos;ll appear here. Share your profile to get more views!
      </Text>
    </View>
  );

  const renderPremiumRequired = () => (
    <View style={styles.premiumRequired}>
      <Feather name="lock" size={48} color={colors.textSecondary} />
      <Text style={[styles.premiumTitle, { color: colors.text }]}>
        Profile Views Premium Feature
      </Text>
      <Text style={[styles.premiumText, { color: colors.textSecondary }]}>
        Invite 5 friends to unlock this feature and see who&apos;s viewing your profile!
      </Text>
      <TouchableOpacity 
        style={[styles.premiumButton, { backgroundColor: colors.primary }]}
        onPress={() => {
          // Navigate to referral dashboard
        }}
      >
        <Text style={styles.premiumButtonText}>Start Inviting</Text>
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          Loading profile viewers...
        </Text>
      </View>
    );
  }

  // If no viewers and no analytics, check if user has premium access
  // Users with 5+ completed referrals should see the profile views directly
  //// console.log('🔍 Rendering decision values:', {
// //   analytics: !!analytics,
// //   viewersLength: viewers.length,
// //   hasPremium: hasPremium,
// //   shouldShowPremiumMessage: !analytics && viewers.length === 0 && !hasPremium
// // });
  
  if (!analytics && viewers.length === 0 && !hasPremium) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {renderPremiumRequired()}
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {renderAnalytics()}
      
      <View style={styles.viewersSection}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Recent Profile Views
        </Text>
        
        <FlatList
          data={viewers}
          renderItem={renderViewer}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={renderEmptyState}
          contentContainerStyle={viewers.length === 0 ? styles.emptyContainer : undefined}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  analyticsContainer: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: 'Rubik-SemiBold',
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    gap: 8,
  },
  statValue: {
    fontSize: 20,
    fontFamily: 'Rubik-Bold',
  },
  statLabel: {
    fontSize: 12,
    fontFamily: 'Rubik-Medium',
    textAlign: 'center',
  },
  viewersSection: {
    flex: 1,
  },
  viewerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  viewerInfo: {
    flex: 1,
  },
  viewerName: {
    fontSize: 16,
    fontFamily: 'Rubik-SemiBold',
    marginBottom: 2,
  },
  viewTime: {
    fontSize: 14,
    fontFamily: 'Rubik-Regular',
  },
  emptyState: {
    alignItems: 'center',
    padding: 32,
  },
  emptyContainer: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: 'Rubik-SemiBold',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: 'Rubik-Regular',
    textAlign: 'center',
    lineHeight: 20,
  },
  premiumRequired: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  premiumTitle: {
    fontSize: 20,
    fontFamily: 'Rubik-SemiBold',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  premiumText: {
    fontSize: 16,
    fontFamily: 'Rubik-Regular',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  premiumButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  premiumButtonText: {
    color: 'white',
    fontSize: 16,
    fontFamily: 'Rubik-SemiBold',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    fontFamily: 'Rubik-Regular',
  },
});

export default ProfileViewers;

