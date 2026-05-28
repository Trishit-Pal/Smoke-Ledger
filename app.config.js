/* eslint-disable @typescript-eslint/no-var-requires */
// Single source of truth for Expo config (dynamic). app.json was removed in the
// SDK 56 upgrade so expo-doctor has one unambiguous config to read.

module.exports = {
  expo: {
    name: 'Smoke Ledger',
    slug: 'smoke-ledger-india',
    version: '0.2.0',
    // Pins the OTA runtime to the marketing version so an EAS Update can only
    // ship against a matching native build. Bump `version` when shipping new
    // native code (and use OTA for JS-only fixes within that version).
    runtimeVersion: { policy: 'appVersion' },
    orientation: 'portrait',
    icon: './assets/icon.png',
    scheme: 'smokeledger',
    userInterfaceStyle: 'automatic',
    ios: {
      supportsTablet: false,
      bundleIdentifier: 'app.smokeledger.india',
      buildNumber: '1',
    },
    android: {
      package: 'app.smokeledger.india',
      versionCode: 1,
      // Edge-to-edge layout (SDK 35+ default; opt-in explicit for clarity).
      edgeToEdgeEnabled: true,
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#0B0F14',
      },
      // Permissions are intentionally NOT enumerated here so Expo's minimal
      // defaults apply (INTERNET, ACCESS_NETWORK_STATE, WAKE_LOCK). The
      // expo-notifications plugin adds POST_NOTIFICATIONS via its own mod.
      // If a permission is ever discovered in the final manifest that we don't
      // need, add it to `blockedPermissions` here.
    },
    plugins: [
      'expo-router',
      'expo-secure-store',
      'expo-notifications',
      'expo-font',
      [
        'expo-splash-screen',
        {
          image: './assets/splash.png',
          resizeMode: 'contain',
          backgroundColor: '#0B0F14',
        },
      ],
    ],
    experiments: {
      typedRoutes: false,
    },
    extra: {
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
      supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
      webBaseUrl: process.env.EXPO_PUBLIC_WEB_BASE_URL ?? '',
    },
  },
};
