import { useColorScheme } from 'react-native';
import { darkTheme, lightTheme, type Theme } from '@/constants/theme';
import { useThemeStore } from '@/store/theme';

export function useTheme(): Theme {
  const scheme = useColorScheme();
  const preference = useThemeStore((s) => s.preference);
  const mode =
    preference === 'dark'  ? 'dark'
    : preference === 'light' ? 'light'
    : scheme === 'dark'    ? 'dark'
    : 'light';
  return mode === 'dark' ? darkTheme : lightTheme;
}
