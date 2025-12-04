/**
 * Debug screen for testing forgot password functionality
 * This can be accessed during development to test email sending
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { testForgotPassword, testMultipleEmails, testRedirectUrl, ForgotPasswordTestResult } from '@/lib/testForgotPassword';

export default function DebugForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<ForgotPasswordTestResult[]>([]);

  const handleSingleTest = async () => {
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter an email address');
      return;
    }

    setIsLoading(true);
    try {
      const result = await testForgotPassword(email.trim());
      setResults([result]);
      
      Alert.alert(
        result.success ? 'Success' : 'Error',
        result.message,
        [{ text: 'OK' }]
      );
    } catch (__error) {
      Alert.alert('Error', 'Test failed: ' + (__error as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMultipleTests = async () => {
    setIsLoading(true);
    try {
      const testResults = await testMultipleEmails();
      setResults(testResults);
      
      const successCount = testResults.filter(r => r.success).length;
      Alert.alert(
        'Tests Complete',
        `${successCount}/${testResults.length} tests passed`,
        [{ text: 'OK' }]
      );
    } catch (__error) {
      Alert.alert('Error', 'Tests failed: ' + (__error as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRedirectTest = async () => {
    setIsLoading(true);
    try {
      const result = await testRedirectUrl();
      setResults([result]);
      
      Alert.alert(
        result.success ? 'Success' : 'Error',
        result.message,
        [{ text: 'OK' }]
      );
    } catch (__error) {
      Alert.alert('Error', 'Redirect test failed: ' + (__error as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Debug Forgot Password</Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Single Email Test</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter email to test"
          placeholderTextColor="#666"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <TouchableOpacity
          style={[styles.button, isLoading && styles.buttonDisabled]}
          onPress={handleSingleTest}
          disabled={isLoading}
        >
          <Text style={styles.buttonText}>Test Single Email</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Batch Tests</Text>
        <TouchableOpacity
          style={[styles.button, styles.secondaryButton, isLoading && styles.buttonDisabled]}
          onPress={handleMultipleTests}
          disabled={isLoading}
        >
          <Text style={styles.buttonText}>Test Multiple Scenarios</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.button, styles.secondaryButton, isLoading && styles.buttonDisabled]}
          onPress={handleRedirectTest}
          disabled={isLoading}
        >
          <Text style={styles.buttonText}>Test Redirect URL</Text>
        </TouchableOpacity>
      </View>

      {isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007bff" />
          <Text style={styles.loadingText}>Running tests...</Text>
        </View>
      )}

      {results.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Test Results</Text>
          {results.map((result, index) => (
            <View key={index} style={[styles.resultCard, result.success ? styles.successCard : styles.errorCard]}>
              <Text style={styles.resultStatus}>
                {result.success ? '✅ SUCCESS' : '❌ FAILED'}
              </Text>
              <Text style={styles.resultMessage}>{result.message}</Text>
              {result.details && (
                <Text style={styles.resultDetails}>
                  Details: {JSON.stringify(result.details, null, 2)}
                </Text>
              )}
              {result.error && (
                <Text style={styles.resultError}>
                  Error: {JSON.stringify(result.error, null, 2)}
                </Text>
              )}
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 30,
    marginTop: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  backButton: {
    padding: 10,
    backgroundColor: '#007bff',
    borderRadius: 8,
  },
  backButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  section: {
    marginBottom: 30,
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 15,
    backgroundColor: '#f9f9f9',
  },
  button: {
    backgroundColor: '#007bff',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  secondaryButton: {
    backgroundColor: '#6c757d',
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  loadingContainer: {
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  resultCard: {
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    borderWidth: 1,
  },
  successCard: {
    backgroundColor: '#d4edda',
    borderColor: '#c3e6cb',
  },
  errorCard: {
    backgroundColor: '#f8d7da',
    borderColor: '#f5c6cb',
  },
  resultStatus: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  resultMessage: {
    fontSize: 14,
    marginBottom: 10,
    color: '#333',
  },
  resultDetails: {
    fontSize: 12,
    color: '#666',
    fontFamily: 'monospace',
    backgroundColor: '#f8f9fa',
    padding: 8,
    borderRadius: 4,
    marginBottom: 5,
  },
  resultError: {
    fontSize: 12,
    color: '#dc3545',
    fontFamily: 'monospace',
    backgroundColor: '#f8f9fa',
    padding: 8,
    borderRadius: 4,
  },
});

