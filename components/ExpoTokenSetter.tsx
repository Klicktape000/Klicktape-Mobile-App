import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '@/src/context/ThemeContext';
import PushNotificationConfig from '@/lib/pushNotificationConfig';

export default function ExpoTokenSetter() {
  const { colors, isDarkMode } = useTheme();
  const [token, setToken] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSetToken = async () => {
    if (!token.trim()) {
      Alert.alert('Error', 'Please enter a valid Expo access token');
      return;
    }

    setIsLoading(true);
    try {
      const success = await PushNotificationConfig.setExpoAccessToken(token.trim());
      
      if (success) {
        Alert.alert(
          'Success!', 
          'Expo access token has been set successfully. Push notifications should now work.',
          [
            {
              text: 'OK',
              onPress: () => setToken('') // Clear the input
            }
          ]
        );
      } else {
        Alert.alert('Error', 'Failed to set Expo access token. Please try again.');
      }
    } catch (__error) {
      Alert.alert('Error', `Failed to set token: ${__error}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestSystem = async () => {
    setIsLoading(true);
    try {
      const result = await PushNotificationConfig.testNotificationSystem();
      
      if (result.success) {
        Alert.alert('Test Successful!', 'Push notification system is working correctly.');
      } else {
        Alert.alert('Test Failed', `Error: ${result.error || 'Unknown error'}`);
      }
    } catch (__error) {
      Alert.alert('Test Error', `Failed to test system: ${__error}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.text }]}>
        Set Expo Access Token
      </Text>
      
      <Text style={[styles.description, { color: colors.textSecondary }]}>
        To enable push notifications, you need to set your Expo access token:
      </Text>
      
      <View style={styles.steps}>
        <Text style={[styles.stepText, { color: colors.textSecondary }]}>
          1. Go to: https://expo.dev/accounts/[your-account]/settings/access-tokens{'\n'}
          2. Create a new token with push notification permissions{'\n'}
          3. Copy the token and paste it below{'\n'}
          4. Tap &quot;Set Token&quot;
        </Text>
      </View>

      <TextInput
        style={[
          styles.input,
          {
            backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
            borderColor: colors.border,
            color: colors.text,
          }
        ]}
        placeholder="Paste your Expo access token here..."
        placeholderTextColor={colors.textSecondary}
        value={token}
        onChangeText={setToken}
        multiline
        numberOfLines={3}
        textAlignVertical="top"
      />

      <TouchableOpacity
        style={[
          styles.button,
          {
            backgroundColor: token.trim() ? '#007AFF' : colors.border,
          }
        ]}
        onPress={handleSetToken}
        disabled={!token.trim() || isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text style={[styles.buttonText, { color: 'white' }]}>
            Set Token
          </Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.testButton,
          {
            backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
            borderColor: colors.border,
          }
        ]}
        onPress={handleTestSystem}
        disabled={isLoading}
      >
        <Text style={[styles.testButtonText, { color: colors.text }]}>
          Test Notification System
        </Text>
      </TouchableOpacity>

      <View style={[styles.infoBox, { backgroundColor: isDarkMode ? 'rgba(0, 122, 255, 0.1)' : '#E3F2FD' }]}>
        <Text style={[styles.infoText, { color: '#007AFF' }]}>
          💡 This approach uses database functions instead of Edge Functions, so no Docker is required!
        </Text>
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
  description: {
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'center',
    fontFamily: 'Rubik-Regular',
  },
  steps: {
    marginBottom: 20,
    padding: 15,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 193, 7, 0.1)',
  },
  stepText: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Rubik-Regular',
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 15,
    marginBottom: 20,
    fontSize: 14,
    fontFamily: 'Rubik-Regular',
    minHeight: 80,
  },
  button: {
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 15,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Rubik-SemiBold',
  },
  testButton: {
    padding: 15,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: 20,
  },
  testButtonText: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Rubik-SemiBold',
  },
  infoBox: {
    padding: 15,
    borderRadius: 8,
    marginTop: 10,
  },
  infoText: {
    fontSize: 14,
    textAlign: 'center',
    fontFamily: 'Rubik-Regular',
  },
});

