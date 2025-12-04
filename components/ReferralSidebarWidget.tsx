import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/src/context/ThemeContext';
import { referralAPI, ReferralDashboard as ReferralDashboardType } from '@/lib/referralApi';

interface ReferralSidebarWidgetProps {
  userId: string;
  onOpenFullDashboard: () => void;
}

const ReferralSidebarWidget: React.FC<ReferralSidebarWidgetProps> = ({
  userId,
  onOpenFullDashboard,
}) => {
  const { colors } = useTheme();
  const [dashboard, setDashboard] = useState<ReferralDashboardType | null>(null);
  const [loading, setLoading] = useState(true);

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);
      const data = await referralAPI.getReferralDashboard(userId);
      setDashboard(data);
    } catch {
      // Handle error silently
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  if (loading) {
    return (
      <TouchableOpacity
        style={[
          styles.menuItem,
          {
            backgroundColor: colors.card,
            borderColor: colors.cardBorder
          }
        ]}
        disabled
      >
        <Feather name="gift" size={24} color={colors.text} />
        <Text style={[styles.menuText, { color: colors.textSecondary }]}>Loading referrals...</Text>
      </TouchableOpacity>
    );
  }

  if (!dashboard) {
    return null;
  }

  return (
    <TouchableOpacity
      style={[
        styles.menuItem,
        {
          backgroundColor: colors.card,
          borderColor: colors.cardBorder
        }
      ]}
      onPress={onOpenFullDashboard}
    >
      <Feather name="gift" size={24} color={colors.text} />
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={[styles.menuText, { color: colors.text }]}>Referrals</Text>
          {dashboard.has_premium && (
            <View style={[styles.premiumBadge, { backgroundColor: colors.primary }]}>
              <Text style={styles.premiumText}>PRO</Text>
            </View>
          )}
        </View>

        <Text style={[styles.progressText, { color: colors.textSecondary }]}>
          {dashboard.referrals_completed}/{dashboard.referrals_required} friends • {Math.round(dashboard.progress_percentage)}%
        </Text>

        <Text style={[styles.codeText, { color: colors.primary }]}>
          Code: {dashboard.referral_code}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 12,
    marginBottom: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  menuText: {
    marginLeft: 16,
    fontSize: 16,
    fontWeight: '500',
  },
  content: {
    flex: 1,
    marginLeft: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  premiumBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  premiumText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  progressText: {
    fontSize: 12,
    marginBottom: 2,
  },
  codeText: {
    fontSize: 11,
    fontWeight: '600',
  },
});

export default ReferralSidebarWidget;

