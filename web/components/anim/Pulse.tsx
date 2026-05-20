'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { useReduceMotion } from '@web/hooks/useReduceMotion';

export interface PulseProps {
  active?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function Pulse({ active = true, children, className }: PulseProps) {
  const reduced = useReduceMotion();
  if (!active || reduced) return <div className={className}>{children}</div>;

  return (
    <motion.div
      className={className}
      animate={{ scale: [1, 1.04, 1] }}
      transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
    >
      {children}
    </motion.div>
  );
}

export default Pulse;
