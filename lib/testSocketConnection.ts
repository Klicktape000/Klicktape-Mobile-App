import { Platform } from 'react-native';

export const testSocketConnection = async (): Promise<void> => {
  const getTestUrl = (): string => {
    if (Platform.OS === 'android') {
      return 'http://192.168.31.241:3001'; // Wi-Fi IP
    } else {
      return 'http://localhost:3001'; // iOS simulator
    }
  };

  const serverUrl = getTestUrl();

  try {
    // Test 1: Health check endpoint
    const healthResponse = await fetch(`${serverUrl}/health`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    });

    if (healthResponse.ok) {
      const healthData = await healthResponse.text();
    }

    // Test 2: Try to reach the server with a simple request
    const testResponse = await fetch(serverUrl, {
      method: 'GET',
      headers: {
        'Accept': 'text/html,application/json',
      },
    });

  } catch (__error) {
    // Handle error silently
  }
};

// Alternative URLs to try if the main one fails
export const getAlternativeUrls = (): string[] => {
  if (Platform.OS === 'android') {
    return [
      'http://192.168.31.241:3001', // Wi-Fi IP (current)
      'http://10.0.2.2:3001',       // Android emulator
      'http://192.168.1.241:3001',  // Alternative Wi-Fi range
      'http://localhost:3001',      // Localhost fallback
    ];
  } else {
    return [
      'http://localhost:3001',      // iOS simulator
      'http://127.0.0.1:3001',      // Alternative localhost
    ];
  }
};

export const testAllUrls = async (): Promise<string | null> => {
  const urls = getAlternativeUrls();

  for (const url of urls) {
    try {
      const response = await fetch(`${url}/health`, {
        method: 'GET',
        // timeout: 5000, // timeout is not a valid RequestInit property
      });

      if (response.ok) {
        return url;
      }
    } catch (__error) {
      // Handle error silently
    }
  }

  return null;
};

