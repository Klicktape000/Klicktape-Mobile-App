import React from 'react';
import Constants from 'expo-constants';

// Check if running in Expo Go
const isExpoGo = Constants.appOwnership === 'expo';

// Conditionally import the appropriate component
const NotificationManager = isExpoGo 
  ? React.lazy(() => import('./NotificationManagerStub'))
  : React.lazy(() => import('./NotificationManager'));

const NotificationManagerWrapper: React.FC = () => {
  return (
    <React.Suspense fallback={null}>
      <NotificationManager />
    </React.Suspense>
  );
};

export default NotificationManagerWrapper;

