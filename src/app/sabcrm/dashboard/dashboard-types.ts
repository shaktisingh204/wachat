/**
 * SabCRM saved-dashboard — shared client types.
 *
 * Mirrors the contract of `@/app/actions/sabcrm-dashboards.actions`:
 *   dashboard = { id, name, widgets:[{ id, type, title, config }] }
 *
 * Kept in a plain (non-"use server", non-"use client") module so both the page
 * shell and the widget renderer can import the shapes without pulling server
 * code into the client bundle.
 */

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

export interface DashboardWidgetTw {
  id: string;
  type: WidgetTypeTw;
  title: string;
  config?: Record<string, unknown>;
}

export interface DashboardTw {
  id: string;
  name: string;
  widgets: DashboardWidgetTw[];
}

/* -------------------------------------------------------------------------- */
/* Adapters — the Rust engine returns wider shapes (`type: string`,            */
/* `config: unknown`, plus tenant/timestamp fields). These normalise its      */
/* widgets/dashboards into the narrowed client shapes used for rendering, and  */
/* widen them back into the wire shape expected by create/update.             */
/* -------------------------------------------------------------------------- */

/** Minimal structural mirror of `SabcrmRustWidget` (avoids a server import). */
interface RustWidgetLike {
  id: string;
  type: string;
  title: string;
  config?: unknown;
}

/** Minimal structural mirror of `SabcrmRustDashboard`. */
interface RustDashboardLike {
  id: string;
  name: string;
  widgets?: RustWidgetLike[] | null;
}

function isWidgetType(t: string): t is WidgetTypeTw {
  return (WIDGET_TYPES as readonly string[]).includes(t);
}

/** Narrow one wire widget into a renderable `DashboardWidgetTw`. */
export function normalizeWidget(w: RustWidgetLike): DashboardWidgetTw {
  return {
    id: w.id,
    type: isWidgetType(w.type) ? w.type : 'kpi',
    title: w.title,
    config:
      w.config && typeof w.config === 'object' && !Array.isArray(w.config)
        ? (w.config as Record<string, unknown>)
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
