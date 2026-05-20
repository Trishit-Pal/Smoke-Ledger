import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const THEME_STORAGE_KEY = '@smokeledger/themePreference';

export type ThemePreference = 'system' | 'light' | 'dark';

interface ThemeStore {
  preference: ThemePreference;
  setPreference: (p: ThemePreference) => void;
}

export const useThemeStore = create<ThemeStore>((set) => ({
  preference: 'system',
  setPreference: (preference) => {
    set({ preference });
    AsyncStorage.setItem(THEME_STORAGE_KEY, preference).catch(() => {});
  },
}));

// Hydrate from AsyncStorage on module load (async, non-blocking).
AsyncStorage.getItem(THEME_STORAGE_KEY).then((saved) => {
  if (saved === 'light' || saved === 'dark' || saved === 'system') {
    useThemeStore.setState({ preference: saved });
  }
}).catch(() => {});
