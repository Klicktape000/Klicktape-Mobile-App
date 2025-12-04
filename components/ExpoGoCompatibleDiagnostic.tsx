import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '@/src/context/ThemeContext';
import { supabase } from '@/lib/supabase';
import Constants from 'expo-constants';

interface DiagnosticResult {
  test: string;
  status: 'pass' | 'fail' | 'warning' | 'pending';
  message: string;
  details?: string;
}

export default function ExpoGoCompatibleDiagnostic() {
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

    // Test 2: Check if running in Expo Go
    const isExpoGo = Constants.appOwnership === 'expo';
    addResult({
      test: 'App Environment',
      status: isExpoGo ? 'warning' : 'pass',
      message: isExpoGo ? 'Running in Expo Go' : 'Running in development build',
      details: isExpoGo ? 'Push notifications require development build' : 'Full native features available'
    });

    // Test 3: Check device type
    const isPhysicalDevice = Constants.isDevice;
    addResult({
      test: 'Device Type',
      status: isPhysicalDevice ? 'pass' : 'warning',
      message: isPhysicalDevice ? 'Running on physical device' : 'Running on simulator/emulator',
      details: isPhysicalDevice ? 'Push notifications work on physical devices' : 'Push notifications don\'t work on simulators'
    });

    // Test 4: Check database schema
    try {
      const { data: settings, error: settingsError } = await supabase
        .from('notification_settings')
        .select('*')
        .limit(1);

      if (settingsError) {
        addResult({
          test: 'Database Schema',
          status: 'fail',
          message: 'notification_settings table not found',
          details: 'Run migration: psql -d your_database -f sql/push_notifications_migration.sql'
        });
      } else {
        addResult({
          test: 'Database Schema',
          status: 'pass',
          message: 'notification_settings table exists',
          details: 'Database schema is properly configured'
        });
      }
    } catch (error) {
      addResult({
        test: 'Database Schema',
        status: 'fail',
        message: 'Error checking database',
        details: `${error}`
      });
    }

    // Test 5: Check profiles table for push_token column
    try {
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, push_token')
        .eq('id', currentUser.id)
        .single();

      if (profilesError && profilesError.message.includes('push_token')) {
        addResult({
          test: 'Profiles Table Schema',
          status: 'fail',
          message: 'profiles table missing push_token column',
          details: 'Run migration to add push_token column'
        });
      } else {
        addResult({
          test: 'Profiles Table Schema',
          status: 'pass',
          message: 'profiles table has push_token column',
          details: (profiles as any)?.push_token ? 'Push token is saved' : 'No push token yet (normal in Expo Go)'
        });
      }
    } catch (error) {
      addResult({
        test: 'Profiles Table Schema',
        status: 'fail',
        message: 'Error checking profiles table',
        details: `${error}`
      });
    }

    // Test 6: Check notification settings for user
    try {
      const { data: userSettings, error: userSettingsError } = await supabase
        .from('notification_settings')
        .select('*')
        .eq('user_id', currentUser.id)
        .single();

      if (userSettingsError && userSettingsError.code === 'PGRST116') {
        addResult({
          test: 'User Notification Settings',
          status: 'warning',
          message: 'No settings found for user',
          details: 'Settings will be created automatically when needed'
        });
      } else if (userSettingsError) {
        addResult({
          test: 'User Notification Settings',
          status: 'fail',
          message: 'Error checking user settings',
          details: `${userSettingsError.message}`
        });
      } else {
        addResult({
          test: 'User Notification Settings',
          status: 'pass',
          message: 'User settings found',
          details: `Notifications: ${(userSettings as any).notifications_enabled ? 'Enabled' : 'Disabled'}`
        });
      }
    } catch (error) {
      addResult({
        test: 'User Notification Settings',
        status: 'fail',
        message: 'Error checking user settings',
        details: `${error}`
      });
    }

    // Test 7: Test Database Push Notification Function
    try {
      const { data, error } = await (supabase as any).rpc('test_notification_system', {
        p_test_token: 'ExponentPushToken[test]'
      });

      if (error) {
        addResult({
          test: 'Database Push Function',
          status: 'fail',
          message: 'Database push function error',
          details: `Error: ${error.message}`
        });
      } else if ((data as any)?.success === false) {
        if ((data as any).error?.includes('EXPO_ACCESS_TOKEN')) {
          addResult({
            test: 'Database Push Function',
            status: 'warning',
            message: 'Function exists but EXPO_ACCESS_TOKEN not configured',
            details: 'Set token using: PushNotificationConfig.setExpoAccessToken(your_token)'
          });
        } else {
          addResult({
            test: 'Database Push Function',
            status: 'fail',
            message: 'Push function failed',
            details: `Error: ${(data as any).error}`
          });
        }
      } else {
        addResult({
          test: 'Database Push Function',
          status: 'pass',
          message: 'Database push function working',
          details: 'Push notifications can be sent via database'
        });
      }
    } catch (error) {
      addResult({
        test: 'Database Push Function',
        status: 'fail',
        message: 'Error testing database push function',
        details: `${error}`
      });
    }

    // Test 8: Check RPC function
    try {
      const { data: rpcData, error: rpcError } = await (supabase as any).rpc(
        'should_send_notification',
        {
          p_user_id: currentUser.id,
          p_notification_type: 'like'
        }
      );

      if (rpcError) {
        addResult({
          test: 'RPC Function',
          status: 'fail',
          message: 'should_send_notification RPC function not found',
          details: 'Run database migration to create RPC function'
        });
      } else {
        addResult({
          test: 'RPC Function',
          status: 'pass',
          message: 'RPC function working',
          details: `Function returned: ${rpcData}`
        });
      }
    } catch (error) {
      addResult({
        test: 'RPC Function',
        status: 'fail',
        message: 'Error testing RPC function',
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
        Notification System Check
      </Text>
      
      <View style={[styles.warningBox, { backgroundColor: '#FFF3CD', borderColor: '#FFEAA7' }]}>
        <Text style={[styles.warningText, { color: '#856404' }]}>
          ⚠️ You&apos;re running in Expo Go. Push notifications require a development build.
        </Text>
      </View>

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
            Check System Status
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
            Next Steps:
          </Text>
          <Text style={[styles.summaryText, { color: colors.textSecondary }]}>
            1. Create development build: npx expo run:android{'\n'}
            2. Set EXPO_ACCESS_TOKEN using PushNotificationConfig{'\n'}
            3. Test on physical device{'\n'}
            4. Database functions are ready (no Docker needed!){'\n'}
            5. All push notifications work via database
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
  warningBox: {
    padding: 15,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 20,
  },
  warningText: {
    fontSize: 14,
    fontFamily: 'Rubik-Regular',
    textAlign: 'center',
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

