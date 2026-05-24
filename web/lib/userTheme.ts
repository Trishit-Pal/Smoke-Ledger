// Shared key/type for the per-user theme preference stored in settings_kv.
// The dark/light choice is saved per user so it follows the account across
// devices, layered over next-themes' device-level value. enableSystem is off
// in the ThemeProvider, so only 'light' | 'dark' are valid.

export const USER_THEME_SETTING_KEY = 'preferences.theme';

export type StoredUserTheme = 'light' | 'dark';
