import React, { useState, useEffect } from 'react';
import Constants from 'expo-constants';
import InAppNotification from './InAppNotification';

interface NotificationData {
  id: string;
  title: string;
  body: string;
  type: string;
  data?: any;
}

const NotificationManager: React.FC = () => {
  const [currentNotification, setCurrentNotification] = useState<NotificationData | null>(null);

  useEffect(() => {
    // Check if running in Expo Go
    const isExpoGo = Constants.appOwnership === 'expo';

    if (isExpoGo) {
      //// console.log('📱 NotificationManager: Running in Expo Go - notifications disabled');
      return;
    }

    // Dynamically import expo-notifications only for development builds
    let subscription: any;

    const setupNotifications = async () => {
      try {
        const Notifications = await import('expo-notifications');

        // Listen for notifications received while app is in foreground
        subscription = Notifications.addNotificationReceivedListener(notification => {
          //// console.log('Notification received in foreground:', notification);

          const notificationData: NotificationData = {
            id: notification.request.identifier,
            title: notification.request.content.title || 'New Notification',
            body: notification.request.content.body || '',
            type: (notification.request.content.data?.type as string) || 'default',
            data: notification.request.content.data,
          };

          setCurrentNotification(notificationData);
        });
      } catch (__error) {
        //// console.log('⚠️ Failed to setup notifications:', error);
      }
    };

    setupNotifications();

    return () => {
      if (subscription) {
        subscription.remove();
      }
    };
  }, []);

  const handleDismiss = () => {
    setCurrentNotification(null);
  };

  return (
    <InAppNotification
      notification={currentNotification}
      onDismiss={handleDismiss}
      duration={4000}
    />
  );
};

export default NotificationManager;

