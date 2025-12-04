import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/context/ThemeContext';
import { notificationSettingsAPI, NotificationSettings } from '@/lib/notificationSettingsApi';
import { ThemedGradient } from '@/components/ThemedGradient';

export default function NotificationSettingsScreen() {
  const router = useRouter();
  const { colors, isDarkMode } = useTheme();
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const userSettings = await notificationSettingsAPI.getCurrentUserSettings();
      setSettings(userSettings);
    } catch (__error) {
      console.error('Error loading notification settings:', __error);
      Alert.alert('Error', 'Failed to load notification settings');
    } finally {
      setLoading(false);
    }
  };

  const updateSetting = async (key: keyof NotificationSettings, value: boolean) => {
    if (!settings) return;

    try {
      setSaving(true);
      const updatedSettings = await notificationSettingsAPI.updateCurrentUserSettings({
        [key]: value,
      });
      setSettings(updatedSettings);
    } catch (__error) {
      console.error('Error updating setting:', __error);
      Alert.alert('Error', 'Failed to update setting');
    } finally {
      setSaving(false);
    }
  };

  const updateQuietHours = async (enabled: boolean, startTime?: string, endTime?: string) => {
    if (!settings) return;

    try {
      setSaving(true);
      const updatedSettings = await notificationSettingsAPI.updateQuietHours(
        settings.user_id,
        enabled,
        startTime || settings.quiet_start_time,
        endTime || settings.quiet_end_time
      );
      setSettings(updatedSettings);
    } catch (__error) {
      console.error('Error updating quiet hours:', __error);
      Alert.alert('Error', 'Failed to update quiet hours');
    } finally {
      setSaving(false);
    }
  };

  const formatTime = (timeString: string) => {
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  if (loading) {
    return (
      <ThemedGradient>
        <SafeAreaView style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()}>
              <Feather name="arrow-left" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: colors.text }]}>
              Notification Settings
            </Text>
            <View style={{ width: 24 }} />
          </View>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        </SafeAreaView>
      </ThemedGradient>
    );
  }

  if (!settings) {
    return (
      <ThemedGradient>
        <SafeAreaView style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()}>
              <Feather name="arrow-left" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: colors.text }]}>
              Notification Settings
            </Text>
            <View style={{ width: 24 }} />
          </View>
          <View style={styles.errorContainer}>
            <Text style={[styles.errorText, { color: colors.text }]}>
              Failed to load notification settings
            </Text>
            <TouchableOpacity
              style={[styles.retryButton, { backgroundColor: colors.primary }]}
              onPress={loadSettings}
            >
              <Text style={[styles.retryButtonText, { color: colors.background }]}>
                Retry
              </Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </ThemedGradient>
    );
  }

  const SettingItem = ({ 
    title, 
    subtitle, 
    value, 
    onToggle, 
    icon 
  }: { 
    title: string; 
    subtitle?: string; 
    value: boolean; 
    onToggle: (value: boolean) => void; 
    icon: string;
  }) => (
    <View style={[styles.settingItem, { 
      backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
      borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
    }]}>
      <View style={styles.settingLeft}>
        <Feather name={icon as any} size={20} color={colors.text} />
        <View style={styles.settingTextContainer}>
          <Text style={[styles.settingTitle, { color: colors.text }]}>{title}</Text>
          {subtitle && (
            <Text style={[styles.settingSubtitle, { color: colors.textSecondary }]}>
              {subtitle}
            </Text>
          )}
        </View>
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: colors.border, true: colors.primary }}
        thumbColor={value ? colors.background : colors.textSecondary}
        disabled={saving}
      />
    </View>
  );

  return (
    <ThemedGradient>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Feather name="arrow-left" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            Notification Settings
          </Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Global Settings */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              General
            </Text>
            
            <SettingItem
              title="Push Notifications"
              subtitle="Enable or disable all push notifications"
              value={settings.notifications_enabled}
              onToggle={(value) => updateSetting('notifications_enabled', value)}
              icon="bell"
            />
            
            <SettingItem
              title="Sound"
              subtitle="Play sound when notifications arrive"
              value={settings.sound_enabled}
              onToggle={(value) => updateSetting('sound_enabled', value)}
              icon="volume-2"
            />
            
            <SettingItem
              title="Vibration"
              subtitle="Vibrate when notifications arrive"
              value={settings.vibration_enabled}
              onToggle={(value) => updateSetting('vibration_enabled', value)}
              icon="smartphone"
            />
            
            <SettingItem
              title="Status Bar"
              subtitle="Show notifications in status bar"
              value={settings.status_bar_enabled}
              onToggle={(value) => updateSetting('status_bar_enabled', value)}
              icon="monitor"
            />
          </View>

          {/* Notification Types */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Notification Types
            </Text>
            
            <SettingItem
              title="Likes"
              subtitle="When someone likes your posts"
              value={settings.likes_enabled}
              onToggle={(value) => updateSetting('likes_enabled', value)}
              icon="heart"
            />
            
            <SettingItem
              title="Comments"
              subtitle="When someone comments on your posts"
              value={settings.comments_enabled}
              onToggle={(value) => updateSetting('comments_enabled', value)}
              icon="message-circle"
            />
            
            <SettingItem
              title="New Followers"
              subtitle="When someone follows you"
              value={settings.follows_enabled}
              onToggle={(value) => updateSetting('follows_enabled', value)}
              icon="user-plus"
            />
            
            <SettingItem
              title="Mentions"
              subtitle="When someone mentions you"
              value={settings.mentions_enabled}
              onToggle={(value) => updateSetting('mentions_enabled', value)}
              icon="at-sign"
            />
            
            <SettingItem
              title="Shares"
              subtitle="When someone shares your posts"
              value={settings.shares_enabled}
              onToggle={(value) => updateSetting('shares_enabled', value)}
              icon="share"
            />
            
            <SettingItem
              title="New Posts"
              subtitle="When people you follow post new content"
              value={settings.new_posts_enabled}
              onToggle={(value) => updateSetting('new_posts_enabled', value)}
              icon="camera"
            />
            
            <SettingItem
              title="Messages"
              subtitle="When you receive direct messages"
              value={settings.messages_enabled}
              onToggle={(value) => updateSetting('messages_enabled', value)}
              icon="mail"
            />
            
            <SettingItem
              title="Referrals"
              subtitle="Updates about your referral program"
              value={settings.referrals_enabled}
              onToggle={(value) => updateSetting('referrals_enabled', value)}
              icon="gift"
            />
            
            <SettingItem
              title="Profile Views"
              subtitle="When someone views your profile (Premium)"
              value={settings.profile_views_enabled}
              onToggle={(value) => updateSetting('profile_views_enabled', value)}
              icon="eye"
            />
            
            <SettingItem
              title="Leaderboard"
              subtitle="Updates about your leaderboard ranking"
              value={settings.leaderboard_enabled}
              onToggle={(value) => updateSetting('leaderboard_enabled', value)}
              icon="award"
            />
          </View>

          {/* Quiet Hours */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Quiet Hours
            </Text>
            
            <SettingItem
              title="Enable Quiet Hours"
              subtitle="Disable notifications during specific hours"
              value={settings.quiet_hours_enabled}
              onToggle={(value) => updateQuietHours(value)}
              icon="moon"
            />
            
            {settings.quiet_hours_enabled && (
              <View style={[styles.quietHoursContainer, { 
                backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
              }]}>
                <Text style={[styles.quietHoursText, { color: colors.textSecondary }]}>
                  Quiet hours: {formatTime(settings.quiet_start_time)} - {formatTime(settings.quiet_end_time)}
                </Text>
                <Text style={[styles.quietHoursNote, { color: colors.textSecondary }]}>
                  Tap to customize quiet hours (coming soon)
                </Text>
              </View>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    fontFamily: 'Rubik-SemiBold',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
    fontFamily: 'Rubik-Regular',
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Rubik-SemiBold',
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
    fontFamily: 'Rubik-Bold',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Rubik-SemiBold',
  },
  settingSubtitle: {
    fontSize: 14,
    marginTop: 2,
    fontFamily: 'Rubik-Regular',
  },
  quietHoursContainer: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 8,
  },
  quietHoursText: {
    fontSize: 14,
    fontFamily: 'Rubik-Medium',
    marginBottom: 4,
  },
  quietHoursNote: {
    fontSize: 12,
    fontFamily: 'Rubik-Regular',
    fontStyle: 'italic',
  },
});

