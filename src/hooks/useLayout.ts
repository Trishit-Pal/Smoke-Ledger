import { useWindowDimensions } from 'react-native';

/** Mirrors web's Tailwind `md` (768) so both apps switch structure at one width. */
export const WIDE_MIN_WIDTH = 768;
/** Mirrors web's `short-landscape` variant: a phone on its side. */
export const SHORT_MAX_HEIGHT = 500;
/** Reading measure for wide windows: content centres instead of stretching. */
export const CONTENT_MAX_WIDTH = 840;

export interface LayoutClass {
  width: number;
  height: number;
  /** Tablet / unfolded foldable / large split-screen pane: room for two columns. */
  isWide: boolean;
  /** Landscape phone: vertical space is scarce, so chrome compacts. */
  isShort: boolean;
}

/**
 * Window-size classes, the single source of native breakpoints. Uses the
 * *window*, not the device: Android multi-window or a split pane on a tablet can
 * hand a phone-width window to a large device, and the layout must follow it.
 */
export function useLayout(): LayoutClass {
  const { width, height } = useWindowDimensions();
  return {
    width,
    height,
    isWide: width >= WIDE_MIN_WIDTH,
    isShort: height < SHORT_MAX_HEIGHT,
  };
}
