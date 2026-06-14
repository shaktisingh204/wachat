'use client';

import type { BiChartRunResponse } from '@/lib/rust-client/bi-charts';
import type { BoardCard } from '@/lib/sabbi/boards.server';

import { ResultChart, type ResultChartType } from '@/app/dashboard/sabbi/_components/result-chart';

export function PublicBoard({
  name,
  description,
  cards,
}: {
  name: string;
  description?: string;
  cards: { card: BoardCard; result: BiChartRunResponse | null }[];
}) {
  return (
    <div className="20ui min-h-screen bg-[var(--st-bg)] p-[var(--st-space-5)]">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-[var(--st-text)]">{name}</h1>
        {description && <p className="text-sm text-[var(--st-text-secondary)]">{description}</p>}
      </header>

      <div className="grid grid-cols-1 gap-[var(--st-space-4)] md:grid-cols-12">
        {cards.map(({ card, result }, i) => {
          const span = Math.max(1, Math.min(card.w ?? 6, 12));
          return (
            <div
              key={card.id ?? i}
              style={{ gridColumn: `span ${span} / span ${span}` }}
              className="rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-surface)] p-4"
            >
              <h3 className="mb-2 truncate text-sm font-medium text-[var(--st-text)]">{card.title}</h3>
              {result ? (
                <ResultChart result={result} type={card.chartType as ResultChartType} height={240} />
              ) : (
                <div className="flex h-40 items-center justify-center text-sm text-[var(--st-text-secondary)]">
                  Unavailable
                </div>
              )}
            </div>
          );
        })}
      </div>

      <footer className="mt-8 text-center text-xs text-[var(--st-text-secondary)]">Powered by SabBI</footer>
    </div>
  );
}
