import type { Metadata } from 'next';
import { DM_Sans, Fraunces } from 'next/font/google';
import { ThemeProvider } from 'next-themes';
import { AuthProvider } from '@web/components/providers/AuthProvider';
import { ThemeToggle } from '@web/components/layout/ThemeToggle';
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${dmSans.variable} ${fraunces.variable}`}>
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          storageKey="smoke-ledger-theme"
          disableTransitionOnChange
        >
          <AuthProvider>
            <ThemeToggle />
            {children}
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
