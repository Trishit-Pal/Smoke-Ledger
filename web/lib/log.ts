type Level = 'info' | 'warn' | 'error';
type Fields = Record<string, unknown>;

export function serverLog(level: Level, event: string, fields: Fields = {}): void {
  const entry = JSON.stringify({ level, event, ...fields });
  if (level === 'error') {
    // eslint-disable-next-line no-console
    console.error(entry);
  } else if (level === 'warn') {
    // eslint-disable-next-line no-console
    console.warn(entry);
  } else {
    // eslint-disable-next-line no-console
    console.log(entry);
  }
}
