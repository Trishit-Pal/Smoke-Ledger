import * as React from 'react';

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-bg text-text">
      <main className="max-w-2xl mx-auto p-lg md:p-xl">{children}</main>
    </div>
  );
}
