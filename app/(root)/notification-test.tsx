import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { useTheme } from '@/src/context/ThemeContext';
import ExpoGoCompatibleDiagnostic from '@/components/ExpoGoCompatibleDiagnostic';
import ExpoTokenSetter from '@/components/ExpoTokenSetter';
import PushNotificationTester from '@/components/PushNotificationTester';

export default function NotificationTestScreen() {
  const { colors, isDarkMode } = useTheme();
  const [activeTab, setActiveTab] = useState<'diagnostic' | 'setup' | 'tester'>('diagnostic');

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[
            styles.tab,
            {
              backgroundColor: activeTab === 'diagnostic' ? '#007AFF' : 'transparent',
              borderColor: colors.border,
            }
          ]}
          onPress={() => setActiveTab('diagnostic')}
        >
          <Text style={[
            styles.tabText,
            { color: activeTab === 'diagnostic' ? 'white' : colors.text }
          ]}>
            Diagnostics
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tab,
            {
              backgroundColor: activeTab === 'setup' ? '#007AFF' : 'transparent',
              borderColor: colors.border,
            }
          ]}
          onPress={() => setActiveTab('setup')}
        >
          <Text style={[
            styles.tabText,
            { color: activeTab === 'setup' ? 'white' : colors.text }
          ]}>
            Setup Token
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tab,
            {
              backgroundColor: activeTab === 'tester' ? '#007AFF' : 'transparent',
              borderColor: colors.border,
            }
          ]}
          onPress={() => setActiveTab('tester')}
        >
          <Text style={[
            styles.tabText,
            { color: activeTab === 'tester' ? 'white' : colors.text }
          ]}>
            DB Tester
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'diagnostic' ? (
        <ExpoGoCompatibleDiagnostic />
      ) : activeTab === 'setup' ? (
        <ExpoTokenSetter />
      ) : (
        <PushNotificationTester />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tabContainer: {
    flexDirection: 'row',
    padding: 20,
    paddingBottom: 10,
  },
  tab: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  tabText: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Rubik-SemiBold',
  },
});

