import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/src/context/ThemeContext';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface NotificationData {
  id: string;
  title: string;
  body: string;
  type: string;
  data?: any;
}

interface InAppNotificationProps {
  notification: NotificationData | null;
  onDismiss: () => void;
  duration?: number;
}

const InAppNotification: React.FC<InAppNotificationProps> = ({
  notification,
  onDismiss,
  duration = 4000,
}) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [slideAnim] = useState(new Animated.Value(-100));
  const [visible, setVisible] = useState(false);

  const handleDismiss = useCallback(() => {
    // Slide out
    Animated.timing(slideAnim, {
      toValue: -100,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setVisible(false);
      onDismiss();
    });
  }, [slideAnim, onDismiss]);

  useEffect(() => {
    if (notification) {
      setVisible(true);
      // Slide in
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }).start();

      // Auto dismiss after duration
      const timer = setTimeout(() => {
        handleDismiss();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [notification, duration, handleDismiss]);

  const handleTap = () => {
    handleDismiss();
    
    if (notification?.data) {
      // Navigate based on notification type
      switch (notification.type) {
        case 'like':
        case 'comment':
        case 'share':
          if (notification.data.postId) {
            router.push(`/post/${notification.data.postId}`);
          }
          break;
        case 'follow':
          if (notification.data.fromUserId) {
            router.push(`/userProfile/${notification.data.fromUserId}`);
          }
          break;
        case 'new_post':
          router.push('/(root)/(tabs)/home');
          break;
        default:
          router.push('/(root)/(tabs)/home');
      }
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'like':
        return 'heart';
      case 'comment':
        return 'message-circle';
      case 'follow':
        return 'user-plus';
      case 'share':
        return 'share';
      case 'new_post':
        return 'camera';
      case 'leaderboard':
        return 'award';
      default:
        return 'bell';
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'like':
        return '#FF6B6B';
      case 'comment':
        return '#4ECDC4';
      case 'follow':
        return '#45B7D1';
      case 'share':
        return '#96CEB4';
      case 'new_post':
        return '#FFEAA7';
      case 'leaderboard':
        return '#FFD93D';
      default:
        return colors.primary;
    }
  };

  if (!visible || !notification) {
    return null;
  }

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: colors.card,
          borderColor: colors.cardBorder,
          transform: [{ translateY: slideAnim }],
          top: Math.max(insets.top, 30),
        },
      ]}
    >
      <TouchableOpacity
        style={styles.content}
        onPress={handleTap}
        activeOpacity={0.8}
      >
        <View
          style={[
            styles.iconContainer,
            { backgroundColor: getNotificationColor(notification.type) },
          ]}
        >
          <Feather
            name={getNotificationIcon(notification.type) as any}
            size={20}
            color="white"
          />
        </View>
        
        <View style={styles.textContainer}>
          <Text
            style={[styles.title, { color: colors.text }]}
            numberOfLines={1}
          >
            {notification.title}
          </Text>
          <Text
            style={[styles.body, { color: colors.textSecondary }]}
            numberOfLines={2}
          >
            {notification.body}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.dismissButton}
          onPress={handleDismiss}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Feather name="x" size={18} color={colors.textSecondary} />
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    // top is now set dynamically using safe area insets
    left: 16,
    right: 16,
    zIndex: 9999,
    borderRadius: 12,
    borderWidth: 1,
    boxShadow: "0px 2px 3.84px rgba(0, 0, 0, 0.25)",
    elevation: 5,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
    marginRight: 8,
  },
  title: {
    fontSize: 14,
    fontFamily: 'Rubik-Medium',
    marginBottom: 2,
  },
  body: {
    fontSize: 12,
    fontFamily: 'Rubik-Regular',
    lineHeight: 16,
  },
  dismissButton: {
    padding: 4,
  },
});

export default InAppNotification;

