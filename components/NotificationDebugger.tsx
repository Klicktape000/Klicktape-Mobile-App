import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useTheme } from '@/src/context/ThemeContext';
import { SupabaseNotificationBroadcaster } from '@/lib/supabaseNotificationManager';
import { notificationsAPI } from '@/lib/notificationsApi';
import { supabase } from '@/lib/supabase';

export const NotificationDebugger = () => {
  const { colors } = useTheme();
  const [loading, setLoading] = useState(false);
  const [testResults, setTestResults] = useState<string>('');

  const createTestNotification = async () => {
    setLoading(true);
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Error', 'No user found');
        return;
      }

      // console.log('🧪 Creating test notification for user:', user.id);

      // Create a test notification to self
      await SupabaseNotificationBroadcaster.broadcastLike(
        user.id, // recipient (self)
        user.id, // sender (self)
        'test-post-id', // fake post ID
        undefined // no reel ID
      );

      Alert.alert('Success', 'Test notification created!');
      setTestResults('✅ Test notification created successfully');
    } catch (__error) {
      // console.error('Error creating test notification:', error);
      Alert.alert('Error', 'Failed to create test notification');
      setTestResults(`❌ Error: ${__error instanceof Error ? __error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Error', 'No user found');
        return;
      }

      // console.log('🔍 Fetching notifications for user:', user.id);
      const notifications = await notificationsAPI.getNotifications(user.id);
      // console.log('📋 Fetched notifications:', notifications);
      
      setTestResults(`📋 Found ${notifications?.length || 0} notifications`);
      Alert.alert('Fetch Results', `Found ${notifications?.length || 0} notifications`);
    } catch (__error) {
      // console.error('Error fetching notifications:', error);
      Alert.alert('Error', 'Failed to fetch notifications');
      setTestResults(`❌ Fetch Error: ${__error instanceof Error ? __error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.backgroundSecondary }]}>
      <Text style={[styles.title, { color: colors.text }]}>Notification Debugger</Text>
      
      <TouchableOpacity
        style={[styles.button, { backgroundColor: colors.primary }]}
        onPress={createTestNotification}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? 'Creating...' : 'Create Test Notification'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, { backgroundColor: '#4CAF50', marginTop: 10 }]}
        onPress={fetchNotifications}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? 'Fetching...' : 'Fetch Notifications'}
        </Text>
      </TouchableOpacity>

      {testResults ? (
        <Text style={[styles.results, { color: colors.text }]}>{testResults}</Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    margin: 10,
    borderRadius: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  button: {
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  results: {
    marginTop: 15,
    fontSize: 14,
    fontStyle: 'italic',
  },
});
