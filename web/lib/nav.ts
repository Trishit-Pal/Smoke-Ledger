/** True when `pathname` is one of `prefixes` or nested under one (segment-aware,
 *  so `/log` does not claim `/logout`). Shared by BottomNav and Sidebar. */
export function isNavActive(pathname: string, prefixes: readonly string[]): boolean {
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
