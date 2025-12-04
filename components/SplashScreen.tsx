import { View, Text, Image, StyleSheet, Animated } from "react-native";
import { useEffect, useRef } from "react";
import { useTheme } from "@/src/context/ThemeContext";

interface SplashScreenProps {
  onFinish: () => void;
}

export default function SplashScreen({ onFinish }: SplashScreenProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const { colors } = useTheme();

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 2,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();

    const timer = setTimeout(() => {
      onFinish();
    }, 3000);

    return () => clearTimeout(timer);
  }, [fadeAnim, onFinish, scaleAnim]);

  return (
    <View style={[styles.container, { backgroundColor: '#000000' }]}>
      <Animated.View
        style={[
          styles.imageContainer,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
            borderColor: `${colors.primary}30`
          },
        ]}
      >
        <Image
          source={require('../assets/images/splash-icon-light.png')}
          style={styles.logo}
          resizeMode="contain"
        />
      </Animated.View>

      <Animated.Text
        className="font-rubik-bold"
        style={[styles.title, { opacity: fadeAnim, color: colors.primary }]}
      >
        Welcome to Klicktape
      </Animated.Text>
      <Text className="font-rubik-medium" style={[styles.subtitle, { color: colors.textSecondary }]}>
        The ultimate social experience
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  imageContainer: {
    marginBottom: 30,
    boxShadow: "0px 10px 20px rgba(0, 0, 0, 0.2)",
    elevation: 10,
    borderWidth: 2,
    borderRadius: 75,
  },
  logo: {
    width: 150,
    height: 150,
  },
  title: {
    fontSize: 28,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
  },
});

