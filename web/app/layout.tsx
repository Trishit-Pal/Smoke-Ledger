import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import { DM_Sans, Fraunces } from 'next/font/google';
import { ThemeProvider } from 'next-themes';
import { AuthProvider } from '@web/components/providers/AuthProvider';
import { UserThemeSync } from '@web/components/providers/UserThemeSync';
import { ThemeToggle } from '@web/components/layout/ThemeToggle';
import { ChunkReloadGuard } from '@web/components/system/ChunkReloadGuard';
import './globals.css';

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Smoke Ledger',
  description: 'Smoking reduction and cessation support with secure tracking.',
};

// `viewportFit: 'cover'` is what makes the existing `env(safe-area-inset-*)`
// usage (ThemeToggle, BottomNav) actually inset on notched devices — without it
// the insets resolve to 0. themeColor matches the enforced dark default theme.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#0B0F14',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const nonce = headers().get('x-nonce') ?? undefined;
  return (
    <html lang="en" suppressHydrationWarning className={`${dmSans.variable} ${fraunces.variable}`}>
      <body>
        <ChunkReloadGuard />
        <ThemeProvider
          nonce={nonce}
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          storageKey="smoke-ledger-theme"
          disableTransitionOnChange
        >
          <AuthProvider>
            <UserThemeSync />
            <ThemeToggle />
            {children}
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
