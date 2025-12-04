// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: [
      "dist/*",
      "supabase/functions/**/*", // Ignore Supabase Edge Functions (Deno environment)
      "scripts/**/*", // Ignore Node.js scripts that use __dirname
    ],
  }
]);
