'use client';

import dynamic from 'next/dynamic';
import type { RevealProps } from '@web/components/anim/Reveal';

export const Reveal = dynamic<RevealProps>(
  () => import('@web/components/anim/Reveal').then((m) => m.Reveal),
  { ssr: false },
);
