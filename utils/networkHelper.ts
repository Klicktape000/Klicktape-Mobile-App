import { Platform } from 'react-native';

interface ConnectionTestResult {
  url: string;
  success: boolean;
  responseTime?: number;
  error?: string;
}

/**
 * Network Helper Utility
 * Helps manage Socket.IO connection URLs for different network configurations
 */

export const getSocketUrls = (customIP?: string) => {
  const urls: string[] = [];

  // Check for environment variable first
  const SERVER_URL = process.env.EXPO_PUBLIC_SOCKET_SERVER_URL;
  if (SERVER_URL && SERVER_URL.trim() !== '') {
    urls.push(SERVER_URL);
  }

  // Add custom IP if provided
  if (customIP) {
    urls.push(`http://${customIP}:3001`);
  }

  // Platform-specific URLs
  if (Platform.OS === 'android') {
    urls.push('http://10.0.2.2:3000'); // Android emulator
    urls.push('http://192.168.31.241:3000'); // Current network IP
    urls.push('http://192.168.31.241:3001'); // Current network IP
    urls.push('http://192.168.38.201:3000'); // Previous IP
    urls.push('http://192.168.52.201:3000'); // Older IP
    urls.push('http://localhost:3000');
  } else if (Platform.OS === 'ios') {
    urls.push('http://localhost:3000'); // iOS simulator
    urls.push('http://192.168.31.241:3000'); // Current network IP
    urls.push('http://10.0.2.2:3000');
    urls.push('http://192.168.38.201:3000'); // Previous IP
    urls.push('http://192.168.52.201:3000'); // Older IP
  } else {
    // Web or other platforms
    urls.push('http://localhost:3000');
    urls.push('http://192.168.31.241:3000'); // Current network IP
    urls.push('http://192.168.38.201:3000'); // Previous IP
    urls.push('http://192.168.52.201:3000'); // Older IP
  }

  // Remove duplicates
  return [...new Set(urls)];
};

export const testConnection = async (url: string): Promise<ConnectionTestResult> => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(`${url}/health`, {
      method: 'GET',
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    return { url, success: response.ok };
  } catch (_error) {
    // if (__DEV__) {
    //   alertService.debug('❌ Connection test failed', `URL: ${url}, Error: ${(_error as Error).message}`);
    // }
    return { url, success: false, error: (_error as Error).message };
  }
};

export const findWorkingUrl = async (urls: string[]): Promise<ConnectionTestResult | null> => {
  // if (__DEV__) {
  //   alertService.debug('🔍 Testing connection URLs', 'Starting connection tests');
  // }
  
  for (const url of urls) {
    // if (__DEV__) {
    //   alertService.debug('🧪 Testing URL', `Testing: ${url}`);
    // }
    const result = await testConnection(url);
    if (result.success) {
      // if (__DEV__) {
      //   alertService.debug('✅ Found working URL', `URL: ${url}`);
      // }
      return result;
    }
  }
  
  // if (__DEV__) {
  //   alertService.debug('❌ No working URLs found', 'All connection tests failed');
  // }
  return null;
};

export const getCurrentNetworkInfo = () => {
  return {
    platform: Platform.OS,
    isAndroidEmulator: Platform.OS === 'android',
    isIOSSimulator: Platform.OS === 'ios',
    recommendedUrls: getSocketUrls(),
  };
};
