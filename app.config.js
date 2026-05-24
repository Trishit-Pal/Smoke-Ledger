/* eslint-disable @typescript-eslint/no-var-requires */
// Single source of truth for Expo config (dynamic). app.json was removed in the
// SDK 56 upgrade so expo-doctor has one unambiguous config to read.

module.exports = {
  expo: {
    name: 'Smoke Ledger',
    slug: 'smoke-ledger-india',
    version: '0.2.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    scheme: 'smokeledger',
    userInterfaceStyle: 'automatic',
    ios: {
      supportsTablet: false,
      bundleIdentifier: 'app.smokeledger.india',
    },
    android: {
      package: 'app.smokeledger.india',
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#0B0F14',
      },
    },
    plugins: [
      'expo-router',
      'expo-secure-store',
      'expo-notifications',
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
