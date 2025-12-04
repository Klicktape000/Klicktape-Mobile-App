import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { useTheme } from '@/src/context/ThemeContext';
import { supabase } from '@/lib/supabase';

export default function PushNotificationTester() {
  const { colors, isDarkMode } = useTheme();
  const [isLoading, setIsLoading] = useState(false);
  const [testToken, setTestToken] = useState('ExponentPushToken[test-device-123]');
  const [results, setResults] = useState<any[]>([]);

  const addResult = (result: any) => {
    setResults(prev => [result, ...prev].slice(0, 5)); // Keep last 5 results
  };

  const testDatabaseFunction = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await (supabase as any).rpc('test_notification_system', {
        p_test_token: testToken
      });

      if (error) {
        addResult({
          test: 'Database Function Test',
          status: 'error',
          message: error.message,
          timestamp: new Date().toLocaleTimeString()
        });
      } else {
        addResult({
          test: 'Database Function Test',
          status: (data as any)?.success ? 'success' : 'warning',
          message: (data as any)?.success ? 'Function working!' : (data as any)?.error || 'Unknown error',
          details: JSON.stringify(data, null, 2),
          timestamp: new Date().toLocaleTimeString()
        });
      }
    } catch (error) {
      addResult({
        test: 'Database Function Test',
        status: 'error',
        message: `Error: ${error}`,
        timestamp: new Date().toLocaleTimeString()
      });
    } finally {
      setIsLoading(false);
    }
  };

  const testNotificationSending = async () => {
    setIsLoading(true);
    try {
      // Get current user ID
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        Alert.alert('Error', 'Please log in first');
        setIsLoading(false);
        return;
      }

      const { data, error } = await (supabase as any).rpc('send_notification', {
        p_type: 'like',
        p_recipient_id: user.id,
        p_sender_username: 'TestUser',
        p_data: { postId: 'test-post-123' }
      });

      if (error) {
        addResult({
          test: 'Send Notification Test',
          status: 'error',
          message: error.message,
          timestamp: new Date().toLocaleTimeString()
        });
      } else {
        addResult({
          test: 'Send Notification Test',
          status: (data as any)?.success ? 'success' : 'warning',
          message: (data as any)?.success ? 'Notification sent!' : (data as any)?.error || 'Failed to send',
          details: JSON.stringify(data, null, 2),
          timestamp: new Date().toLocaleTimeString()
        });
      }
    } catch (__error) {
      addResult({
        test: 'Send Notification Test',
        status: 'error',
        message: `Error: ${__error}`,
        timestamp: new Date().toLocaleTimeString()
      });
    } finally {
      setIsLoading(false);
    }
  };

  const checkConfiguration = async () => {
    setIsLoading(true);
    try {
      // Check if notification_settings table exists
      const { error: tableError } = await supabase
        .from('notification_settings')
        .select('count')
        .limit(1);

      // Check if functions exist by testing them
      const { error: funcError } = await supabase.rpc('test_notification_system');

      addResult({
        test: 'Configuration Check',
        status: !tableError && !funcError ? 'success' : 'warning',
        message: !tableError && !funcError ? 'All systems ready!' : 'Some issues found',
        details: `Table exists: ${!tableError}\nFunctions work: ${!funcError}`,
        timestamp: new Date().toLocaleTimeString()
      });

    } catch (__error) {
      addResult({
        test: 'Configuration Check',
        status: 'error',
        message: `Error: ${__error}`,
        timestamp: new Date().toLocaleTimeString()
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.text }]}>
        Push Notification Database Tester
      </Text>
      
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
        Test the database-based push notification system
      </Text>

      <View style={styles.inputContainer}>
        <Text style={[styles.label, { color: colors.text }]}>Test Token:</Text>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
              borderColor: colors.border,
              color: colors.text,
            }
          ]}
          value={testToken}
          onChangeText={setTestToken}
          placeholder="ExponentPushToken[...]"
          placeholderTextColor={colors.textSecondary}
        />
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.button, { backgroundColor: '#007AFF' }]}
          onPress={checkConfiguration}
          disabled={isLoading}
        >
          <Text style={styles.buttonText}>Check Config</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, { backgroundColor: '#34C759' }]}
          onPress={testDatabaseFunction}
          disabled={isLoading}
        >
          <Text style={styles.buttonText}>Test Function</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, { backgroundColor: '#FF9500' }]}
          onPress={testNotificationSending}
          disabled={isLoading}
        >
          <Text style={styles.buttonText}>Send Test</Text>
        </TouchableOpacity>
      </View>

      {isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Testing...
          </Text>
        </View>
      )}

      <View style={styles.resultsContainer}>
        <Text style={[styles.resultsTitle, { color: colors.text }]}>
          Test Results:
        </Text>
        {results.map((result, index) => (
          <View
            key={index}
            style={[
              styles.resultItem,
              {
                backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                borderLeftColor: 
                  result.status === 'success' ? '#34C759' :
                  result.status === 'warning' ? '#FF9500' : '#FF3B30'
              }
            ]}
          >
            <Text style={[styles.resultTest, { color: colors.text }]}>
              {result.test} - {result.timestamp}
            </Text>
            <Text style={[
              styles.resultMessage,
              {
                color: 
                  result.status === 'success' ? '#34C759' :
                  result.status === 'warning' ? '#FF9500' : '#FF3B30'
              }
            ]}>
              {result.message}
            </Text>
            {result.details && (
              <Text style={[styles.resultDetails, { color: colors.textSecondary }]}>
                {result.details}
              </Text>
            )}
          </View>
        ))}
      </View>
    </View>
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
    marginBottom: 10,
    textAlign: 'center',
    fontFamily: 'Rubik-Bold',
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'center',
    fontFamily: 'Rubik-Regular',
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    marginBottom: 8,
    fontFamily: 'Rubik-SemiBold',
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    fontFamily: 'Rubik-Regular',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  button: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  buttonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Rubik-SemiBold',
  },
  loadingContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  loadingText: {
    marginTop: 8,
    fontSize: 14,
    fontFamily: 'Rubik-Regular',
  },
  resultsContainer: {
    flex: 1,
  },
  resultsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    fontFamily: 'Rubik-Bold',
  },
  resultItem: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderLeftWidth: 4,
  },
  resultTest: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
    fontFamily: 'Rubik-SemiBold',
  },
  resultMessage: {
    fontSize: 14,
    marginBottom: 4,
    fontFamily: 'Rubik-Regular',
  },
  resultDetails: {
    fontSize: 12,
    fontFamily: 'Rubik-Regular',
  },
});

