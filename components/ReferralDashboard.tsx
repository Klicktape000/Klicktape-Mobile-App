import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator,
  Clipboard
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/src/context/ThemeContext';
import { referralAPI, ReferralDashboard as ReferralDashboardType } from '@/lib/referralApi';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import FallbackCache from '@/lib/utils/fallbackCache';

interface ReferralDashboardProps {
  userId: string;
}

const ReferralDashboard: React.FC<ReferralDashboardProps> = ({ userId }) => {
  const { colors } = useTheme();
  const queryClient = useQueryClient();

  // Hydrate from AsyncStorage snapshots for instant first render
  useEffect(() => {
    const hydrateSnapshots = async () => {
      try {
        if (!userId) return;
        const dashSnap = await FallbackCache.get<ReferralDashboardType>(`referral:dashboard:${userId}`);
        if (dashSnap) {
          queryClient.setQueryData(['referral', 'dashboard', userId], dashSnap);
        }
        const linkSnap = await FallbackCache.get<string | null>(`referral:link:${userId}`);
        if (typeof linkSnap !== 'undefined') {
          queryClient.setQueryData(['referral', 'link', userId], linkSnap);
        }
      } catch (__err) {
        // Silent hydration failure
      }
    };
    hydrateSnapshots();
  }, [userId, queryClient]);

  // ULTRA-OPTIMIZED: Use TanStack Query with snapshot write-through
  const { data: dashboard, isLoading: dashboardLoading, refetch: refetchDashboard, isFetched: dashboardFetched } = useQuery({
    queryKey: ['referral', 'dashboard', userId],
    queryFn: () => referralAPI.getReferralDashboard(userId),
    enabled: !!userId,
    staleTime: Infinity,
    gcTime: 24 * 60 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    networkMode: 'offlineFirst',
    onSuccess: async (data) => {
      if (data) {
        await FallbackCache.set<ReferralDashboardType>(`referral:dashboard:${userId}`, data, 1800);
      }
    }
  });

  const { data: referralLink, isLoading: linkLoading, refetch: refetchLink, isFetched: linkFetched } = useQuery({
    queryKey: ['referral', 'link', userId],
    queryFn: () => referralAPI.generateReferralLink(userId),
    enabled: !!userId,
    staleTime: Infinity,
    gcTime: 24 * 60 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    networkMode: 'offlineFirst',
    onSuccess: async (data) => {
      await FallbackCache.set<string | null>(`referral:link:${userId}`, data ?? null, 3600);
    }
  });

  // Show skeleton IMMEDIATELY when loading with no cached data
  const shouldShowSkeleton = (dashboardLoading && !dashboardFetched && !dashboard) || 
                             (linkLoading && !linkFetched && !referralLink);

  const refreshDashboard = async () => {
    await Promise.all([refetchDashboard(), refetchLink()]);
  };

  const renderProgressBar = () => {
    if (!dashboard) return null;

    // Cap the displayed values at completion threshold
    const displayedCompleted = Math.min(dashboard.referrals_completed, dashboard.referrals_required);
    const displayedPercentage = Math.min(dashboard.progress_percentage, 100);
    const progress = displayedPercentage / 100;
    const isCompleted = dashboard.has_premium;

    return (
      <View style={[styles.progressContainer, { backgroundColor: colors.backgroundSecondary }]}>
        <View style={styles.progressHeader}>
          <View>
            <Text style={[styles.progressTitle, { color: colors.text }]}>
              Profile Views Progress
            </Text>
            <Text style={[styles.progressText, { color: colors.textSecondary }]}>
              {displayedCompleted}/{dashboard.referrals_required} referrals
            </Text>
          </View>
          <TouchableOpacity
            onPress={refreshDashboard}
            style={[styles.refreshButton, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
          >
            <Feather name="refresh-cw" size={16} color={colors.primary} />
          </TouchableOpacity>
        </View>
        
        <View style={[styles.progressBarContainer, { backgroundColor: colors.cardBorder }]}>
          <View 
            style={[
              styles.progressBar,
              { 
                backgroundColor: isCompleted ? '#10B981' : colors.primary,
                width: `${Math.max(progress * 100, 5)}%`
              }
            ]}
          />
        </View>
        
        <View style={styles.progressFooter}>
          <Text style={[styles.progressPercentage, { color: colors.text }]}>
            {displayedPercentage}%
          </Text>
          {isCompleted && (
            <View style={styles.completedBadge}>
              <Feather name="check-circle" size={16} color="#10B981" />
              <Text style={[styles.completedText, { color: '#10B981' }]}>
                Unlocked!
              </Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  const renderReferralStats = () => {
    if (!dashboard) return null;

    const stats = [
      {
        icon: 'users',
        label: 'Total Invites',
        value: dashboard.total_referrals,
        color: colors.primary
      },
      {
        icon: 'clock',
        label: 'Pending',
        value: dashboard.pending_referrals,
        color: '#F59E0B'
      },
      {
        icon: 'check-circle',
        label: 'Completed',
        value: dashboard.completed_referrals,
        color: '#10B981'
      }
    ];

    return (
      <View style={styles.statsContainer}>
        {stats.map((stat, index) => (
          <View 
            key={index}
            style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
          >
            <Feather name={stat.icon as any} size={24} color={stat.color} />
            <Text style={[styles.statValue, { color: colors.text }]}>
              {stat.value}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
              {stat.label}
            </Text>
          </View>
        ))}
      </View>
    );
  };

  const renderShareButtons = () => {
    return (
      <View style={styles.shareContainer}>
      </View>
    );
  };

  // Skeleton loader
  const renderSkeleton = () => (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <View style={[styles.skeletonBox, { backgroundColor: colors.card, width: 200, height: 32 }]} />
        <View style={[styles.skeletonBox, { backgroundColor: colors.card, width: 250, height: 20, marginTop: 8 }]} />
      </View>
      <View style={[styles.skeletonBox, { backgroundColor: colors.card, height: 100, marginBottom: 20 }]} />
      <View style={[styles.skeletonBox, { backgroundColor: colors.card, height: 120, marginBottom: 24 }]} />
      <View style={styles.statsContainer}>
        {[1, 2, 3].map((i) => (
          <View key={i} style={[styles.skeletonBox, { backgroundColor: colors.card, height: 100, flex: 1 }]} />
        ))}
      </View>
    </View>
  );

  if (shouldShowSkeleton && !dashboard) {
    return renderSkeleton();
  }

  if (!dashboard) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Feather name="alert-circle" size={48} color={colors.textSecondary} />
        <Text style={[styles.errorText, { color: colors.text }]}>
          Unable to load referral data
        </Text>
        <TouchableOpacity 
          style={[styles.retryButton, { backgroundColor: colors.primary }]}
          onPress={refreshDashboard}
        >
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView 
      style={[styles.container, { backgroundColor: colors.background }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>
          Referral Program
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Invite 5 friends to unlock Profile Views
        </Text>
      </View>

      {/* Referral Code Section */}
      <View style={[styles.codeCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <View style={styles.codeHeader}>
          <Feather name="gift" size={20} color={colors.primary} />
          <Text style={[styles.codeTitle, { color: colors.text }]}>Your Referral Code</Text>
        </View>
        <View style={[styles.codeContainer, { backgroundColor: colors.backgroundSecondary }]}>
          <Text style={[styles.codeText, { color: colors.primary }]}>
            {dashboard.referral_code}
          </Text>
          <TouchableOpacity
            onPress={() => {
              Clipboard.setString(dashboard.referral_code);
              Alert.alert('Copied!', 'Referral code copied to clipboard');
            }}
            style={[styles.codeButton, { backgroundColor: colors.primary }]}
          >
            <Feather name="copy" size={16} color="white" />
          </TouchableOpacity>
        </View>
      </View>

      {renderProgressBar()}
      {renderReferralStats()}
      {renderShareButtons()}

      <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <Feather name="info" size={24} color={colors.primary} />
        <View style={styles.infoContent}>
          <Text style={[styles.infoTitle, { color: colors.text }]}>
            How it works
          </Text>
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>
            Share your unique invite link with friends. When 5 friends sign up and verify their accounts, you&apos;ll unlock the Profile Views feature to see who&apos;s checking out your profile!
          </Text>
        </View>
      </View>
    </ScrollView>
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
  header: {
    marginBottom: 24,
  },
  codeCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
  },
  codeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  codeTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  codeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 8,
  },
  codeText: {
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  codeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    fontFamily: 'Rubik-Bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: 'Rubik-Regular',
  },
  progressContainer: {
    padding: 20,
    borderRadius: 16,
    marginBottom: 24,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  refreshButton: {
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  progressTitle: {
    fontSize: 18,
    fontFamily: 'Rubik-SemiBold',
  },
  progressText: {
    fontSize: 14,
    fontFamily: 'Rubik-Medium',
  },
  progressBarContainer: {
    height: 8,
    borderRadius: 4,
    marginBottom: 12,
  },
  progressBar: {
    height: '100%',
    borderRadius: 4,
  },
  progressFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressPercentage: {
    fontSize: 16,
    fontFamily: 'Rubik-SemiBold',
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  completedText: {
    fontSize: 14,
    fontFamily: 'Rubik-SemiBold',
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    gap: 8,
  },
  statValue: {
    fontSize: 24,
    fontFamily: 'Rubik-Bold',
  },
  statLabel: {
    fontSize: 12,
    fontFamily: 'Rubik-Medium',
    textAlign: 'center',
  },
  shareContainer: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: 'Rubik-SemiBold',
    marginBottom: 16,
  },
  linkContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 16,
  },
  linkText: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Rubik-Regular',
  },
  copyButton: {
    padding: 8,
  },
  shareButtonsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  shareButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  shareButtonText: {
    color: 'white',
    fontSize: 16,
    fontFamily: 'Rubik-SemiBold',
  },
  infoCard: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 16,
    fontFamily: 'Rubik-SemiBold',
    marginBottom: 4,
  },
  infoText: {
    fontSize: 14,
    fontFamily: 'Rubik-Regular',
    lineHeight: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    fontFamily: 'Rubik-Regular',
  },
  errorText: {
    fontSize: 18,
    fontFamily: 'Rubik-SemiBold',
    marginTop: 12,
    marginBottom: 16,
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontFamily: 'Rubik-SemiBold',
  },
  skeletonBox: {
    borderRadius: 12,
    opacity: 0.5,
  },
});

export default ReferralDashboard;

