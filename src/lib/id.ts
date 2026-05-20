// Lightweight ID generator; avoids uuid dependency.
// Not cryptographically strong; fine for local-only app.

export function makeId(prefix = 'id'): string {
  const ts = Date.now().toString(36);
  const rnd = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${ts}${rnd}`;
}
