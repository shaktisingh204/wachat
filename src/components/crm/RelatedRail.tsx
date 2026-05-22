'use client';

/**
 * <RelatedRail> — shared right-rail card showing live counts of related
 * entities, each clickable to navigate to a filtered list view (per
 * CRM_REBUILD_PLAN §5.6).
 *
 * Wraps the lower-level <EntityRelatedRail> with a simpler, count-
 * already-baked-in API for callers that just want to pass a flat
 * `items: { label, count, href, icon? }[]` array (typical case for
 * server-rendered detail pages that already resolved the counts).
 *
 * Wiring pattern (detail Server Component):
 *
 *   const counts = await getXxxRelatedCounts(id);
 *   <RelatedRail
 *     items={[
 *       { label: 'Deals',    count: counts.deals,    href: `/.../deals?xxxId=${id}`,    icon: <Handshake … /> },
 *       { label: 'Invoices', count: counts.invoices, href: `/.../invoices?xxxId=${id}`, icon: <Receipt   … /> },
 *       …
 *     ]}
 *   />
 *
 * Rendering: a <Card> with an "Related" heading and a list of
 * navigable rows (label + monospaced count). Empty (zero-length items)
 * collapses to `null`.
 */

import * as React from 'react';

import {
  EntityRelatedRail,
  type EntityRelatedRailItem,
} from '@/components/crm/entity-related-rail';

export interface RelatedRailItem {
  /** Display label, e.g. "Contacts". */
  label: string;
  /** Live count of related entities. */
  count: number;
  /** Click target — list view filtered by this entity id. */
  href: string;
  /** Optional Lucide (or any React) icon element. */
  icon?: React.ReactNode;
  /** Hide this item when count is 0. Defaults to false. */
  hideWhenZero?: boolean;
  /** Tone override for the count badge. */
  tone?: 'default' | 'success' | 'warning' | 'danger';
}

export interface RelatedRailProps {
  /** Card heading. Defaults to "Related". */
  title?: string;
  /** The items to render. */
  items: RelatedRailItem[];
  /** Optional className passed through to the outer card. */
  className?: string;
}

export function RelatedRail({ title = 'Related', items, className }: RelatedRailProps) {
  if (!items || items.length === 0) return null;

  // Bridge to the lower-level component: synthesise stable keys and
  // hand over `initial` counts already merged.
  const keys = React.useMemo(
    () => items.map((_, i) => `item-${i}` as const),
    [items],
  );

  const initial: Record<string, number> = React.useMemo(() => {
    const out: Record<string, number> = {};
    items.forEach((it, i) => {
      out[`item-${i}`] = it.count ?? 0;
    });
    return out;
  }, [items]);

  const railItems: EntityRelatedRailItem<string>[] = React.useMemo(
    () =>
      items.map((it, i) => ({
        key: `item-${i}`,
        label: it.label,
        icon: it.icon,
        href: it.href,
        hideWhenZero: it.hideWhenZero,
        tone: it.tone,
      })),
    [items],
  );

  // Suppress an unused-var hint when keys aren't otherwise consumed.
  void keys;

  return (
    <EntityRelatedRail<string>
      title={title}
      initial={initial}
      items={railItems}
      className={className}
    />
  );
}
