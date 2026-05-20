// Notification scaffolding. Permission + scheduling wrapper.
// Keep safe to call even without permissions granted.

let notificationsModule: any = null;
function load() {
  if (!notificationsModule) {
    try {
      notificationsModule = require('expo-notifications');
    } catch {
      notificationsModule = null;
    }
  }
  return notificationsModule;
}

export async function requestPermissions(): Promise<boolean> {
  const N = load();
  if (!N) return false;
  const settings = await N.getPermissionsAsync();
  if (settings.granted) return true;
  const req = await N.requestPermissionsAsync();
  return !!req.granted;
}

export async function scheduleDailyReminder(hour: number, minute: number, body: string) {
  const N = load();
  if (!N) return null;
  return N.scheduleNotificationAsync({
    content: { title: 'Quick check-in', body, sound: false },
    trigger: { hour, minute, repeats: true },
  });
}

export async function cancelAll() {
  const N = load();
  if (!N) return;
  await N.cancelAllScheduledNotificationsAsync();
}
