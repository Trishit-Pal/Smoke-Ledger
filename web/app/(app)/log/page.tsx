import { redirect } from 'next/navigation';

// /log merged into the Ledger (/history), which already opens on today's entries.
// Kept as a redirect so old links and the post-auth allowlist entry still land.
export default function LogPage() {
  redirect('/history');
}
