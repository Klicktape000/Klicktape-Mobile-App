import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator,
  StatusBar,
  Modal,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { supabase } from "@/lib/supabase";
import DeleteModal from "@/components/DeleteModal";
import CacheDebugger from "@/components/CacheDebugger";
import ProfileViewers from "@/components/ProfileViewers";
import { useTheme } from "@/src/context/ThemeContext";
import useThemedStyles from "@/hooks/useThemedStyles";
import { ThemedGradient } from "@/components/ThemedGradient";
import { referralAPI } from "@/lib/referralApi";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function SettingsScreen() {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false);
  const [cacheDebuggerVisible, setCacheDebuggerVisible] = useState(false);
  const [isExportingData, setIsExportingData] = useState(false);
  const [showProfileViewers, setShowProfileViewers] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [hasPremium, setHasPremium] = useState(false);
  const [hasEarnedAccess, setHasEarnedAccess] = useState(false);
  const { colors, isDarkMode } = useTheme();

  // Get user ID and check premium status
  useEffect(() => {
    const getUserData = async () => {
      try {
        const userData = await AsyncStorage.getItem("user");
        if (userData) {
          const user = JSON.parse(userData);
          setUserId(user.id);

          // Check if user has premium profile views feature
          const premium = await referralAPI.hasPremiumFeature(user.id, 'profile_views');
          setHasPremium(premium);

          // Check if user has earned access through referrals (5+ completed referrals)
          const dashboard = await referralAPI.getReferralDashboard(user.id);
          const earnedAccess = dashboard ? dashboard.referrals_completed >= 5 : false;
          setHasEarnedAccess(earnedAccess);
        }
      } catch (_error) {
        console.error("Error getting user data:", _error);
      }
    };

    getUserData();
  }, []);

  // Create theme-aware styles
  const themedStyles = useThemedStyles((colors) => ({
    title: {
      fontSize: 24,
      color: colors.text,
    },
    sectionTitle: {
      fontSize: 18,
      color: colors.text,
      marginBottom: 16,
    },
    settingText: {
      flex: 1,
      marginLeft: 16,
      fontSize: 16,
      color: colors.text,
    },
    versionText: {
      textAlign: "center",
      fontSize: 14,
      color: colors.textTertiary,
      marginTop: 20,
    },
  }));

  const handleDeleteAccount = () => {
    setIsDeleteModalVisible(true);
  };

  const handleExportData = async () => {
    try {
      setIsExportingData(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert("Error", "You must be logged in to export your data.");
        return;
      }

      // Collect all user data
      const exportData: any = {
        export_date: new Date().toISOString(),
        user_id: user.id,
        email: user.email,
        profile: null,
        posts: [],
        stories: [],
        reels: [],
        messages: [],
        comments: [],
        likes: [],
        bookmarks: [],
        followers: [],
        following: [],
        communities: [],
      };

      // Get profile data
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();
      exportData.profile = profile;

      // Get posts
      const { data: posts } = await supabase
        .from("posts")
        .select("*")
        .eq("user_id", user.id);
      exportData.posts = posts || [];

      // Get stories
      const { data: stories } = await supabase
        .from("stories")
        .select("*")
        .eq("user_id", user.id);
      exportData.stories = stories || [];

      // Get reels
      const { data: reels } = await supabase
        .from("reels")
        .select("*")
        .eq("user_id", user.id);
      exportData.reels = reels || [];

      // Get messages (sent)
      const { data: sentMessages } = await supabase
        .from("messages")
        .select("*")
        .eq("sender_id", user.id);

      // Get messages (received)
      const { data: receivedMessages } = await supabase
        .from("messages")
        .select("*")
        .eq("receiver_id", user.id);

      exportData.messages = {
        sent: sentMessages || [],
        received: receivedMessages || []
      };

      // Get comments
      const { data: comments } = await supabase
        .from("comments")
        .select("*")
        .eq("user_id", user.id);
      exportData.comments = comments || [];

      // Get likes
      const { data: likes } = await supabase
        .from("likes")
        .select("*")
        .eq("user_id", user.id);
      exportData.likes = likes || [];

      // Get bookmarks
      const { data: bookmarks } = await supabase
        .from("bookmarks")
        .select("*")
        .eq("user_id", user.id);
      exportData.bookmarks = bookmarks || [];

      // Get followers
      const { data: followers } = await supabase
        .from("follows")
        .select("follower_id, created_at")
        .eq("following_id", user.id);
      exportData.followers = followers || [];

      // Get following
      const { data: following } = await supabase
        .from("follows")
        .select("following_id, created_at")
        .eq("follower_id", user.id);
      exportData.following = following || [];



      // Convert to JSON string
      const jsonData = JSON.stringify(exportData, null, 2);

      // Create a shareable file
      const fileName = `klicktape_data_export_${new Date().toISOString().split('T')[0]}.json`;

      // For now, we&apos;ll show the user that their data export is ready
      // In a production app, you might want to email this or provide a download link
      Alert.alert(
        "Data Export Ready",
        `Your data has been prepared for export. The export contains:\n\n• Profile information\n• ${exportData.posts.length} posts\n• ${exportData.stories.length} stories\n• ${exportData.reels.length} reels\n• ${exportData.messages.sent.length + exportData.messages.received.length} messages\n• ${exportData.comments.length} comments\n• ${exportData.likes.length} likes\n• ${exportData.bookmarks.length} bookmarks\n• ${exportData.followers.length} followers\n• ${exportData.following.length} following\n• ${exportData.communities.length} community memberships\n\nPlease contact support at director@klicktape.com to receive your data export file.`,
        [
          {
            text: "Contact Support",
            onPress: () => {
              // Open email client
              const subject = encodeURIComponent("Data Export Request");
              const body = encodeURIComponent(`Hello,\n\nI would like to request my data export. My user ID is: ${user.id}\n\nThank you.`);
              const emailUrl = `mailto:director@klicktape.com?subject=${subject}&body=${body}`;

              import('expo-linking').then(({ default: Linking }) => {
                Linking.openURL(emailUrl).catch(() => {
                  Alert.alert("Error", "Could not open email client. Please email director@klicktape.com manually.");
                });
              });
            }
          },
          { text: "OK" }
        ]
      );

    } catch (__error) {
      console.error("Error exporting data:", __error);
      Alert.alert(
        "Export Error",
        "Failed to export your data. Please try again or contact support."
      );
    } finally {
      setIsExportingData(false);
    }
  };

  const handleCancelDelete = () => {
    setIsDeleteModalVisible(false);
  };

  const handleConfirmDelete = async () => {
    try {
      setIsDeleting(true);

      if (!supabase) {
        console.error("Supabase client is not initialized");
        setIsDeleting(false);
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user?.id) {
        // Get user&apos;s posts for storage cleanup
        const { data: userPosts } = await supabase
          .from("posts")
          .select("id, image_urls")
          .eq("user_id", user.id);

        // Get user&apos;s reels for storage cleanup
        const { data: userReels } = await supabase
          .from("reels")
          .select("id, video_url, thumbnail_url")
          .eq("user_id", user.id);

        // Get user&apos;s stories for storage cleanup
        const { data: userStories } = await supabase
          .from("stories")
          .select("id, image_url")
          .eq("user_id", user.id);

        // Delete all user&apos;s reels and associated data
        await supabase.from("reel_comments").delete().eq("user_id", user.id);
        await supabase.from("reel_likes").delete().eq("user_id", user.id);
        await supabase.from("reel_likes").delete().eq("reel_id", (userReels as any)?.map((reel: any) => reel.id) || []);
        await supabase.from("reel_comments").delete().eq("reel_id", (userReels as any)?.map((reel: any) => reel.id) || []);
        await supabase.from("reels").delete().eq("user_id", user.id);

        // Delete all user&apos;s stories
        await supabase.from("stories").delete().eq("user_id", user.id);

        // Delete all user&apos;s posts and associated data
        await supabase.from("comments").delete().eq("user_id", user.id);
        await supabase.from("likes").delete().eq("user_id", user.id);
        await supabase.from("bookmarks").delete().eq("user_id", user.id);
        await supabase.from("bookmarks").delete().eq("post_id", (userPosts as any)?.map((post: any) => post.id) || []);
        await supabase.from("comments").delete().eq("post_id", (userPosts as any)?.map((post: any) => post.id) || []);
        await supabase.from("likes").delete().eq("post_id", (userPosts as any)?.map((post: any) => post.id) || []);
        await supabase.from("posts").delete().eq("user_id", user.id);

        // Delete all user&apos;s messages and chat rooms
        await supabase.from("messages").delete().eq("sender_id", user.id);
        await supabase.from("messages").delete().eq("receiver_id", user.id);
        await supabase.from("room_participants").delete().eq("user_id", user.id);

        // Delete all user&apos;s notifications
        await supabase.from("notifications").delete().eq("recipient_id", user.id);
        await supabase.from("notifications").delete().eq("sender_id", user.id);

        // Delete user&apos;s profile data
        await supabase.from("profiles").delete().eq("id", user.id);

        // Try to delete from users table if it exists
        try {
          await supabase.from("users").delete().eq("id", user.id);
        } catch (__error) {

        }

        // Delete user&apos;s avatar storage files
        const { data: avatarStorageData } = await supabase.storage
          .from("avatars")
          .list(`user_avatars/${user.id}`);

        if (avatarStorageData && avatarStorageData.length > 0) {
          await Promise.all(
            avatarStorageData.map((file) =>
              supabase.storage
                .from("avatars")
                .remove([`user_avatars/${user.id}/${file.name}`])
            )
          );
        }

        // Delete user&apos;s post media files
        if (userPosts && userPosts.length > 0) {
          for (const post of userPosts) {
            if ((post as any).image_urls && Array.isArray((post as any).image_urls)) {
              await Promise.all(
                (post as any).image_urls.map(async (imageUrl: string) => {
                  try {
                    const filePath = imageUrl.split("/").slice(-2).join("/");
                    await supabase.storage.from("posts").remove([filePath]);
                  } catch (__error) {
                    console.error(`Failed to delete image ${imageUrl}:`, __error);
                  }
                })
              );
            }
          }
        }

        // Delete user&apos;s reel media files
        if (userReels && userReels.length > 0) {
          for (const reel of userReels) {
            try {
              if ((reel as any).video_url) {
                const videoPath = (reel as any).video_url.split("/").slice(-2).join("/");
                await supabase.storage.from("media").remove([videoPath]);
              }
              if ((reel as any).thumbnail_url) {
                const thumbnailPath = (reel as any).thumbnail_url.split("/").slice(-2).join("/");
                await supabase.storage.from("media").remove([thumbnailPath]);
              }
            } catch (__error) {
              console.error(`Failed to delete reel media:`, __error);
            }
          }
        }

        // Delete user&apos;s story media files
        if (userStories && userStories.length > 0) {
          for (const story of userStories) {
            try {
              if ((story as any).image_url) {
                const imagePath = (story as any).image_url.split("/").slice(-2).join("/");
                await supabase.storage.from("stories").remove([imagePath]);
              }
            } catch (__error) {
              console.error(`Failed to delete story media:`, __error);
            }
          }
        }

        // Finally delete the authentication user using our Edge Function
        try {
          // Get the current session for the auth token
          const { data: sessionData } = await supabase.auth.getSession();

          if (!sessionData?.session?.access_token) {
            throw new Error("No valid session found");
          }


          // Call our Edge Function to delete the user
          const { data: deleteData, error: deleteError } = await supabase.functions.invoke('delete-user', {
            headers: {
              Authorization: `Bearer ${sessionData.session.access_token}`
            }
          });

          if (deleteError) {
            console.error("Error calling delete-user function:", deleteError);

            // Show a more specific error message
            Alert.alert(
              "Account Deletion Issue",
              "There was a problem with the account deletion service. Your account data has been removed, but you'll need to sign out manually.",
              [{ text: "OK" }]
            );

            // Sign out the user anyway since their data is gone
            await supabase.auth.signOut();
            router.replace("/sign-in");
            return;
          }

          if (!deleteData?.success) {
            console.error("Delete user function did not return success:", deleteData);
            const errorDetails = deleteData?.details ? `: ${deleteData.details}` : '';

            // Show a more specific error message
            Alert.alert(
              "Account Deletion Issue",
              `There was a problem with the account deletion service${errorDetails}. Your account data has been removed, but you'll need to sign out manually.`,
              [{ text: "OK" }]
            );

            // Sign out the user anyway since their data is gone
            await supabase.auth.signOut();
            router.replace("/sign-in");
            return;
          }



          // Show success message only if we get here (successful deletion)
          Alert.alert(
            "Account Deleted",
            "Your account has been successfully deleted.",
            [
              {
                text: "OK",
                onPress: () => router.replace("/sign-in")
              }
            ]
          );
          return;
        } catch (__error) {
          console.error("Error attempting to delete auth user:", __error);

          // Show a more specific error message
          Alert.alert(
            "Account Deletion Issue",
            "There was a problem with the account deletion service. Your account data has been removed, but you'll need to sign out manually.",
            [{ text: "OK" }]
          );

          // Fallback to sign out if delete fails
          await supabase.auth.signOut();
          router.replace("/sign-in");
          return;
        }
      }
    } catch (__error) {
      console.error("Error deleting account:", __error);
      Alert.alert(
        "Error",
        "Failed to delete account. Please try again."
      );
    } finally {
      setIsDeleting(false);
      setIsDeleteModalVisible(false);
    }
  };

  const handleSignOut = async () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        onPress: async () => {
          try {
            if (!supabase) {
              console.error("Supabase client is not initialized");
              return;
            }
            await supabase.auth.signOut();
            router.replace("/sign-in");
          } catch (__error) {
            console.error("Error signing out:", __error);
            Alert.alert("Error", "Failed to sign out. Please try again.");
          }
        },
      },
    ]);
  };

  return (
    <ThemedGradient style={{ flex: 1 }}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} />
      <SafeAreaView style={{ flex: 1 }}>
        <View style={[styles.header, { backgroundColor: isDarkMode ? 'rgba(128, 128, 128, 0.05)' : 'rgba(128, 128, 128, 0.05)' }]}>
          <TouchableOpacity
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace('/(root)/(tabs)/profile');
              }
            }}
            style={[styles.backButton, {
              backgroundColor: isDarkMode ? 'rgba(128, 128, 128, 0.2)' : 'rgba(128, 128, 128, 0.1)',
              borderColor: isDarkMode ? 'rgba(128, 128, 128, 0.3)' : 'rgba(128, 128, 128, 0.3)'
            }]}
          >
            <Feather name="arrow-left" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text className="font-rubik-bold" style={[styles.title, { color: '#FFFFFF' }]}>
            Settings
          </Text>
        </View>

        <ScrollView
          style={styles.container}
          contentContainerStyle={{ paddingBottom: 40 }}
        >
          <View style={styles.section}>
            <Text className="font-rubik-bold" style={[styles.sectionTitle, { color: colors.text }]}>
              Account
            </Text>
            <TouchableOpacity
              style={[styles.settingItem, {
                backgroundColor: isDarkMode ? 'rgba(128, 128, 128, 0.1)' : 'rgba(128, 128, 128, 0.1)',
                borderColor: isDarkMode ? 'rgba(128, 128, 128, 0.2)' : 'rgba(128, 128, 128, 0.2)'
              }]}
              onPress={() => router.push("/edit-profile")}
            >
              <Feather name="user" size={22} color={colors.text} />
              <Text className="font-rubik-regular" style={[styles.settingText, { color: colors.text }]}>
                Edit Profile
              </Text>
              <Feather
                name="chevron-right"
                size={22}
                color={colors.text}
              />
            </TouchableOpacity>
            {/* <TouchableOpacity style={styles.settingItem}>
              <Feather name="lock" size={22} color="#FFD700" />
              <Text className="font-rubik-regular" style={styles.settingText}>Privacy</Text>
              <Feather name="chevron-right" size={22} color="rgba(255, 215, 0, 0.7)" />
            </TouchableOpacity> */}
          </View>

          <View style={styles.section}>
            <Text className="font-rubik-bold" style={[styles.sectionTitle, { color: colors.text }]}>
              Preferences
            </Text>
            <TouchableOpacity
              style={[styles.settingItem, {
                backgroundColor: isDarkMode ? 'rgba(128, 128, 128, 0.1)' : 'rgba(128, 128, 128, 0.1)',
                borderColor: isDarkMode ? 'rgba(128, 128, 128, 0.2)' : 'rgba(128, 128, 128, 0.2)'
              }]}
              onPress={() => router.push("/notifications")}
            >
              <Feather name="bell" size={22} color={colors.text} />
              <Text className="font-rubik-regular" style={[styles.settingText, { color: colors.text }]}>
                Notifications
              </Text>
              <Feather
                name="chevron-right"
                size={22}
                color={colors.text}
              />
            </TouchableOpacity>


            <TouchableOpacity
              style={[styles.settingItem, {
                backgroundColor: isDarkMode ? 'rgba(128, 128, 128, 0.1)' : 'rgba(128, 128, 128, 0.1)',
                borderColor: isDarkMode ? 'rgba(128, 128, 128, 0.2)' : 'rgba(128, 128, 128, 0.2)'
              }]}
              onPress={() => router.push("/appearance")}
            >
              <Feather name="eye" size={22} color={colors.text} />
              <Text className="font-rubik-regular" style={[styles.settingText, { color: colors.text }]}>
                Appearance
              </Text>
              <Feather
                name="chevron-right"
                size={22}
                color={colors.text}
              />
            </TouchableOpacity>
          </View>

          <View style={styles.section}>
            <Text className="font-rubik-bold" style={[styles.sectionTitle, { color: colors.text }]}>
              Privacy & Analytics
            </Text>
            <TouchableOpacity
              style={[styles.settingItem, {
                backgroundColor: isDarkMode ? 'rgba(128, 128, 128, 0.1)' : 'rgba(128, 128, 128, 0.1)',
                borderColor: isDarkMode ? 'rgba(128, 128, 128, 0.2)' : 'rgba(128, 128, 128, 0.2)'
              }]}
              onPress={() => {
                if (hasPremium || hasEarnedAccess) {
                  setShowProfileViewers(true);
                } else {
                  Alert.alert(
                    "Premium Feature",
                    "Profile Views is a premium feature. Invite 5 friends to unlock it!",
                    [
                      { text: "Cancel", style: "cancel" },
                      { text: "Invite Friends", onPress: () => router.push("/profile") }
                    ]
                  );
                }
              }}
            >
              <Feather name="users" size={22} color={colors.text} />
              <Text className="font-rubik-regular" style={[styles.settingText, { color: colors.text }]}>
                Who Viewed My Profile
              </Text>
              {(hasPremium || hasEarnedAccess) ? (
                <Feather name="chevron-right" size={22} color={colors.text} />
              ) : (
                <View style={[styles.premiumBadge, { backgroundColor: colors.primary }]}>
                  <Text style={[styles.premiumText, { color: colors.background }]}>Premium</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.section}>
            <Text className="font-rubik-bold" style={[styles.sectionTitle, { color: colors.text }]}>
              Support
            </Text>
            <TouchableOpacity style={[styles.settingItem, {
              backgroundColor: isDarkMode ? 'rgba(128, 128, 128, 0.1)' : 'rgba(128, 128, 128, 0.1)',
              borderColor: isDarkMode ? 'rgba(128, 128, 128, 0.2)' : 'rgba(128, 128, 128, 0.2)'
            }]}>
              <Feather name="help-circle" size={22} color={colors.text} />
              <Text className="font-rubik-regular" style={[styles.settingText, { color: colors.text }]}>
                Help Center
              </Text>
              <Feather
                name="chevron-right"
                size={22}
                color={colors.text}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.settingItem, {
                backgroundColor: isDarkMode ? 'rgba(128, 128, 128, 0.1)' : 'rgba(128, 128, 128, 0.1)',
                borderColor: isDarkMode ? 'rgba(128, 128, 128, 0.2)' : 'rgba(128, 128, 128, 0.2)'
              }]}
              onPress={() => router.push("/terms-and-conditions")}
            >
              <Feather name="file-text" size={22} color={colors.text} />
              <Text className="font-rubik-regular" style={[styles.settingText, { color: colors.text }]}>
                Terms and Conditions
              </Text>
              <Feather
                name="chevron-right"
                size={22}
                color={colors.text}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.settingItem, {
                backgroundColor: isDarkMode ? 'rgba(128, 128, 128, 0.1)' : 'rgba(128, 128, 128, 0.1)',
                borderColor: isDarkMode ? 'rgba(128, 128, 128, 0.2)' : 'rgba(128, 128, 128, 0.2)'
              }]}
              onPress={() => router.push("/privacy-policy")}
            >
              <Feather name="shield" size={22} color={colors.text} />
              <Text className="font-rubik-regular" style={[styles.settingText, { color: colors.text }]}>
                Privacy Policy
              </Text>
              <Feather
                name="chevron-right"
                size={22}
                color={colors.text}
              />
            </TouchableOpacity>
          </View>

          {/* Developer Tools Section (Development Only) */}
          {__DEV__ && (
            <View style={styles.section}>
              <Text className="font-rubik-bold" style={[styles.sectionTitle, { color: colors.text }]}>
                Developer Tools
              </Text>
              <TouchableOpacity
                style={[styles.settingItem, {
                  backgroundColor: isDarkMode ? 'rgba(128, 128, 128, 0.1)' : 'rgba(128, 128, 128, 0.1)',
                  borderColor: isDarkMode ? 'rgba(128, 128, 128, 0.2)' : 'rgba(128, 128, 128, 0.2)'
                }]}
                onPress={() => setCacheDebuggerVisible(true)}
              >
                <Feather name="database" size={22} color={colors.text} />
                <Text className="font-rubik-regular" style={[styles.settingText, { color: colors.text }]}>
                  Cache Management
                </Text>
                <Feather
                  name="chevron-right"
                  size={22}
                  color={colors.text}
                />
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.section}>
            <Text className="font-rubik-bold" style={[styles.sectionTitle, { color: colors.text }]}>
              Account Actions
            </Text>
            <TouchableOpacity
              style={[styles.signOutButton, {
                backgroundColor: isDarkMode ? 'rgba(128, 128, 128, 0.1)' : 'rgba(128, 128, 128, 0.1)',
                borderColor: isDarkMode ? 'rgba(128, 128, 128, 0.2)' : 'rgba(128, 128, 128, 0.2)'
              }]}
              onPress={handleExportData}
              disabled={isExportingData}
            >
              <Feather name="download" size={22} color={colors.text} />
              <Text className="font-rubik-medium" style={[styles.signOutText, { color: colors.text }]}>
                {isExportingData ? "Exporting Data..." : "Export My Data"}
              </Text>
              {isExportingData && (
                <ActivityIndicator
                  size="small"
                  color={colors.primary}
                  style={{ marginLeft: 10 }}
                />
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.signOutButton, {
                backgroundColor: isDarkMode ? 'rgba(128, 128, 128, 0.1)' : 'rgba(128, 128, 128, 0.1)',
                borderColor: isDarkMode ? 'rgba(128, 128, 128, 0.2)' : 'rgba(128, 128, 128, 0.2)'
              }]}
              onPress={handleSignOut}
            >
              <Feather name="log-out" size={22} color={colors.text} />
              <Text className="font-rubik-medium" style={[styles.signOutText, { color: colors.text }]}>
                Sign Out
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.deleteButton, {
                backgroundColor: isDarkMode ? 'rgba(128, 128, 128, 0.1)' : 'rgba(128, 128, 128, 0.1)',
                borderColor: isDarkMode ? 'rgba(128, 128, 128, 0.2)' : 'rgba(128, 128, 128, 0.2)'
              }]}
              onPress={handleDeleteAccount}
              disabled={isDeleting}
            >
              <Feather name="trash-2" size={22} color="#FFFFFF" />
              <Text
                className="font-rubik-medium"
                style={[styles.deleteButtonText, { color: colors.text }]}
              >
                {isDeleting ? "Deleting Account..." : "Delete Account"}
              </Text>
              {isDeleting && (
                <ActivityIndicator
                  size="small"
                  color={colors.primary}
                  style={{ marginLeft: 10 }}
                />
              )}
            </TouchableOpacity>
          </View>

          <Text className="font-rubik-regular" style={[styles.versionText, { color: colors.textTertiary }]}>
            Version 1.0.0
          </Text>
        </ScrollView>
      </SafeAreaView>

      {/* Delete Account Confirmation Modal */}
      <DeleteModal
        isVisible={isDeleteModalVisible}
        title="Delete Account"
        desc="account"
        cancel={handleCancelDelete}
        confirm={handleConfirmDelete}
      />

      {/* Cache Debugger Modal */}
      <CacheDebugger
        isVisible={cacheDebuggerVisible}
        onClose={() => setCacheDebuggerVisible(false)}
      />

      {/* Profile Viewers Modal */}
      <Modal
        visible={showProfileViewers}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowProfileViewers(false)}
      >
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          <SafeAreaView style={{ flex: 1 }}>
            <View style={[styles.modalHeader, { backgroundColor: colors.backgroundSecondary, borderBottomColor: colors.cardBorder }]}>
              <TouchableOpacity
                onPress={() => setShowProfileViewers(false)}
                style={[styles.closeButton, { backgroundColor: colors.card }]}
              >
                <Feather name="x" size={24} color={colors.text} />
              </TouchableOpacity>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Who Viewed My Profile</Text>
              <View style={{ width: 40 }} />
            </View>
            {userId && (
              <ProfileViewers
                userId={userId}
                onViewProfile={(profileId) => {
                  setShowProfileViewers(false);
                  router.push(`/userProfile/${profileId}`);
                }}
              />
            )}
          </SafeAreaView>
        </View>
      </Modal>
    </ThemedGradient>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "rgba(255, 215, 0, 0.05)",
  },
  backButton: {
    padding: 8,
    marginRight: 16,
    backgroundColor: "rgba(255, 215, 0, 0.2)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 215, 0, 0.3)",
  },
  title: {
    fontSize: 24,
    color: "#ffffff",
  },
  container: {
    flex: 1,
    padding: 20,
  },
  deleteButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 215, 0, 0.1)",
    padding: 16,
    borderRadius: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 215, 0, 0.2)",
  },
  deleteButtonText: {
    color: "#ffffff",
    fontSize: 16,
    marginLeft: 12,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    color: "#FFD700",
    marginBottom: 12,
  },
  settingItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 215, 0, 0.1)",
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 215, 0, 0.2)",
  },
  settingText: {
    flex: 1,
    fontSize: 16,
    color: "#ffffff",
    marginLeft: 12,
  },
  signOutButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 215, 0, 0.1)",
    padding: 16,
    borderRadius: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 215, 0, 0.2)",
  },
  signOutText: {
    color: "#ffffff",
    fontSize: 16,
    marginLeft: 12,
  },
  versionText: {
    textAlign: "center",
    color: "rgba(255, 255, 255, 0.7)",
    fontSize: 14,
    marginTop: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'Rubik-SemiBold',
  },
  premiumBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  premiumText: {
    fontSize: 12,
    fontFamily: 'Rubik-SemiBold',
  },
});

