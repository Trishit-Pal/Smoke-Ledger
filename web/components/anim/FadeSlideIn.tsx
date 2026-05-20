'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { useReduceMotion } from '@web/hooks/useReduceMotion';

export interface FadeSlideInProps {
  index?: number;
  delay?: number;
  step?: number;
  children: React.ReactNode;
  className?: string;
}

export function FadeSlideIn({
  index = 0,
  delay = 60,
  step = 60,
  children,
  className,
}: FadeSlideInProps) {
  const reduced = useReduceMotion();
  if (reduced) return <div className={className}>{children}</div>;

  const totalDelay = (delay + index * step) / 1000;
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: totalDelay, duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

export default FadeSlideIn;
