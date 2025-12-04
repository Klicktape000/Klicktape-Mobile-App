import React, { Suspense, lazy, useEffect, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { useTheme } from '@/src/context/ThemeContext';

// Create a component wrapper for the socket service
const SocketServiceComponent: React.FC = () => {
  useEffect(() => {
    // Initialize socket service when component mounts
    import('@/lib/socketService').then(({ socketService }) => {
      // Socket service is already initialized as a singleton
      // Just ensure it's connected if needed
      if (!socketService.isSocketConnected()) {
        socketService.reconnect();
      }
    });
  }, []);

  return null; // This component doesn't render anything
};

// Lazy load the socket service component
const SocketService = lazy(() => 
  Promise.resolve({ default: SocketServiceComponent })
);

interface LazySocketServiceProps {
  children: React.ReactNode;
  enableSocket?: boolean;
}

const SocketLoadingFallback: React.FC = () => {
  const { colors } = useTheme();
  
  return (
    <View style={{ 
      padding: 10, 
      alignItems: 'center',
      backgroundColor: colors.background 
    }}>
      <ActivityIndicator size="small" color={colors.primary} />
      <Text style={{ color: colors.text, marginTop: 5, fontSize: 12 }}>
        Connecting...
      </Text>
    </View>
  );
};

const LazySocketService: React.FC<LazySocketServiceProps> = ({ 
  children, 
  enableSocket = false 
}) => {
  const [shouldLoadSocket, setShouldLoadSocket] = useState(false);

  useEffect(() => {
    if (enableSocket) {
      // Delay socket loading to improve initial load time
      const timer = setTimeout(() => {
        setShouldLoadSocket(true);
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [enableSocket]);

  if (!enableSocket || !shouldLoadSocket) {
    return <>{children}</>;
  }

  return (
    <Suspense fallback={<SocketLoadingFallback />}>
      <SocketService />
      {children}
    </Suspense>
  );
};

export default LazySocketService;