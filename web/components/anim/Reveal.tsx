'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { useReduceMotion } from '@web/hooks/useReduceMotion';

export interface RevealProps {
  dependencyKey?: string | number;
  duration?: number;
  children: React.ReactNode;
  className?: string;
}

export function Reveal({
  dependencyKey,
  duration = 520,
  children,
  className,
}: RevealProps) {
  const reduced = useReduceMotion();
  if (reduced) return <div className={className}>{children}</div>;

  return (
    <motion.div
      key={dependencyKey ?? 'reveal'}
      className={className}
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: duration / 1000, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

export default Reveal;
