/**
 * SabCRM saved-dashboard — shared client types.
 *
 * Mirrors the contract of `@/app/actions/sabcrm-dashboards.actions`:
 *   dashboard = { id, name, widgets:[{ id, type, title, config }] }
 *
 * Kept in a plain (non-"use server", non-"use client") module so both the page
 * shell and the widget renderer can import the shapes without pulling server
 * code into the client bundle. The wire shapes are imported TYPE-ONLY from the
 * rust-client module (erased at compile time), so the narrow client types stay
 * structurally aligned with what the engine actually returns/accepts.
 */

import type {
  SabcrmRustDashboard,
  SabcrmRustWidget,
  SabcrmWidgetConfig,
} from '@/lib/rust-client/sabcrm-dashboards';

export type WidgetTypeTw = 'kpi' | 'bar' | 'recent' | 'pipeline';

export const WIDGET_TYPES: readonly WidgetTypeTw[] = [
  'kpi',
  'bar',
  'recent',
  'pipeline',
] as const;

export const WIDGET_TYPE_LABEL: Record<WidgetTypeTw, string> = {
  kpi: 'KPI metric',
  bar: 'Bar breakdown',
  recent: 'Recent records',
  pipeline: 'Pipeline summary',
};

/**
 * A renderable widget. Deliberately a `type` literal (not an `interface`) so it
 * receives an implicit index signature and stays assignable to the wire shape
 * `SabcrmRustWidget` (whose `[key: string]: unknown` index signature would
 * otherwise reject interface values) when persisting via update/create.
 */
export type DashboardWidgetTw = {
  id: string;
  type: WidgetTypeTw;
  title: string;
  /** Typed engine config blob — extra keys round-trip via its index signature. */
  config?: SabcrmWidgetConfig;
};

export interface DashboardTw {
  id: string;
  name: string;
  widgets: DashboardWidgetTw[];
}

/* -------------------------------------------------------------------------- */
/* Adapters — the Rust engine returns wider shapes (`type: string`, optional   */
/* `title`, plus tenant/timestamp fields). These normalise its widgets/        */
/* dashboards into the narrowed client shapes used for rendering; the client   */
/* shapes are assignable back to the wire shapes for create/update.            */
/* -------------------------------------------------------------------------- */

/**
 * Minimal structural slice of {@link SabcrmRustDashboard} accepted by
 * {@link normalizeDashboard} — tolerant of partially-hydrated list rows.
 */
export interface RustDashboardLike {
  id: string;
  name: string;
  widgets?: SabcrmRustWidget[] | null;
}

function isWidgetType(t: string): t is WidgetTypeTw {
  return (WIDGET_TYPES as readonly string[]).includes(t);
}

/** Narrow one wire widget into a renderable `DashboardWidgetTw`. */
export function normalizeWidget(w: SabcrmRustWidget): DashboardWidgetTw {
  return {
    id: w.id,
    type: isWidgetType(w.type) ? w.type : 'kpi',
    title: w.title ?? 'Untitled widget',
    config:
      w.config && typeof w.config === 'object' && !Array.isArray(w.config)
        ? w.config
        : undefined,
  };
}

/** Narrow one wire dashboard into a renderable `DashboardTw`. */
export function normalizeDashboard(d: RustDashboardLike): DashboardTw {
  return {
    id: d.id,
    name: d.name,
    widgets: (d.widgets ?? []).map(normalizeWidget),
  };
}

/** Re-exported wire types for callers that need them (type-only). */
export type { SabcrmRustDashboard, SabcrmRustWidget, SabcrmWidgetConfig };
