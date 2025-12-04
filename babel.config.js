module.exports = function (api) {
  api.cache(true);
  const isWeb =
    process.env.BABEL_ENV === 'web' ||
    process.env.EXPO_PLATFORM === 'web' ||
    process.env.EXPO_WEB === 'true';

  return {
    presets: ["babel-preset-expo"],
    plugins: [
      // "nativewind/babel", // Disabled due to PostCSS async plugin error with NativeWind v2.0.11
      // Only add worklets plugin for native builds, not web
      ...(isWeb ? [] : ['react-native-worklets/plugin']),
    ],
  };
};
