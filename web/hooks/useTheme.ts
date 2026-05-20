'use client';
import { useTheme as useNextTheme } from 'next-themes';
import { darkTheme, lightTheme, type Theme } from '@/constants/theme';

export function useTheme(): Theme {
  const { resolvedTheme } = useNextTheme();
  return resolvedTheme === 'dark' ? darkTheme : lightTheme;
}
