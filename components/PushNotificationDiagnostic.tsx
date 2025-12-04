import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '@/src/context/ThemeContext';
import { notificationService } from '@/lib/notificationService';
import { notificationSettingsAPI } from '@/lib/notificationSettingsApi';
import { supabase } from '@/lib/supabase';
import Constants from 'expo-constants';

interface DiagnosticResult {
  test: string;
  status: 'pass' | 'fail' | 'warning' | 'pending';
  message: string;
  details?: string;
}

export default function PushNotificationDiagnostic() {
  const { colors, isDarkMode } = useTheme();
  const [results, setResults] = useState<DiagnosticResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    getCurrentUser();
  }, []);

  const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUser(user);
  };

  const addResult = (result: DiagnosticResult) => {
    setResults(prev => [...prev, result]);
  };

  const runDiagnostics = async () => {
    setIsRunning(true);
    setResults([]);

    // Test 1: Check if user is authenticated
    addResult({
      test: 'User Authentication',
      status: currentUser ? 'pass' : 'fail',
      message: currentUser ? `Authenticated as ${currentUser.email}` : 'User not authenticated',
      details: currentUser ? `User ID: ${currentUser.id}` : 'Please log in to test notifications'
    });

    if (!currentUser) {
      setIsRunning(false);
      return;
    }

    // Test 2: Check notification permissions
    try {
      const permissionsGranted = await notificationService.areNotificationsEnabled();
      addResult({
        test: 'Notification Permissions',
        status: permissionsGranted ? 'pass' : 'fail',
        message: permissionsGranted ? 'Permissions granted' : 'Permissions not granted',
        details: permissionsGranted ? 'App can send notifications' : 'Request permissions first'
      });
    } catch (error) {
      addResult({
        test: 'Notification Permissions',
        status: 'fail',
        message: 'Error checking permissions',
        details: `${error}`
      });
    }

    // Test 3: Check push token
    try {
      const pushToken = notificationService.getPushToken();
      addResult({
        test: 'Push Token',
        status: pushToken ? 'pass' : 'fail',
        message: pushToken ? 'Push token available' : 'No push token',
        details: pushToken ? `Token: ${pushToken.substring(0, 50)}...` : 'Token needed for push notifications'
      });

      // Test 4: Check if push token is saved in database
      if (pushToken) {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('push_token')
          .eq('id', currentUser.id)
          .single();

        if (error) {
          addResult({
            test: 'Database Push Token',
            status: 'fail',
            message: 'Error checking database',
            details: `Database error: ${error.message}`
          });
        } else {
          addResult({
            test: 'Database Push Token',
            status: (profile as any)?.push_token ? 'pass' : 'warning',
            message: (profile as any)?.push_token ? 'Token saved in database' : 'Token not saved in database',
            details: (profile as any)?.push_token ? 'Database has current push token' : 'Token may need to be updated'
          });
        }
      }
    } catch (error) {
      addResult({
        test: 'Push Token',
        status: 'fail',
        message: 'Error getting push token',
        details: `${error}`
      });
    }

    // Test 5: Check notification settings
    try {
      const settings = await notificationSettingsAPI.getCurrentUserSettings();
      if (settings) {
        addResult({
          test: 'User Notification Settings',
          status: settings.notifications_enabled ? 'pass' : 'warning',
          message: settings.notifications_enabled ? 'Notifications enabled' : 'Notifications disabled by user',
          details: `Sound: ${settings.sound_enabled}, Likes: ${settings.likes_enabled}, Comments: ${settings.comments_enabled}`
        });
      } else {
        addResult({
          test: 'User Notification Settings',
          status: 'warning',
          message: 'No settings found',
          details: 'Default settings will be created'
        });
      }
    } catch (error) {
      addResult({
        test: 'User Notification Settings',
        status: 'fail',
        message: 'Error checking settings',
        details: `${error}`
      });
    }

    // Test 6: Check if running on physical device
    const isPhysicalDevice = !Constants.isDevice ? false : true;
    addResult({
      test: 'Device Type',
      status: isPhysicalDevice ? 'pass' : 'warning',
      message: isPhysicalDevice ? 'Running on physical device' : 'Running on simulator/emulator',
      details: isPhysicalDevice ? 'Push notifications work on physical devices' : 'Push notifications don\'t work on simulators'
    });

    // Test 7: Test Supabase Edge Function
    try {
      const { error } = await supabase.functions.invoke('send-push-notification', {
        body: {
          test: true,
          to: 'ExponentPushToken[test]',
          title: 'Test',
          body: 'Test notification'
        }
      });

      if (error) {
        if (error.message.includes('Function not found')) {
          addResult({
            test: 'Supabase Edge Function',
            status: 'fail',
            message: 'Edge function not deployed',
            details: 'Deploy with: supabase functions deploy send-push-notification'
          });
        } else if (error.message.includes('EXPO_ACCESS_TOKEN')) {
          addResult({
            test: 'Supabase Edge Function',
            status: 'warning',
            message: 'Edge function exists but missing EXPO_ACCESS_TOKEN',
            details: 'Set token with: supabase secrets set EXPO_ACCESS_TOKEN=your_token'
          });
        } else {
          addResult({
            test: 'Supabase Edge Function',
            status: 'fail',
            message: 'Edge function error',
            details: `Error: ${error.message}`
          });
        }
      } else {
        addResult({
          test: 'Supabase Edge Function',
          status: 'pass',
          message: 'Edge function responding',
          details: 'Function is deployed and accessible'
        });
      }
    } catch (error) {
      addResult({
        test: 'Supabase Edge Function',
        status: 'fail',
        message: 'Error testing edge function',
        details: `${error}`
      });
    }

    // Test 8: Test local notification
    try {
      await notificationService.sendTestNotification();
      addResult({
        test: 'Local Notification',
        status: 'pass',
        message: 'Local notification sent',
        details: 'Check if notification appeared on device'
      });
    } catch (error) {
      addResult({
        test: 'Local Notification',
        status: 'fail',
        message: 'Failed to send local notification',
        details: `${error}`
      });
    }

    setIsRunning(false);
  };

  const getStatusColor = (status: DiagnosticResult['status']) => {
    switch (status) {
      case 'pass': return '#4CAF50';
      case 'fail': return '#F44336';
      case 'warning': return '#FF9800';
      case 'pending': return colors.textSecondary;
      default: return colors.text;
    }
  };

  const getStatusIcon = (status: DiagnosticResult['status']) => {
    switch (status) {
      case 'pass': return '✅';
      case 'fail': return '❌';
      case 'warning': return '⚠️';
      case 'pending': return '⏳';
      default: return '❓';
    }
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.text }]}>
        Push Notification Diagnostics
      </Text>

      <TouchableOpacity
        style={[
          styles.runButton,
          {
            backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
            borderColor: colors.border,
          }
        ]}
        onPress={runDiagnostics}
        disabled={isRunning}
      >
        {isRunning ? (
          <ActivityIndicator color={colors.text} />
        ) : (
          <Text style={[styles.runButtonText, { color: colors.text }]}>
            Run Diagnostics
          </Text>
        )}
      </TouchableOpacity>

      {results.map((result, index) => (
        <View key={index} style={[styles.resultItem, { borderColor: colors.border }]}>
          <View style={styles.resultHeader}>
            <Text style={[styles.resultIcon]}>
              {getStatusIcon(result.status)}
            </Text>
            <Text style={[styles.resultTest, { color: colors.text }]}>
              {result.test}
            </Text>
          </View>
          <Text style={[styles.resultMessage, { color: getStatusColor(result.status) }]}>
            {result.message}
          </Text>
          {result.details && (
            <Text style={[styles.resultDetails, { color: colors.textSecondary }]}>
              {result.details}
            </Text>
          )}
        </View>
      ))}

      {results.length > 0 && (
        <View style={styles.summary}>
          <Text style={[styles.summaryTitle, { color: colors.text }]}>
            Quick Fixes:
          </Text>
          <Text style={[styles.summaryText, { color: colors.textSecondary }]}>
            • If permissions failed: Request notification permissions{'\n'}
            • If push token missing: Restart app or check device settings{'\n'}
            • If edge function failed: Deploy function and set EXPO_ACCESS_TOKEN{'\n'}
            • If on simulator: Test on physical device{'\n'}
            • If settings missing: Check database migration
          </Text>
        </View>
      )}
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
  runButton: {
    padding: 15,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 20,
    alignItems: 'center',
  },
  runButtonText: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Rubik-SemiBold',
  },
  resultItem: {
    padding: 15,
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 10,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  resultIcon: {
    fontSize: 16,
    marginRight: 10,
  },
  resultTest: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Rubik-SemiBold',
    flex: 1,
  },
  resultMessage: {
    fontSize: 14,
    fontFamily: 'Rubik-Regular',
    marginBottom: 5,
  },
  resultDetails: {
    fontSize: 12,
    fontFamily: 'Rubik-Regular',
    fontStyle: 'italic',
  },
  summary: {
    marginTop: 20,
    padding: 15,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '600',
    fontFamily: 'Rubik-SemiBold',
    marginBottom: 10,
  },
  summaryText: {
    fontSize: 14,
    fontFamily: 'Rubik-Regular',
    lineHeight: 20,
  },
});

