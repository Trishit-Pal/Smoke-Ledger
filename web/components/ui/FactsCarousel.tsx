'use client';

import * as React from 'react';
import { fetchRandomFacts, markFactSeen } from '@/db/repositories/facts';
import type { SmokingFact } from '@/constants/facts';
import { Card } from '@web/components/ui/Card';
import { cn } from '@web/components/ui/cn';

export interface FactsCarouselProps {
  count?: number;
}

export function FactsCarousel({ count = 5 }: FactsCarouselProps) {
  const [facts, setFacts] = React.useState<SmokingFact[]>([]);
  const [activeIdx, setActiveIdx] = React.useState(0);
  const scrollerRef = React.useRef<HTMLDivElement | null>(null);
  const seenRef = React.useRef<Set<string>>(new Set());

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await fetchRandomFacts(count);
      if (!cancelled) setFacts(result);
    })();
    return () => {
      cancelled = true;
    };
  }, [count]);

  React.useEffect(() => {
    const root = scrollerRef.current;
    if (!root || facts.length === 0) return;

    const cards = Array.from(root.querySelectorAll<HTMLElement>('[data-fact-idx]'));
    if (cards.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
            const idx = Number((entry.target as HTMLElement).dataset.factIdx);
            if (Number.isFinite(idx)) {
              setActiveIdx(idx);
              const fact = facts[idx];
              if (fact && !seenRef.current.has(fact.id)) {
                seenRef.current.add(fact.id);
                void markFactSeen(fact.id);
              }
            }
          }
        }
      },
      { root, threshold: [0.6] },
    );

    cards.forEach((c) => observer.observe(c));
    return () => observer.disconnect();
  }, [facts]);

  if (facts.length === 0) return null;

  return (
    <section aria-label="Did you know facts" className="flex flex-col gap-sm">
      <div className="flex items-center justify-between px-1">
        <span className="text-caption uppercase text-text-muted">Did you know</span>
        <span className="text-caption text-text-faint">
          {activeIdx + 1} / {facts.length}
        </span>
      </div>

      <div
        ref={scrollerRef}
        className="flex gap-md overflow-x-auto snap-x snap-mandatory scrollbar-hide -mx-lg px-lg pb-1"
        style={{ scrollbarWidth: 'none' }}
      >
        {facts.map((fact, idx) => (
          <div
            key={fact.id}
            data-fact-idx={idx}
            className="snap-start shrink-0 w-[min(360px,calc(100vw-32px))]"
          >
            <Card className="h-full flex flex-col gap-sm">
              <span className="text-caption uppercase text-text-muted">{fact.category}</span>
              <h3 className="text-h2 font-semibold text-text">{fact.headline}</h3>
              <p
                className="text-small text-text-muted"
                style={{
                  display: '-webkit-box',
                  WebkitLineClamp: 4,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {fact.body}
              </p>
              {fact.sourceUrl ? (
                <button
                  type="button"
                  onClick={() => window.open(fact.sourceUrl, '_blank', 'noopener,noreferrer')}
                  className="text-caption uppercase text-accent hover:opacity-80 self-start mt-auto cursor-pointer"
                >
                  {fact.source}
                </button>
              ) : (
                <span className="text-caption uppercase text-text-faint mt-auto">{fact.source}</span>
              )}
            </Card>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-center gap-1 pt-1" role="tablist">
        {facts.map((_, idx) => (
          <span
            key={idx}
            aria-current={idx === activeIdx}
            className={cn(
              'h-1.5 rounded-pill transition-all duration-300',
              idx === activeIdx ? 'w-5 bg-accent' : 'w-1.5 bg-border',
            )}
          />
        ))}
      </div>
    </section>
  );
}

export default FactsCarousel;
