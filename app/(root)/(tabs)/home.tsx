import {
  View,
  TouchableOpacity,
  Text,
  StyleSheet,
  Platform,
  StatusBar,
} from "react-native";
import * as Haptics from 'expo-haptics';
import { SafeAreaView } from "react-native-safe-area-context";
import React, { useEffect, useState } from "react";
import { Feather, Ionicons } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import { Link } from "expo-router";
import { useDispatch, useSelector } from "react-redux";
import { useAuth } from "@/lib/authContext";
import {
  setUnreadMessageCount,
} from "@/src/store/slices/messageSlice";
import Sidebar from "@/components/Sidebar";
import { setActiveStatus } from "@/src/store/slices/userStatusSlice";
import { RootState } from "@/src/store/store";
import { messagesAPI } from "@/lib/messagesApi";
import { productionRealtimeOptimizer } from "@/lib/utils/productionRealtimeOptimizer";
import Posts from "@/components/Posts";

import { openSidebar } from "@/src/store/slices/sidebarSlice";
import { ThemedGradient } from "@/components/ThemedGradient";
import { useTheme } from "@/src/context/ThemeContext";

import { useOptimizedDataFetching } from "@/lib/hooks/useOptimizedDataFetching";
import { useSupabaseNotificationManager } from "@/lib/supabaseNotificationManager";
import { useQueryClient } from '@tanstack/react-query';
import { getPrefetchManager } from "@/lib/performance/appPrefetchManager";
import { queryKeys } from "@/lib/query/queryKeys";
// Removed UniversalScrollView and useUniversalRefresh imports


const Home = () => {
  const dispatch = useDispatch();
  const { user, isAuthenticated, isLoading } = useAuth();
  const queryClient = useQueryClient();
  const [userId, setUserId] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<{
    username: string | null;
    name: string | null;
    avatar_url: string | null;
  } | null>(null);

  // OPTIMIZED: Removed aggressive prefetching that loads ALL app sections on mount
  // This was causing 10-15+ database queries to run before the feed could load
  // Individual sections will load on-demand when navigated to
  // The feed loads MUCH faster now without this overhead

  // Removed universal refresh hook - using standard refresh instead

  const reduxUnreadCount = useSelector(
    (state: RootState) => state.notifications.unreadCount
  );
  const unreadMessageCount = useSelector(
    (state: RootState) => state.messages.unreadCount
  );

  // Initialize Supabase real-time notification management
  // Only initialize when we have a valid userId
  const {
    isConnected,
    subscriptionStatus,
    lastSyncTime,
    forceReconnect,
    unreadCount: realtimeUnreadCount,
  } = useSupabaseNotificationManager({
    userId: userId && userId.trim() !== '' ? userId : null,
    enableRealtime: !!(userId && userId.trim() !== ''),
    fallbackPollingInterval: 180000, // 3 minutes (reduced from 2 minutes)
    maxRetries: 1, // Reduced from 2
  });

  // Debug logging for notification manager
// console.log('🏠 Home Notification Manager Debug:', {
// userId,
// isConnected,
// subscriptionStatus,
// realtimeUnreadCount,
// reduxUnreadCount,
// lastSyncTime
// });

  // Use Redux count as the source of truth since notification manager updates it directly
  const unreadCount = reduxUnreadCount;

  // Debug notification system status
  useEffect(() => {
    if (userId) {
      if (__DEV__) {
// console.log('🏠 Home: Auth state changed', {
// isAuthenticated,
// isLoading,
// userId,
// hasUser: !!user,
// userEmail: user?.email,
// });
        
        // Additional debug for blank page issue
        if (!isLoading) {
          if (isAuthenticated && userId) {
// console.log('✅ Home: User is authenticated, should show posts');
          } else {
// console.log('❌ Home: User not authenticated or no userId');
          }
        }
      }
    }
  }, [isConnected, subscriptionStatus, lastSyncTime, userId, realtimeUnreadCount, isAuthenticated, isLoading, user]);
  
  // Separate effect for force reconnect to prevent infinite loops
  useEffect(() => {
    if (userId && !isConnected && subscriptionStatus === 'error') {
      if (__DEV__) {
// console.log('🔄 Home: Force reconnecting due to error state');
      }
      forceReconnect();
    }
  }, [isConnected, subscriptionStatus, userId]); // Removed forceReconnect from dependencies
  useEffect(() => {
    // Use auth context instead of direct auth calls
    if (isAuthenticated && user) {
      setUserId(user.id);
    } else if (!isLoading) {
      // Only clear userId if we're not loading and not authenticated
      setUserId(null);
    }
  }, [user, isAuthenticated, isLoading]);

  // OPTIMIZED: Removed useOptimizedDataFetching hook
  // It was fetching unnecessary home data that wasn't being used
  // The Posts component handles its own data fetching via useSmartFeed

  // Fetch user profile data
  const fetchUserProfile = async (userId: string) => {
    try {
      const { data, error } = await (supabase as any)
        .from('profiles')
        .select('username, name, avatar_url')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error fetching user profile:', error);
        return;
      }

      if (data && typeof data === 'object' && 'username' in data) {
        // Type assertion to ensure data matches our expected type
        const profileData: {
          username: string | null;
          name: string | null;
          avatar_url: string | null;
        } = {
          username: (data as any).username || null,
          name: (data as any).name || null,
          avatar_url: (data as any).avatar_url || null,
        };
        setUserProfile(profileData);
      }
    } catch (__error) {
      console.error('Error fetching user profile:', __error);
    }
  };

  // OPTIMIZED: Removed unnecessary homeData effect
  // This was dependent on the removed useOptimizedDataFetching hook
  // User profile and notifications are now handled by their respective managers

  useEffect(() => {
    if (!userId || !supabase) {

      return;
    }



    // Note: Notification real-time subscription is handled by useSupabaseNotificationManager
    // to prevent duplicate subscriptions and ensure proper state management

    // Create PRODUCTION-OPTIMIZED messages subscription
    const messagesCleanupInsert = productionRealtimeOptimizer.createOptimizedSubscription(
      `messages_${userId}:insert`,
      {
        table: "messages",
        filter: `receiver_id=eq.${userId}`,
        event: "INSERT",
        priority: "medium", // Home screen notifications are medium priority
      },
      async (payload) => {
        const handleMessage = async (messagePayload: any) => {

          if (!messagePayload.new.is_read) {
            // Fetch actual unread count instead of incrementing
            try {
              const unreadCount = await messagesAPI.getUnreadMessagesCount(userId);

              dispatch(setUnreadMessageCount(unreadCount));
            } catch (__error) {
              console.error("Error fetching unread count:", __error);
            }
          }
        };

        if (payload.type === 'batch') {
          // Handle batched messages
          for (const msg of payload.messages) {
            await handleMessage(msg);
          }
        } else {
          await handleMessage(payload);
        }
      }
    );

    const messagesCleanupUpdate = productionRealtimeOptimizer.createOptimizedSubscription(
      `messages_${userId}:update`,
      {
        table: "messages",
        filter: `receiver_id=eq.${userId}`,
        event: "UPDATE",
        priority: "low", // Message updates are low priority
      },
      async (payload) => {
        const handleUpdate = async (updatePayload: any) => {

          // If message was marked as read, update the count
          if (updatePayload.new.is_read && !updatePayload.old.is_read) {
            try {
              const unreadCount = await messagesAPI.getUnreadMessagesCount(userId);

              dispatch(setUnreadMessageCount(unreadCount));
            } catch (__error) {
              console.error("Error fetching unread count after update:", __error);
            }
          }
        };

        if (payload.type === 'batch') {
          // Handle batched updates
          for (const msg of payload.messages) {
            await handleUpdate(msg);
          }
        } else {
          await handleUpdate(payload);
        }
      }
    );

    // Cleanup function
    return () => {
      // Clean up production realtime subscriptions
      messagesCleanupInsert();
      messagesCleanupUpdate();

      if (userId && supabase) {
        (async () => {
          try {
            await (supabase as any)
              .from("profiles")
              .update({
                updated_at: new Date().toISOString()
              })
              .eq("id", userId);

          } catch (__error: any) {
            console.error("Error updating user status:", __error);
          }
        })();
      }
    };
  }, [userId, dispatch, unreadCount, unreadMessageCount]);

  useEffect(() => {
    if (userId && supabase) {
      dispatch(setActiveStatus(true));
      (async () => {
        try {
          await (supabase as any)
            .from("profiles")
            .update({ updated_at: new Date().toISOString() })
            .eq("id", userId);

        } catch (__error: any) {
          console.error('Error fetching user profile:', __error);
        }
      })();
    }
  }, [userId, dispatch, supabase]);

  // Manual-only refresh: no automatic refresh on focus

  const { colors, isDarkMode } = useTheme();

// console.log('🏠 Home: About to return JSX');

  return (
    <>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} />
      <ThemedGradient style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <View style={[styles.header, {
            borderBottomColor: isDarkMode ? 'rgba(128, 128, 128, 0.2)' : 'rgba(128, 128, 128, 0.2)'
          }]}>
            <View style={styles.leftSection}>
              <TouchableOpacity
                onPress={() => dispatch(openSidebar())}
                style={[styles.menuButton, {
                  backgroundColor: isDarkMode ? 'rgba(128, 128, 128, 0.1)' : 'rgba(128, 128, 128, 0.1)',
                  borderColor: isDarkMode ? 'rgba(128, 128, 128, 0.3)' : 'rgba(128, 128, 128, 0.3)'
                }]}
              >
                <Feather name="menu" size={24} color={colors.text} />
              </TouchableOpacity>
              <View>
                <Text style={[styles.appName, { color: colors.primary }]}>Klicktape</Text>
                <Text style={[styles.tagline, { color: colors.textSecondary }]}>
                  First Privacy Secured Network
                </Text>
              </View>
            </View>

            <View style={styles.rightSection}>
              <Link
                href="/chat"
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  
                  // OPTIMIZED: Non-blocking prefetch - let navigation start immediately
                  if (userId) {
                    // Fire and forget - don't block navigation
                    queryClient.prefetchQuery({
                      queryKey: queryKeys.messages.conversations(),
                      queryFn: async () => {
                        const { data: messages, error } = await (supabase as any)
                          .from("messages")
                          .select(`id, content, sender_id, receiver_id, created_at, is_read, message_type`)
                          .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
                          .order("created_at", { ascending: false });
                        if (error) throw error;
                        if (!messages || messages.length === 0) return [];
                        const conversationMap = new Map<string, any>();
                        for (const message of messages) {
                          const otherId = (message as any).sender_id === userId ? (message as any).receiver_id : (message as any).sender_id;
                          if (!conversationMap.has(otherId)) {
                            conversationMap.set(otherId, message);
                          }
                        }
                        const otherUserIds = Array.from(conversationMap.keys());
                        const { data: userProfiles, error: profilesError } = await (supabase as any)
                          .from("profiles")
                          .select("id, username, avatar_url")
                          .in("id", otherUserIds);
                        if (profilesError) return [];
                        const profileMap = new Map(
                          (userProfiles || []).map((profile: any) => [profile.id, profile])
                        );
                        // Import messagesAPI once before mapping
                        const { messagesAPI: msgAPI } = await import("@/lib/messagesApi");
                        
                        const conversations = Array.from(conversationMap.entries())
                          .map(([otherId, lastMessage]) => {
                            const userDoc = profileMap.get(otherId);
                            if (!userDoc) return null;
                            return {
                              userId: otherId,
                              username: (userDoc as any).username,
                              avatar: (userDoc as any).avatar_url || "https://via.placeholder.com/50",
                              lastMessage: msgAPI.getMessagePreview(
                                (lastMessage as any).content,
                                (lastMessage as any).message_type
                              ),
                              timestamp: (lastMessage as any).created_at,
                              isRead: (lastMessage as any).is_read,
                            };
                          })
                          .filter(Boolean) as any[];
                        return conversations.sort(
                          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
                        );
                      },
                      staleTime: 5 * 60 * 1000, // 5 minutes
                    }).catch(() => {
                      // Silent fail - chat will load from server if needed
                    });
                  }
                }}
                style={[styles.iconButton, {
                  backgroundColor: isDarkMode ? 'rgba(128, 128, 128, 0.1)' : 'rgba(128, 128, 128, 0.1)',
                  borderColor: isDarkMode ? 'rgba(128, 128, 128, 0.3)' : 'rgba(128, 128, 128, 0.3)'
                }]}
                asChild
              >
                <TouchableOpacity>
                  <Ionicons name="chatbubble-outline" size={20} color={colors.text} />
                  {unreadMessageCount > 0 && (
                    <View style={[styles.badge, { backgroundColor: isDarkMode ? '#808080' : '#606060' }]}>
                      <Text style={[styles.badgeText, { color: '#FFFFFF' }]}>
                        {unreadMessageCount > 99 ? "99+" : unreadMessageCount}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              </Link>
              <Link
                href="/notifications"
                onPress={() => {
                  // Add haptic feedback for better UX
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  // Note: Don't reset count here - let the notifications screen handle it
                  // when notifications are actually viewed/marked as read
                }}
                style={[styles.iconButton, {
                  backgroundColor: isDarkMode ? 'rgba(128, 128, 128, 0.1)' : 'rgba(128, 128, 128, 0.1)',
                  borderColor: isDarkMode ? 'rgba(128, 128, 128, 0.3)' : 'rgba(128, 128, 128, 0.3)'
                }]}
                asChild
              >
                <TouchableOpacity>
                  <Ionicons
                    name="notifications-outline"
                    size={20}
                    color={colors.text}
                  />
                  {unreadCount > 0 && (
                    <View style={[styles.badge, { backgroundColor: isDarkMode ? '#808080' : '#606060' }]}>
                      <Text style={[styles.badgeText, { color: '#FFFFFF' }]}>
                        {unreadCount > 99 ? "99+" : unreadCount}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              </Link>
            </View>
          </View>

          <View style={styles.contentContainer}>
            <Posts />
          </View>
        </SafeAreaView>
        <Sidebar />
      </ThemedGradient>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "ios" ? 10 : 20,
    paddingBottom: 10,
    borderBottomWidth: 1,
  },
  leftSection: {
    flexDirection: "row",
    alignItems: "center",
  },
  menuButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
    marginRight: 12,
    borderWidth: 1,
  },
  appName: {
    fontSize: 24,
    fontFamily: "Rubik-Bold",
  },
  tagline: {
    fontSize: 12,
    fontFamily: "Rubik-Medium",
    marginTop: 2,
  },
  rightSection: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
    marginLeft: 12,
    borderWidth: 1,
  },
  badge: {
    position: "absolute",
    top: 4,
    right: 4,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0px 2px 2px rgba(0, 0, 0, 0.2)",
    elevation: 2,
  },
  badgeText: {
    fontSize: 10,
    fontFamily: "Rubik-Medium",
    lineHeight: 12,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: 0, // Remove horizontal padding for full-width posts
  },
});

export default Home;
