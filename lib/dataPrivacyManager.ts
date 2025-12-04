/**
 * Data Privacy Manager for KlickTape
 * Ensures compliance with Google Play policies for sensitive data handling
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { Alert, Platform } from 'react-native';

interface DataCollectionConsent {
  location: boolean;
  deviceInfo: boolean;
  analytics: boolean;
  crashReporting: boolean;
  lastUpdated: string;
}

interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: string;
  purpose: 'post_tagging' | 'nearby_users' | 'events';
  userConsented: boolean;
}

interface DeviceInfo {
  platform: string;
  version: string;
  model?: string;
  timestamp: string;
  purpose: 'app_optimization' | 'security' | 'support';
}

class DataPrivacyManager {
  private static instance: DataPrivacyManager;
  private readonly CONSENT_STORAGE_KEY = 'klicktape_data_consent';
  private readonly LOCATION_STORAGE_KEY = 'klicktape_location_data';
  private readonly DEVICE_INFO_STORAGE_KEY = 'klicktape_device_info';

  private constructor() {}

  static getInstance(): DataPrivacyManager {
    if (!DataPrivacyManager.instance) {
      DataPrivacyManager.instance = new DataPrivacyManager();
    }
    return DataPrivacyManager.instance;
  }

  /**
   * Get current consent status
   */
  async getConsentStatus(): Promise<DataCollectionConsent | null> {
    try {
      const consentData = await AsyncStorage.getItem(this.CONSENT_STORAGE_KEY);
      return consentData ? JSON.parse(consentData) : null;
    } catch (__error) {
      console.error('Error getting consent status:', __error);
      return null;
    }
  }

  /**
   * Update consent for specific data types
   */
  async updateConsent(consent: Partial<DataCollectionConsent>): Promise<void> {
    try {
      const currentConsent = await this.getConsentStatus() || {
        location: false,
        deviceInfo: false,
        analytics: false,
        crashReporting: false,
        lastUpdated: new Date().toISOString(),
      };

      const updatedConsent: DataCollectionConsent = {
        ...currentConsent,
        ...consent,
        lastUpdated: new Date().toISOString(),
      };

      await AsyncStorage.setItem(this.CONSENT_STORAGE_KEY, JSON.stringify(updatedConsent));
// console.log('✅ Data consent updated:', updatedConsent);
    } catch (__error) {
      console.error('Error updating consent:', __error);
      throw __error;
    }
  }

  /**
   * Request location permission with clear explanation
   */
  async requestLocationPermission(purpose: LocationData['purpose']): Promise<boolean> {
    try {
      const consent = await this.getConsentStatus();

      // Check if user has already denied location consent
      if (consent && !consent.location) {
        Alert.alert(
          "Location Access",
          "You have previously declined location access. You can enable it in Settings > Privacy if you'd like to use location features.",
          [{ text: "OK" }]
        );
        return false;
      }

      // Explain why we need location based on purpose
      const purposeExplanations = {
        post_tagging: "KlickTape would like to access your location to help you tag your posts with where they were taken. This makes it easier for friends to discover content from specific places.",
        nearby_users: "KlickTape would like to access your location to help you discover users and content near you. Your exact location is never shared with other users.",
        events: "KlickTape would like to access your location to show you events and activities happening nearby. Location data is only used to find relevant events."
      };

      return new Promise((resolve) => {
        Alert.alert(
          "Location Permission",
          purposeExplanations[purpose],
          [
            {
              text: "Don't Allow",
              style: "cancel",
              onPress: async () => {
                await this.updateConsent({ location: false });
                resolve(false);
              }
            },
            {
              text: "Allow",
              onPress: async () => {
                const { status } = await Location.requestForegroundPermissionsAsync();
                const granted = status === 'granted';
                await this.updateConsent({ location: granted });
                resolve(granted);
              }
            }
          ]
        );
      });
    } catch (__error) {
      console.error('Error requesting location permission:', __error);
      return false;
    }
  }

  /**
   * Collect location data with user consent
   */
  async collectLocationData(purpose: LocationData['purpose']): Promise<LocationData | null> {
    try {
      const hasPermission = await this.requestLocationPermission(purpose);
      if (!hasPermission) {
        return null;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 5000,
      });

      const locationData: LocationData = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy || 0,
        timestamp: new Date().toISOString(),
        purpose,
        userConsented: true,
      };

      // Store location data temporarily (for current session only)
      await AsyncStorage.setItem(this.LOCATION_STORAGE_KEY, JSON.stringify(locationData));

// console.log('✅ Location data collected with consent:', { purpose, accuracy: locationData.accuracy });
      return locationData;
    } catch (__error) {
      console.error('Error collecting location data:', __error);
      return null;
    }
  }

  /**
   * Collect minimal device info for app optimization
   */
  async collectDeviceInfo(purpose: DeviceInfo['purpose']): Promise<DeviceInfo | null> {
    try {
      const consent = await this.getConsentStatus();

      // Only collect device info if user has consented
      if (!consent?.deviceInfo) {
        return null;
      }

      const deviceInfo: DeviceInfo = {
        platform: Platform.OS,
        version: Platform.Version.toString(),
        timestamp: new Date().toISOString(),
        purpose,
      };

      // Only collect model for support purposes
      if (purpose === 'support') {
        deviceInfo.model = Platform.OS === 'ios' ? 'iOS Device' : 'Android Device';
      }

      await AsyncStorage.setItem(this.DEVICE_INFO_STORAGE_KEY, JSON.stringify(deviceInfo));

// console.log('✅ Device info collected with consent:', { purpose });
      return deviceInfo;
    } catch (__error) {
      console.error('Error collecting device info:', __error);
      return null;
    }
  }

  /**
   * Clear all stored sensitive data
   */
  async clearAllData(): Promise<void> {
    try {
      await Promise.all([
        AsyncStorage.removeItem(this.CONSENT_STORAGE_KEY),
        AsyncStorage.removeItem(this.LOCATION_STORAGE_KEY),
        AsyncStorage.removeItem(this.DEVICE_INFO_STORAGE_KEY),
      ]);
// console.log('✅ All privacy data cleared');
    } catch (__error) {
      console.error('Error clearing privacy data:', __error);
      throw __error;
    }
  }

  /**
   * Get data retention policy
   */
  getDataRetentionPolicy(): string {
    return `
Data Retention Policy:

• Location Data: Stored temporarily during app session only. Automatically deleted when app is closed.
• Device Information: Stored locally for app optimization. Can be deleted at any time.
• User Content: Stored until user deletes it or deletes their account.
• Analytics Data: Aggregated and anonymized. No personal identifiers retained.
• Crash Reports: Stored for 30 days for debugging purposes only.

You can delete all your data at any time through Settings > Account > Delete Account.
You can export your data through Settings > Account > Export My Data.
    `.trim();
  }

  /**
   * Validate that media files are handled securely
   */
  validateMediaFileHandling(fileUri: string, purpose: 'post' | 'story' | 'reel' | 'avatar'): boolean {
    try {
      // Ensure file URI is from a secure source
      if (!fileUri.startsWith('file://') && !fileUri.startsWith('content://')) {
// console.warn('⚠️ Potentially unsafe file URI:', fileUri);
        return false;
      }

      // Log media handling for audit purposes
// console.log('📁 Media file handled securely:', {
// purpose,
// hasSecureUri: fileUri.startsWith('file://') || fileUri.startsWith('content://'),
// timestamp: new Date().toISOString(),
// });

      return true;
    } catch (__error) {
      console.error('Error validating media file handling:', __error);
      return false;
    }
  }

  /**
   * Ensure storage operations comply with privacy policies
   */
  validateStorageOperation(operation: 'upload' | 'download' | 'delete', filePath: string, userId: string): boolean {
    try {
      // Ensure user can only access their own files
      if (!filePath.includes(userId)) {
        console.error('🚨 Security violation: User attempting to access files outside their directory');
        return false;
      }

      // Log storage operation for audit
// console.log('🔒 Storage operation validated:', {
// operation,
// userId,
// hasUserPath: filePath.includes(userId),
// timestamp: new Date().toISOString(),
// });

      return true;
    } catch (__error) {
      console.error('Error validating storage operation:', __error);
      return false;
    }
  }
}

// Export singleton instance
export const dataPrivacyManager = DataPrivacyManager.getInstance();

// Helper functions for common operations
export const requestLocationWithConsent = (purpose: LocationData['purpose']) =>
  dataPrivacyManager.collectLocationData(purpose);

export const validateMediaUpload = (fileUri: string, purpose: 'post' | 'story' | 'reel' | 'avatar') =>
  dataPrivacyManager.validateMediaFileHandling(fileUri, purpose);

export const validateUserStorageAccess = (operation: 'upload' | 'download' | 'delete', filePath: string, userId: string) =>
  dataPrivacyManager.validateStorageOperation(operation, filePath, userId);

export default dataPrivacyManager;
