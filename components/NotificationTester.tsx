import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { useTheme } from '@/src/context/ThemeContext';
import { notificationService } from '@/lib/notificationService';
import { notificationSettingsAPI } from '@/lib/notificationSettingsApi';
import { supabase } from '@/lib/supabase';

export default function NotificationTester() {
  const { colors, isDarkMode } = useTheme();
  const [permissionsGranted, setPermissionsGranted] = useState(false);
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    try {
      // Check permissions
      const enabled = await notificationService.areNotificationsEnabled();
      setPermissionsGranted(enabled);

      // Get push token
      const token = notificationService.getPushToken();
      setPushToken(token);

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id || null);
    } catch {
      // console.error('Error checking notification status:', error);
    }
  };

  const requestPermissions = async () => {
    try {
      const granted = await notificationService.requestPermissions();
      setPermissionsGranted(granted);
      if (granted) {
        Alert.alert('Success', 'Notification permissions granted!');
        await checkStatus();
      } else {
        Alert.alert('Error', 'Notification permissions denied');
      }
    } catch {
      // console.error('Error requesting permissions:', error);
      Alert.alert('Error', 'Failed to request permissions');
    }
  };

  const testLocalNotification = async () => {
    try {
      setTesting(true);
      await notificationService.sendTestNotification();
      Alert.alert('Success', 'Test notification sent!');
    } catch {
      // console.error('Error sending test notification:', error);
      Alert.alert('Error', 'Failed to send test notification');
    } finally {
      setTesting(false);
    }
  };

  const testPushNotification = async () => {
    if (!userId) {
      Alert.alert('Error', 'User not authenticated');
      return;
    }

    try {
      setTesting(true);
      await notificationService.notifyLike('TestUser', 'test-post-id', userId);
      Alert.alert('Success', 'Push notification sent!');
    } catch {
      // console.error('Error sending push notification:', error);
      Alert.alert('Error', 'Failed to send push notification');
    } finally {
      setTesting(false);
    }
  };

  const testNotificationTypes = async () => {
    if (!userId) {
      Alert.alert('Error', 'User not authenticated');
      return;
    }

    try {
      setTesting(true);
      
      // Test different notification types
      await notificationService.notifyLike('TestUser', 'test-post-id', userId);
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      await notificationService.notifyComment('TestUser', 'test-post-id', userId, 'This is a test comment!');
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      await notificationService.notifyFollow('TestUser', userId, 'test-user-id');
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      await notificationService.notifyMessage('TestUser', userId, 'Hello! This is a test message.');
      
      Alert.alert('Success', 'All notification types tested!');
    } catch {
      // console.error('Error testing notification types:', error);
      Alert.alert('Error', 'Failed to test notification types');
    } finally {
      setTesting(false);
    }
  };

  const testBadgeCount = async () => {
    try {
      setTesting(true);
      // This will update the badge count based on unread notifications
      await notificationService.refreshBadgeCount();
      Alert.alert('Success', 'Badge count updated!');
    } catch {
      // console.error('Error updating badge count:', error);
      Alert.alert('Error', 'Failed to update badge count');
    } finally {
      setTesting(false);
    }
  };

  const openNotificationSettings = async () => {
    try {
      const settings = await notificationSettingsAPI.getCurrentUserSettings();
      Alert.alert(
        'Current Settings',
        `Notifications: ${settings?.notifications_enabled ? 'Enabled' : 'Disabled'}\n` +
        `Sound: ${settings?.sound_enabled ? 'Enabled' : 'Disabled'}\n` +
        `Likes: ${settings?.likes_enabled ? 'Enabled' : 'Disabled'}\n` +
        `Comments: ${settings?.comments_enabled ? 'Enabled' : 'Disabled'}`
      );
    } catch {
      // console.error('Error getting settings:', error);
      Alert.alert('Error', 'Failed to get notification settings');
    }
  };

  const TestButton = ({ title, onPress, disabled = false }: { 
    title: string; 
    onPress: () => void; 
    disabled?: boolean;
  }) => (
    <TouchableOpacity
      style={[
        styles.testButton,
        {
          backgroundColor: disabled 
            ? colors.border 
            : isDarkMode 
              ? 'rgba(255, 255, 255, 0.1)' 
              : 'rgba(0, 0, 0, 0.1)',
          borderColor: colors.border,
        }
      ]}
      onPress={onPress}
      disabled={disabled || testing}
    >
      <Text style={[
        styles.testButtonText,
        { 
          color: disabled ? colors.textSecondary : colors.text 
        }
      ]}>
        {title}
      </Text>
    </TouchableOpacity>
  );

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.text }]}>
        Notification System Tester
      </Text>

      {/* Status Section */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Status</Text>
        
        <View style={styles.statusItem}>
          <Text style={[styles.statusLabel, { color: colors.text }]}>Permissions:</Text>
          <Text style={[styles.statusValue, { color: permissionsGranted ? '#4CAF50' : '#F44336' }]}>
            {permissionsGranted ? 'Granted' : 'Not Granted'}
          </Text>
        </View>

        <View style={styles.statusItem}>
          <Text style={[styles.statusLabel, { color: colors.text }]}>Push Token:</Text>
          <Text style={[styles.statusValue, { color: pushToken ? '#4CAF50' : '#F44336' }]}>
            {pushToken ? 'Available' : 'Not Available'}
          </Text>
        </View>

        <View style={styles.statusItem}>
          <Text style={[styles.statusLabel, { color: colors.text }]}>User ID:</Text>
          <Text style={[styles.statusValue, { color: userId ? '#4CAF50' : '#F44336' }]}>
            {userId ? 'Authenticated' : 'Not Authenticated'}
          </Text>
        </View>
      </View>

      {/* Actions Section */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Actions</Text>

        {!permissionsGranted && (
          <TestButton
            title="Request Permissions"
            onPress={requestPermissions}
          />
        )}

        <TestButton
          title="Test Local Notification"
          onPress={testLocalNotification}
          disabled={!permissionsGranted}
        />

        <TestButton
          title="Test Push Notification"
          onPress={testPushNotification}
          disabled={!permissionsGranted || !userId}
        />

        <TestButton
          title="Test All Notification Types"
          onPress={testNotificationTypes}
          disabled={!permissionsGranted || !userId}
        />

        <TestButton
          title="Update Badge Count"
          onPress={testBadgeCount}
          disabled={!permissionsGranted}
        />

        <TestButton
          title="View Current Settings"
          onPress={openNotificationSettings}
          disabled={!userId}
        />

        <TestButton
          title="Refresh Status"
          onPress={checkStatus}
        />
      </View>

      {/* Instructions */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Instructions</Text>
        <Text style={[styles.instructions, { color: colors.textSecondary }]}>
          1. First, request permissions if not granted{'\n'}
          2. Test local notifications to verify basic functionality{'\n'}
          3. Test push notifications to verify server integration{'\n'}
          4. Test all notification types to verify different scenarios{'\n'}
          5. Check notification settings to verify user preferences{'\n\n'}
          Note: Push notifications require a physical device and won&apos;t work in simulators.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    fontFamily: 'Rubik-Bold',
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 15,
    fontFamily: 'Rubik-SemiBold',
  },
  statusItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  statusLabel: {
    fontSize: 16,
    fontFamily: 'Rubik-Regular',
  },
  statusValue: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Rubik-SemiBold',
  },
  testButton: {
    padding: 15,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 10,
    alignItems: 'center',
  },
  testButtonText: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Rubik-SemiBold',
  },
  instructions: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Rubik-Regular',
  },
});

