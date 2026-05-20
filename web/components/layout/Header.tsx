'use client';

import * as React from 'react';

export interface HeaderProps {
  title?: string;
  subtitle?: string;
  rightSlot?: React.ReactNode;
}

export function Header({ title, subtitle, rightSlot }: HeaderProps) {
  return (
    <header className="flex items-center justify-between px-lg py-md">
      <div className="flex flex-col min-w-0">
        {subtitle ? (
          <span className="text-caption uppercase text-text-muted tracking-wide">
            {subtitle}
          </span>
        ) : null}
        {title ? (
          <h1 className="text-display font-bold tracking-tight text-text truncate">
            {title}
          </h1>
        ) : null}
      </div>
      {rightSlot ? (
        <div className="shrink-0 flex items-center gap-sm">{rightSlot}</div>
      ) : null}
    </header>
  );
}

export default Header;
