/**
 * Types extracted from crm-dashboards.actions.ts
 * to avoid Turbopack 'use server' export restrictions.
 */

export type WidgetKind =
    | 'metric' | 'line' | 'bar' | 'donut' | 'funnel' | 'table';

export type WidgetDataSourceType = 'saved_view' | 'report' | 'metric_query';

export interface DashboardWidget {
    id: string;
    kind: WidgetKind;
    title: string;
    /** Layout grid coords. `w` is 1-12, `h` is 1-6. */
    x: number;
    y: number;
    w: number;
    h: number;
    dataSource: WidgetDataSource;
    /** Kind-specific configuration blob (axis keys, metric expression, …). */
    config?: Record<string, unknown>;
}

export interface ResolvedWidgetData {
    rows: any[];
    /** Optional human-readable note (e.g. "stub"). */
    note?: string;
    error?: string;
}
