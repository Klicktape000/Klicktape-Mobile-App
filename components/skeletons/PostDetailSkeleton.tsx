import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Dimensions } from 'react-native';
import { useTheme } from '@/src/context/ThemeContext';

const { width } = Dimensions.get('window');
const IMAGE_HEIGHT = width * 0.9;

const PostDetailSkeleton = () => {
  const { colors, isDarkMode } = useTheme();
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const shimmer = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    shimmer.start();
    return () => shimmer.stop();
  }, [shimmerAnim]);

  const shimmerOpacity = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  const skeletonColor = isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
    },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: skeletonColor,
    },
    headerText: {
      marginLeft: 12,
      flex: 1,
    },
    username: {
      width: 120,
      height: 16,
      borderRadius: 4,
      backgroundColor: skeletonColor,
      marginBottom: 6,
    },
    timestamp: {
      width: 80,
      height: 12,
      borderRadius: 4,
      backgroundColor: skeletonColor,
    },
    imageContainer: {
      width: width,
      height: IMAGE_HEIGHT,
      backgroundColor: skeletonColor,
    },
    actionsContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      gap: 16,
    },
    actionButton: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: skeletonColor,
    },
    likesCount: {
      width: 100,
      height: 14,
      borderRadius: 4,
      backgroundColor: skeletonColor,
      marginHorizontal: 16,
      marginBottom: 8,
    },
    caption: {
      marginHorizontal: 16,
      marginBottom: 12,
    },
    captionLine: {
      height: 14,
      borderRadius: 4,
      backgroundColor: skeletonColor,
      marginBottom: 6,
    },
    commentsHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 16,
      borderTopWidth: 1,
      borderTopColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
    },
    commentsTitle: {
      width: 100,
      height: 18,
      borderRadius: 4,
      backgroundColor: skeletonColor,
    },
    commentItem: {
      flexDirection: 'row',
      padding: 16,
      gap: 12,
    },
    commentAvatar: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: skeletonColor,
    },
    commentContent: {
      flex: 1,
    },
    commentUsername: {
      width: 100,
      height: 14,
      borderRadius: 4,
      backgroundColor: skeletonColor,
      marginBottom: 6,
    },
    commentText: {
      width: '100%',
      height: 12,
      borderRadius: 4,
      backgroundColor: skeletonColor,
      marginBottom: 4,
    },
    commentTime: {
      width: 60,
      height: 10,
      borderRadius: 4,
      backgroundColor: skeletonColor,
      marginTop: 4,
    },
  });

  return (
    <View style={styles.container}>
      {/* Header */}
      <Animated.View style={[styles.header, { opacity: shimmerOpacity }]}>
        <View style={styles.avatar} />
        <View style={styles.headerText}>
          <View style={styles.username} />
          <View style={styles.timestamp} />
        </View>
      </Animated.View>

      {/* Image */}
      <Animated.View style={[styles.imageContainer, { opacity: shimmerOpacity }]} />

      {/* Actions */}
      <Animated.View style={[styles.actionsContainer, { opacity: shimmerOpacity }]}>
        <View style={styles.actionButton} />
        <View style={styles.actionButton} />
        <View style={styles.actionButton} />
      </Animated.View>

      {/* Likes count */}
      <Animated.View style={[styles.likesCount, { opacity: shimmerOpacity }]} />

      {/* Caption */}
      <Animated.View style={[styles.caption, { opacity: shimmerOpacity }]}>
        <View style={[styles.captionLine, { width: '100%' }]} />
        <View style={[styles.captionLine, { width: '80%' }]} />
        <View style={[styles.captionLine, { width: '60%' }]} />
      </Animated.View>

      {/* Comments header */}
      <Animated.View style={[styles.commentsHeader, { opacity: shimmerOpacity }]}>
        <View style={styles.commentsTitle} />
      </Animated.View>

      {/* Comment items */}
      {[1, 2, 3].map((index) => (
        <Animated.View key={index} style={[styles.commentItem, { opacity: shimmerOpacity }]}>
          <View style={styles.commentAvatar} />
          <View style={styles.commentContent}>
            <View style={styles.commentUsername} />
            <View style={styles.commentText} />
            <View style={[styles.commentText, { width: '70%' }]} />
            <View style={styles.commentTime} />
          </View>
        </Animated.View>
      ))}
    </View>
  );
};

export default PostDetailSkeleton;

