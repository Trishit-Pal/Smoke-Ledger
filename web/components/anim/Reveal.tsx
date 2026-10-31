'use client';

import * as React from 'react';

export interface RevealProps {
  /** Changing this re-mounts the wrapper so the reveal plays again. */
  dependencyKey?: string | number;
  children: React.ReactNode;
  className?: string;
}

/** Fades content in with the editorial easing. Pure CSS (.reveal-fade); the
 *  reduced-motion fallback lives in globals.css. */
export function Reveal({ dependencyKey, children, className }: RevealProps) {
  return (
    <div key={dependencyKey ?? 'reveal'} className={`reveal-fade${className ? ` ${className}` : ''}`}>
      {children}
    </div>
  );
}

export default Reveal;
