// Looks up the signed-in user id from a session getter; never rejects or throws.
// On any failure the caller just gets null, and whatever depends on the id stays hidden.

interface SessionResult {
  data: { session: { user: { id: string } } | null };
}

export async function sessionUserId(getSession: () => Promise<SessionResult>): Promise<string | null> {
  try {
    return (await getSession()).data.session?.user.id ?? null;
  } catch {
    return null;
  }
}
