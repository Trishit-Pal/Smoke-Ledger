// Native motion tokens, mirroring web/app/globals.css (`editorial-stage`, 720ms
// cubic-bezier(0.16, 1, 0.3, 1)). DESIGN.md: slow, gravitational, no spring and
// no bounce, so every press and settle uses timing with this one curve.
import { Easing } from 'react-native-reanimated';

/** The editorial ease-out (expo-like): fast start, long gravitational settle. */
export const EDITORIAL_EASE = Easing.bezier(0.16, 1, 0.3, 1);

/** Press-in (scale down): near-instant so the tap registers under the finger. */
export const PRESS_IN = { duration: 80, easing: EDITORIAL_EASE } as const;

/** Press release and other short feedback: brief, so taps feel immediate. */
export const PRESS = { duration: 140, easing: EDITORIAL_EASE } as const;

/** Indicators and thumbs moving between positions (tab bar, segmented toggle). */
export const SETTLE = { duration: 420, easing: EDITORIAL_EASE } as const;
