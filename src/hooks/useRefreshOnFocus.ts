import { useCallback, useRef } from 'react';
import { useFocusEffect } from 'expo-router';

// useRefreshOnFocus — re-pulls data when a screen regains focus. This is the
// fallback for the "switch views to refresh" case when the realtime socket is
// down (e.g. just back from background, flaky network). The first focus after
// mount is skipped by default because boot()/realtime already loaded fresh data
// — re-fetching then would be a wasteful duplicate.

interface Options {
  skipFirst?: boolean;
}

export function useRefreshOnFocus(
  refresh: () => void | Promise<void>,
  { skipFirst = true }: Options = {},
): void {
  const isFirstFocus = useRef(true);

  useFocusEffect(
    useCallback(() => {
      if (skipFirst && isFirstFocus.current) {
        isFirstFocus.current = false;
        return;
      }
      void refresh();
    }, [refresh, skipFirst]),
  );
}
