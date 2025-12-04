import { Tabs } from "expo-router";
import { View, Text, StyleSheet } from "react-native";
import React, { useEffect } from "react";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/src/context/ThemeContext";
import { useProfileProtection } from "@/hooks/useProfileProtection";
import { useAuth } from "@/lib/authContext";
import { useQueryClient } from '@tanstack/react-query';
import { getPrefetchManager } from "@/lib/performance/appPrefetchManager";

const TabIcon = ({
  iconName,
  focused,
  title,
}: {
  iconName: any; // Using any to fix the TypeScript error
  focused: boolean;
  title: string;
}) => {
  const { colors, isDarkMode } = useTheme();

  return (
    <View style={styles.tabIconContainer}>
      <View style={[
        styles.iconWrapper,
        focused && { backgroundColor: 'rgba(255, 255, 255, 0.1)' } // White highlight for focused state on black background
      ]}>
        <Feather
          name={iconName}
          size={24}
          color="#FFFFFF" // Always white icons for black background
        />
      </View>
      <Text
        style={[
          styles.title,
          { color: "#FFFFFF" }, // Always white text for black background
        ]}
      >
        {title}
      </Text>
    </View>
  );
};

export default function Layout() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // **CRITICAL**: Prefetch ALL app sections IMMEDIATELY when tabs layout mounts
  // This ensures instant navigation from ANY tab - NO DELAYS
  useEffect(() => {
    if (user?.id && queryClient) {
      const prefetchManager = getPrefetchManager(queryClient, user.id);
      
      // Start IMMEDIATE comprehensive prefetch - NO setTimeout delay
      prefetchManager.prefetchAllSections();
    }
  }, [user?.id, queryClient]);

  // Debug: Track when tabs layout mounts/unmounts
  useEffect(() => {
    //// console.log('🏠 TabsLayout: Component mounted');
    return () => {
      //// console.log('🏠 TabsLayout: Component unmounted');
    };
  }, []);

  // Protect all tab routes - redirect to create-profile if profile incomplete
  //// console.log('🏠 TabsLayout: Running profile protection check');
  useProfileProtection();

  const { colors, isDarkMode } = useTheme();

  return (
    <Tabs
      initialRouteName="home"
      screenOptions={{
        tabBarShowLabel: false,
        tabBarStyle: [
          styles.tabBar,
          {
            backgroundColor: '#000000', // Solid black background as per reference design
            borderColor: 'rgba(128, 128, 128, 0.2)'
          }
        ],
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "Home",
          headerShown: false,
          tabBarIcon: ({ focused }) => (
            <TabIcon iconName="home" focused={focused} title="Home" />
          ),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: "Search",
          headerShown: false,
          tabBarIcon: ({ focused }) => (
            <TabIcon
              iconName="search"
              focused={focused}
              title="Search"
            />
          ),
        }}
      />
      <Tabs.Screen
        name="create"
        options={{
          title: "Create",
          headerShown: false,
          tabBarIcon: ({ focused }) => (
            <TabIcon
              iconName="plus-square"
              focused={focused}
              title="Create"
            />
          ),
        }}
      />
      <Tabs.Screen
        name="reels"
        options={{
          title: "Reels",
          headerShown: false,
          tabBarIcon: ({ focused }) => (
            <TabIcon iconName="film" focused={focused} title="Tapes" />
          ),
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          headerShown: false,
          tabBarIcon: ({ focused }) => (
            <TabIcon
              iconName="user"
              focused={focused}
              title="Profile"
            />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    borderRadius: 0, // Remove rounded corners for solid design
    marginHorizontal: 0, // Remove horizontal margin for full width
    marginBottom: 0, // Remove bottom margin for proper positioning
    height: 90,
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    position: "relative",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 0, // Remove border for clean solid look
    zIndex: 0,
  },
  tabIconContainer: {
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    height: "100%",
    paddingHorizontal: 10,
  },
  iconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "transparent",
    marginBottom: 4,
  },
  icon: {
    width: 30,
    height: 30,
  },
  title: {
    fontSize: 10,
    fontFamily: "Rubik-Medium",
    textAlign: "center",
    marginTop: 2,
    includeFontPadding: false,
    textTransform: "uppercase",
    letterSpacing: 0.2,
    width: "100%",
    overflow: "hidden",
  },
});

