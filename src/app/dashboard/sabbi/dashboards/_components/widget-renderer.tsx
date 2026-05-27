'use client';

/**
 * §6.5 Widget renderer.
 *
 * Pure presentation: given a widget config + the rows resolved
 * server-side by `resolveWidgetData`, render the right visual.
 * Used both inside the read-only detail page and the editor preview.
 *
 * Charts use `recharts` (already an installed dep — see
 * `src/components/zoruui/chart.tsx`). The `funnel` kind uses
 * inline SVG / divs since recharts' FunnelChart is overkill for
 * the basic stacked-bar look this MVP needs.
 */

import * as React from 'react';
import dynamic from 'next/dynamic';
import { LoaderCircle } from 'lucide-react';
import type { DashboardWidget, ResolvedWidgetData } from '@/app/actions/crm-dashboards.actions.types';

const CHART_COLORS = ['#5b8def', '#f0a26b', '#7ec77d', '#d97cc4', '#f0d36b', '#6bccd6'];

const WidgetLoader = () => (
    <div className="flex h-full w-full items-center justify-center">
        <LoaderCircle className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
);

const LineWidget = dynamic(() => import('./chart-widgets').then(mod => mod.LineWidget), {
    ssr: false,
    loading: WidgetLoader,
});

const BarWidget = dynamic(() => import('./chart-widgets').then(mod => mod.BarWidget), {
    ssr: false,
    loading: WidgetLoader,
});

const DonutWidget = dynamic(() => import('./chart-widgets').then(mod => mod.DonutWidget), {
    ssr: false,
    loading: WidgetLoader,
});

export interface WidgetRendererProps {
    widget: DashboardWidget;
    data: ResolvedWidgetData;
}

export function WidgetRenderer({ widget, data }: WidgetRendererProps) {
    if (data.error) {
        return (
            <div className="flex h-full flex-col items-center justify-center rounded-md border border-dashed border-zoru-line p-4 text-center">
                <p className="text-[12.5px] text-zoru-danger-ink">{data.error}</p>
            </div>
        );
    }

    if (data.note && (!data.rows || data.rows.length === 0)) {
        return (
            <div className="flex h-full flex-col items-center justify-center rounded-md border border-dashed border-zoru-line p-4 text-center">
                <p className="text-[12.5px] text-zoru-ink-muted">{data.note}</p>
            </div>
        );
    }

    switch (widget.kind) {
        case 'metric':
            return <MetricWidget widget={widget} data={data} />;
        case 'line':
            return <LineWidget widget={widget} data={data} />;
        case 'bar':
            return <BarWidget widget={widget} data={data} />;
        case 'donut':
            return <DonutWidget widget={widget} data={data} />;
        case 'funnel':
            return <FunnelWidget widget={widget} data={data} />;
        case 'table':
            return <TableWidget widget={widget} data={data} />;
        default:
            return (
                <div className="flex h-full items-center justify-center text-[12.5px] text-zoru-ink-muted">
                    Unsupported widget kind: {String((widget as DashboardWidget).kind)}
                </div>
            );
    }
}

/* ----- metric ----------------------------------------------------- */

function MetricWidget({ widget, data }: WidgetRendererProps) {
    const cfg = (widget.config ?? {}) as { valueKey?: string; deltaKey?: string };
    const row = data.rows[0] ?? {};
    const valueKey = cfg.valueKey || 'value';
    const deltaKey = cfg.deltaKey || 'delta';
    const value = row[valueKey];
    const delta = row[deltaKey];
    const deltaNum = typeof delta === 'number' ? delta : undefined;

    return (
        <div className="flex h-full flex-col justify-center px-4 py-2">
            <div className="text-[11px] uppercase tracking-wide text-zoru-ink-muted">
                {row.label || widget.title}
            </div>
            <div className="mt-1 text-[28px] font-semibold text-zoru-ink">
                {value === undefined || value === null ? '—' : String(value)}
            </div>
            {deltaNum !== undefined ? (
                <div
                    className={`mt-0.5 text-[12px] ${
                        deltaNum >= 0 ? 'text-zoru-success-ink' : 'text-zoru-danger-ink'
                    }`}
                >
                    {deltaNum >= 0 ? '+' : ''}
                    {deltaNum}% vs prior period
                </div>
            ) : null}
        </div>
    );
}



/* ----- funnel ----------------------------------------------------- */

function FunnelWidget({ widget, data }: WidgetRendererProps) {
    const cfg = (widget.config ?? {}) as { nameKey?: string; valueKey?: string };
    const nameKey = cfg.nameKey || 'label';
    const valueKey = cfg.valueKey || 'value';
    const rows = data.rows.slice(0, 10);
    const max = rows.reduce(
        (acc, r) => Math.max(acc, Number(r[valueKey]) || 0),
        0,
    );
    if (rows.length === 0 || max === 0) {
        return (
            <div className="flex h-full items-center justify-center text-[12.5px] text-zoru-ink-muted">
                No funnel data.
            </div>
        );
    }
    return (
        <div className="flex h-full flex-col gap-1.5 overflow-y-auto p-3">
            {rows.map((row, i) => {
                const v = Number(row[valueKey]) || 0;
                const pct = Math.max(2, Math.round((v / max) * 100));
                return (
                    <div key={i} className="flex items-center gap-2">
                        <div className="w-24 shrink-0 truncate text-[11.5px] text-zoru-ink-muted">
                            {String(row[nameKey] ?? '—')}
                        </div>
                        <div className="relative h-5 flex-1 overflow-hidden rounded bg-zoru-surface-2">
                            <div
                                className="h-full rounded"
                                style={{
                                    width: `${pct}%`,
                                    background: CHART_COLORS[i % CHART_COLORS.length],
                                }}
                            />
                        </div>
                        <div className="w-12 shrink-0 text-right text-[11.5px] text-zoru-ink">
                            {v}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

/* ----- table ------------------------------------------------------ */

function TableWidget({ data }: WidgetRendererProps) {
    const rows = data.rows.slice(0, 10);
    if (rows.length === 0) {
        return (
            <div className="flex h-full items-center justify-center text-[12.5px] text-zoru-ink-muted">
                No rows.
            </div>
        );
    }
    const headers = Array.from(
        new Set(rows.flatMap((r) => (r && typeof r === 'object' ? Object.keys(r) : []))),
    ).slice(0, 6);
    return (
        <div className="h-full overflow-auto">
            <table className="w-full border-collapse text-[12px]">
                <thead className="sticky top-0 bg-zoru-surface-2 text-zoru-ink-muted">
                    <tr>
                        {headers.map((h) => (
                            <th key={h} className="border-b border-zoru-line px-3 py-1.5 text-left font-medium">
                                {h}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row, i) => (
                        <tr key={i} className="border-b border-zoru-line/60">
                            {headers.map((h) => (
                                <td key={h} className="px-3 py-1.5 text-zoru-ink">
                                    {formatCell(row[h])}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function formatCell(value: unknown): string {
    if (value === null || value === undefined) return '—';
    if (typeof value === 'object') {
        try {
            return JSON.stringify(value).slice(0, 80);
        } catch {
            return '[object]';
        }
    }
    return String(value);
}
