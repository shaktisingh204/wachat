'use client';

/**
 * Section toolbar for Rewards sub-pages. The module layout owns the single
 * page <header> + h1, so each section uses this lighter row instead: an
 * icon chip, an h2 title, a one-line description, and a right-aligned
 * actions slot. Keeps one logical heading order across the module.
 */

import * as React from 'react';
import type { LucideIcon } from 'lucide-react';

export function SectionToolbar({
  icon: Icon,
  title,
  description,
  actions,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-accent-soft)] text-[var(--st-accent)]"
        >
          <Icon size={18} />
        </span>
        <div className="flex flex-col gap-0.5">
          <h2 className="text-[15px] font-semibold leading-tight tracking-[-0.01em] text-[var(--st-text)]">
            {title}
          </h2>
          {description ? (
            <p className="max-w-prose text-[13px] leading-snug text-[var(--st-text-secondary)]">
              {description}
            </p>
          ) : null}
        </div>
      </div>
      {actions ? (
        <div role="group" className="flex flex-wrap items-center gap-2">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
