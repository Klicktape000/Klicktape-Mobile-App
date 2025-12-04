import React from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/context/ThemeContext';

interface EnhancedRefreshIndicatorProps {
  opacity: Animated.Value;
  rotation: Animated.Value;
  size?: number;
  style?: any;
}

const EnhancedRefreshIndicator: React.FC<EnhancedRefreshIndicatorProps> = ({
  opacity,
  rotation,
  size = 24,
  style,
}) => {
  const { colors } = useTheme();

  const animatedStyle = {
    opacity,
    transform: [
      {
        rotate: rotation.interpolate({
          inputRange: [0, 1],
          outputRange: ['0deg', '360deg'],
        }),
      },
      {
        scale: opacity.interpolate({
          inputRange: [0, 1],
          outputRange: [0.8, 1.2],
        }),
      },
    ],
  };

  return (
    <View style={[styles.container as any, style]}>
      <Animated.View style={[styles.indicator as any, animatedStyle]}>
        <View style={[styles.iconContainer as any, { backgroundColor: colors.background }]}>
          <Ionicons 
            name="refresh" 
            size={size} 
            color={colors.primary} 
          />
        </View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  indicator: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
});

export default EnhancedRefreshIndicator;
