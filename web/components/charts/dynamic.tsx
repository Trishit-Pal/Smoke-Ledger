'use client';

import dynamic from 'next/dynamic';

const chartFallback = (
  <div className="w-full h-40 animate-pulse rounded-md bg-bg-elevated" aria-hidden />
);

export const LineChart = dynamic(
  () => import('@web/components/charts/LineChart').then((m) => m.LineChart),
  { ssr: false, loading: () => chartFallback },
);

export const BarChart = dynamic(
  () => import('@web/components/charts/BarChart').then((m) => m.BarChart),
  { ssr: false, loading: () => chartFallback },
);

export const Donut = dynamic(
  () => import('@web/components/charts/Donut').then((m) => m.Donut),
  { ssr: false, loading: () => chartFallback },
);
