'use client';

import dynamic from 'next/dynamic';
import type { FadeSlideInProps } from '@web/components/anim/FadeSlideIn';
import type { RevealProps } from '@web/components/anim/Reveal';
import type { PulseProps } from '@web/components/anim/Pulse';

export const FadeSlideIn = dynamic<FadeSlideInProps>(
  () => import('@web/components/anim/FadeSlideIn').then((m) => m.FadeSlideIn),
  { ssr: false },
);

export const Reveal = dynamic<RevealProps>(
  () => import('@web/components/anim/Reveal').then((m) => m.Reveal),
  { ssr: false },
);

export const Pulse = dynamic<PulseProps>(
  () => import('@web/components/anim/Pulse').then((m) => m.Pulse),
  { ssr: false },
);
