/**
 * Klicktape App Configuration
 * 
 * Dynamic configuration that supports different environments
 * and secure environment variable handling.
 */

// Environment-based configuration
const IS_DEV = process.env.APP_VARIANT === 'development';
const IS_PREVIEW = process.env.APP_VARIANT === 'preview';
const IS_PRODUCTION = process.env.APP_VARIANT === 'production' || !process.env.APP_VARIANT;

/**
 * Get app name based on environment
 */
const getAppName = () => {
  if (IS_DEV) {
    return 'Klicktape (Dev)';
  }
  if (IS_PREVIEW) {
    return 'Klicktape (Preview)';
  }
  return 'Klicktape';
};

/**
 * Get Android package name based on environment
 */
const getAndroidPackage = () => {
  if (IS_DEV) {
    return 'com.klicktape.dev';
  }
  if (IS_PREVIEW) {
    return 'com.klicktape.preview';
  }
  return 'com.klicktape';
};

/**
 * Get iOS bundle identifier based on environment
 */
const getIosBundleIdentifier = () => {
  if (IS_DEV) {
    return 'com.klicktape.dev';
  }
  if (IS_PREVIEW) {
    return 'com.klicktape.preview';
  }
  return 'com.klicktape';
};

export default {
  expo: {
    name: getAppName(),
    slug: 'klicktape',
    version: '1.0.0',
    newArchEnabled: true,
    scheme: 'klicktape',

    icon: "./assets/images/adaptive-icon.png",

    splash: {
      image: "./assets/images/splash-icon-dark.png",
      resizeMode: "contain",
      backgroundColor: "#000000"
    },

    android: {
      package: getAndroidPackage(),
      icon: "./assets/images/adaptive-icon.png",
      adaptiveIcon: {
        foregroundImage: "./assets/images/adaptive-icon.png",
        backgroundColor: "#000000"
      },
      splash: {
        image: "./assets/images/splash-icon-dark.png",
        resizeMode: "contain",
        backgroundColor: "#000000"
      }
    },

    ios: {
      bundleIdentifier: getIosBundleIdentifier(),
      icon: "./assets/images/adaptive-icon.png",
      splash: {
        image: "./assets/images/splash-icon-dark.png",
        resizeMode: "contain",
        backgroundColor: "#000000",
        tabletImage: "./assets/images/splash-icon-dark.png"
      }
    },
    
    web: {
      bundler: 'metro',
      output: 'single',
      favicon: './assets/images/favicon.png',
      notification: {
        vapidPublicKey: 'BOJbGnEpS2iDXUJLYFERz1p45wcPY25PdiGe8IDtUh10v1pA2e7T5AZgO7xV2FDtXBeEBVh6L3oWXbW0JzQE3n4',
      },
    },
    
    plugins: [
      "expo-router",
      "expo-video"
    ],

    experiments: {
      typedRoutes: true,
    },

    updates: {
      url: "https://u.expo.dev/c56f1fc9-1068-4cc4-90e3-9275bda6ec4e"
    },
    
    runtimeVersion: "1.0.0",
    
    extra: {
      router: {
        origin: false,
      },
     "eas": {
        "projectId": "c56f1fc9-1068-4cc4-90e3-9275bda6ec4e"
      },
      // Environment information (safe to expose)
      environment: {
        isDev: IS_DEV,
        isPreview: IS_PREVIEW,
        isProduction: IS_PRODUCTION,
        variant: process.env.APP_VARIANT || 'production',
      },
    },
  },
};
