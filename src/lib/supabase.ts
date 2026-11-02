import 'react-native-url-polyfill/auto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { SESSION_STORAGE_KEY } from '@/lib/secureStore';

const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl as string | undefined;
const supabaseAnonKey = Constants.expoConfig?.extra?.supabaseAnonKey as string | undefined;

if (
  Platform.OS === 'web' &&
  process.env.NODE_ENV === 'production' &&
  typeof window !== 'undefined'
) {
  throw new Error(
    'Expo web production auth is disabled. Use the Next.js web app at your hosted URL for sign-in and sync.',
  );
}

const storeKey = SESSION_STORAGE_KEY;

const storageAdapter = Platform.OS === 'web'
  ? {
      getItem: (key: string) => AsyncStorage.getItem(key),
      setItem: (key: string, value: string) => AsyncStorage.setItem(key, value),
      removeItem: (key: string) => AsyncStorage.removeItem(key),
    }
  : {
      getItem: (key: string) => SecureStore.getItemAsync(key),
      setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
      removeItem: (key: string) => SecureStore.deleteItemAsync(key),
    };

if (Platform.OS === 'web' && process.env.NODE_ENV !== 'production') {
  console.warn(
    '[Smoke Ledger] Expo web stores auth tokens in AsyncStorage. Use the Next.js app for production web.',
  );
}

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (client) return client;
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY. Set them in .env and restart Expo.',
    );
  }
  client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      storage: storageAdapter,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      storageKey: storeKey,
    },
  });
  return client;
}

export function isSupabaseConfigured(): boolean {
  return !!(supabaseUrl && supabaseAnonKey);
}
