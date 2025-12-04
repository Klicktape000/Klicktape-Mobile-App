import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../src/context/ThemeContext";
import { formatTime } from "../lib/utils/formatUtils";

interface PinnedCommentIndicatorProps {
  isPinned: boolean;
  pinnedAt?: string;
  pinnedBy?: string;
  style?: any;
  size?: "small" | "medium" | "large";
  showText?: boolean;
}

const PinnedCommentIndicator: React.FC<PinnedCommentIndicatorProps> = ({
  isPinned,
  pinnedAt,
  pinnedBy,
  style,
  size = "medium",
  showText = true,
}) => {
  const { colors } = useTheme();

  // Don't render if not pinned
  if (!isPinned) {
    return null;
  }

  // Size configurations
  const sizeConfig = {
    small: {
      iconSize: 12,
      fontSize: 10,
      padding: 2,
      borderRadius: 4,
    },
    medium: {
      iconSize: 14,
      fontSize: 11,
      padding: 4,
      borderRadius: 6,
    },
    large: {
      iconSize: 16,
      fontSize: 12,
      padding: 6,
      borderRadius: 8,
    },
  };

  const config = sizeConfig[size];

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: `${colors.primary}15`,
          borderColor: `${colors.primary}30`,
          borderRadius: config.borderRadius,
          paddingHorizontal: config.padding * 2,
          paddingVertical: config.padding,
        },
        style,
      ]}
    >
      <View style={styles.content}>
        <Ionicons
          name="pin"
          size={config.iconSize}
          color={colors.primary}
          style={styles.pinIcon}
        />
        {showText && (
          <Text
            style={[
              styles.pinnedText,
              {
                color: colors.primary,
                fontSize: config.fontSize,
              },
            ]}
          >
            Pinned
          </Text>
        )}
        {pinnedAt && showText && size !== "small" && (
          <Text
            style={[
              styles.timeText,
              {
                color: colors.textSecondary,
                fontSize: config.fontSize - 1,
              },
            ]}
          >
            • {formatTime(parseInt(pinnedAt))}
          </Text>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
  },
  pinIcon: {
    marginRight: 4,
  },
  pinnedText: {
    fontWeight: "600",
    marginRight: 4,
  },
  timeText: {
    fontWeight: "400",
  },
});

export default PinnedCommentIndicator;

