// Web shim for src/lib/haptics.ts — uses Web Vibration API with silent fallback.
export function tap() { navigator.vibrate?.(10); }
export function success() { navigator.vibrate?.([50, 30, 50]); }
export function warn() { navigator.vibrate?.(100); }
export function impact() { navigator.vibrate?.(20); }
