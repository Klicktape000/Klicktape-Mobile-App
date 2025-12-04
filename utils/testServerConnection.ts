import { Platform } from 'react-native';

export const testServerConnection = async () => {
  // if (__DEV__) {
  //   alertService.debug('🧪 Testing server connectivity', 'Starting connection tests...');
  // }

  const urls = [
    'http://10.0.2.2:3000/health',
    'http://192.168.52.201:3000/health',
    'http://localhost:3000/health'
  ];

  const results: {
    url: string;
    status: string;
    data?: any;
    error?: string;
  }[] = [];

  for (const url of urls) {
    try {
      // if (__DEV__) {
      //   alertService.debug('🔍 Testing', url);
      // }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        // if (__DEV__) {
        //   alertService.debug('✅ Server accessible', `URL: ${url}`);
        //   alertService.debug('📊 Server status', JSON.stringify(data));
        // }
        results.push({ url: url.replace('/health', ''), status: 'success', data });
        return url.replace('/health', '');
      } else {
        // if (__DEV__) {
        //   alertService.debug('❌ Server not accessible', `URL: ${url} (Status: ${response.status})`);
        // }
        results.push({ url, status: 'failed', error: `HTTP ${response.status}` });
      }
    } catch (_error) {
      // if (__DEV__) {
      //   alertService.debug('❌ Failed to connect', `URL: ${url}, Error: ${(_error as Error).message}`);
      // }
      results.push({ url, status: 'error', error: (_error as Error).message });
    }
  }

  // if (__DEV__) {
  //   alertService.debug('📋 Connection test results', JSON.stringify(results));
  //   alertService.debug('❌ No server URLs accessible', 'All connection attempts failed');
  // }
  return null;
};

export const getOptimalServerUrl = () => {
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:3000';
  } else if (Platform.OS === 'ios') {
    return 'http://localhost:3000';
  } else {
    return 'http://localhost:3000';
  }
};
