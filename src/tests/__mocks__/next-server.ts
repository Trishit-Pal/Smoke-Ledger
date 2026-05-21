/**
 * Minimal mock for `next/server` used in Jest tests that import modules
 * from web/app (e.g. the auth callback route) purely for unit-testing
 * their exported pure-function helpers. The Next.js request/response classes
 * are not needed for those tests.
 */
export class NextRequest {}
export class NextResponse {
  static next() {
    return new NextResponse();
  }
  static redirect() {
    return new NextResponse();
  }
  cookies = { getAll: () => [], set: () => {} };
  headers = { set: () => {} };
}
export type { NextRequest as NextRequestType };
