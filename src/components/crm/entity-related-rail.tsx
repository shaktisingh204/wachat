'use client';

import { Card } from '@/components/sabcrm/20ui';
/**
 * <EntityRelatedRail> — generic right-rail "Related" card.
 *
 * Replaces the N per-entity copies (invoice-related-rail, bill-related-
 * rail, purchase-order-related-rail, contract-related-rail, …) with one
 * shared component. Per-entity wiring is now:
 *
 *   <EntityRelatedRail
 *     initial={initialCountsObject}
 *     refresh={() => getXxxRelatedCounts(id)}
 *     items={[
 *       { key: 'receipts', label: 'Payment receipts', icon: <FileCheck …/>, href: `/…?invoiceId=${id}` },
 *       …
 *     ]}
 *   />
 *
 * The component owns: hydrate-from-server, re-fetch-on-mount, render
 * card, hover/click affordances. Items are entirely caller-supplied —
 * no hardcoded entity knowledge.
 */

import * as React from 'react';
import Link from 'next/link';

export interface EntityRelatedRailItem<TKey extends string = string> {
  /** Key into the `counts` record. */
  key: TKey;
  /** Display label. */
  label: string;
  /** Optional Lucide (or any React) icon element. */
  icon?: React.ReactNode;
  /** Click target. Click is a no-op when omitted. */
  href?: string;
  /** Hide this item when the count is 0. Defaults to false. */
  hideWhenZero?: boolean;
  /** Tone override for the count badge (e.g. amber for "open"). */
  tone?: 'default' | 'success' | 'warning' | 'danger';
}

export interface EntityRelatedRailProps<TKey extends string = string> {
  /** Card heading. Defaults to "Related". */
  title?: string;
  /** Server-rendered initial counts. */
  initial: Record<TKey, number>;
  /** Optional async refresher invoked on mount. */
  refresh?: () => Promise<Record<TKey, number>>;
  items: EntityRelatedRailItem<TKey>[];
  /** Optional className passed through to the outer Card. */
  className?: string;
}

const TONE_CLASS: Record<NonNullable<EntityRelatedRailItem['tone']>, string> = {
  default: 'text-[var(--st-text-secondary)]',
  success: 'text-[var(--st-status-ok)]',
  warning: 'text-[var(--st-warn)]',
  danger: 'text-[var(--st-danger)]',
};

export function EntityRelatedRail<TKey extends string = string>({
  title = 'Related',
  initial,
  refresh,
  items,
  className,
}: EntityRelatedRailProps<TKey>) {
  const [counts, setCounts] = React.useState<Record<TKey, number>>(initial);

  React.useEffect(() => {
    if (!refresh) return;
    let cancelled = false;
    refresh()
      .then((next) => {
        if (!cancelled) setCounts(next);
      })
      .catch(() => {
        /* keep the server-rendered initial values on error */
      });
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  const visibleItems = items.filter((item) => {
    if (!item.hideWhenZero) return true;
    return (counts[item.key] ?? 0) > 0;
  });

  if (visibleItems.length === 0) return null;

  return (
    <Card className={`p-4 ${className ?? ''}`}>
      <h3 className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
        {title}
      </h3>
      <ul className="space-y-1.5 text-[12.5px]">
        {visibleItems.map((item) => {
          const count = counts[item.key] ?? 0;
          const tone = TONE_CLASS[item.tone ?? 'default'];
          const body = (
            <>
              <span className="inline-flex items-center gap-1.5 text-[var(--st-text)]">
                {item.icon ? (
                  <span className="text-[var(--st-text-secondary)]">{item.icon}</span>
                ) : null}
                {item.label}
              </span>
              <span className={`font-mono tabular-nums ${tone}`}>{count}</span>
            </>
          );
          return (
            <li key={item.key}>
              {item.href ? (
                <Link
                  href={item.href}
                  className="flex items-center justify-between gap-2 rounded px-1.5 py-1 text-[var(--st-text)] hover:bg-[var(--st-bg-muted)]"
                >
                  {body}
                </Link>
              ) : (
                <div className="flex items-center justify-between gap-2 rounded px-1.5 py-1 text-[var(--st-text)]">
                  {body}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
