'use client';

import * as React from 'react';
import Link from 'next/link';
import { ChevronLeft, Download, RefreshCw, FileSpreadsheet, FileText } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import type { DateRange } from 'react-day-picker';

import {
    Button,
    Card,
    ZoruDateRangePicker,
    DropdownMenu,
    ZoruDropdownMenuTrigger,
    ZoruDropdownMenuContent,
    ZoruDropdownMenuItem,
} from '@/components/zoruui';
import { EntityListShell } from '@/components/crm/entity-list-shell';

/**
 * <ReportShell /> — reusable shell for the 22 CRM sub-report pages.
 *
 * Composition:
 *   EntityListShell page chrome
 *     ↳ back link + sticky toolbar (date range, refresh, export dropdown)
 *     ↳ optional filters row
 *     ↳ optional KPI strip (full width)
 *     ↳ optional chart (wrapped in ZoruCard)
 *     ↳ optional table (wrapped in ZoruCard)
 *     ↳ optional pagination
 *
 * Sibling helper:
 *   <ReportKpiStrip cards={[{label, value, hint, icon, tone}, ...]} />
 *
 * All slots are optional — render only what the report needs.
 */

export interface ReportShellBackLink {
    href: string;
    label: string;
}

export interface ReportShellProps {
    title: string;
    subtitle?: string;
    back?: ReportShellBackLink;
    dateRange?: DateRange | undefined;
    onDateRangeChange?: (range: DateRange | undefined) => void;
    onRefresh?: () => void;
    refreshing?: boolean;
    onExportCsv?: () => void;
    onExportXlsx?: () => void;
    onExportPdf?: () => void;
    filters?: React.ReactNode;
    kpis?: React.ReactNode;
    chart?: React.ReactNode;
    table?: React.ReactNode;
    pagination?: React.ReactNode;
    /** Additional right-aligned toolbar slot (e.g., view switcher). */
    toolbarExtra?: React.ReactNode;
    /** Override the auto-generated body. Power-users only. */
    children?: React.ReactNode;
}

export function ReportShell({
    title,
    subtitle,
    back,
    dateRange,
    onDateRangeChange,
    onRefresh,
    refreshing,
    onExportCsv,
    onExportXlsx,
    onExportPdf,
    filters,
    kpis,
    chart,
    table,
    pagination,
    toolbarExtra,
    children,
}: ReportShellProps): React.JSX.Element {
    const hasAnyExport = Boolean(onExportCsv || onExportXlsx || onExportPdf);

    const toolbar = (
        <div className="flex flex-wrap items-center gap-2">
            {onDateRangeChange ? (
                <div className="w-full sm:w-auto sm:min-w-[260px]">
                    <ZoruDateRangePicker value={dateRange} onChange={onDateRangeChange} />
                </div>
            ) : null}
            {toolbarExtra}
            {onRefresh ? (
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={onRefresh}
                    disabled={refreshing}
                    aria-label="Refresh report"
                >
                    <RefreshCw
                        className={refreshing ? 'h-4 w-4 animate-spin' : 'h-4 w-4'}
                        strokeWidth={1.75}
                        aria-hidden="true"
                    />
                    <span className="ml-1.5">Refresh</span>
                </Button>
            ) : null}
            {hasAnyExport ? (
                <DropdownMenu>
                    <ZoruDropdownMenuTrigger asChild>
                        <Button type="button" variant="outline" size="sm">
                            <Download className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                            <span className="ml-1.5">Export</span>
                        </Button>
                    </ZoruDropdownMenuTrigger>
                    <ZoruDropdownMenuContent align="end">
                        {onExportCsv ? (
                            <ZoruDropdownMenuItem onSelect={onExportCsv}>
                                <FileText className="mr-2 h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                                Export CSV
                            </ZoruDropdownMenuItem>
                        ) : null}
                        {onExportXlsx ? (
                            <ZoruDropdownMenuItem onSelect={onExportXlsx}>
                                <FileSpreadsheet className="mr-2 h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                                Export XLSX
                            </ZoruDropdownMenuItem>
                        ) : null}
                        {onExportPdf ? (
                            <ZoruDropdownMenuItem onSelect={onExportPdf}>
                                <FileText className="mr-2 h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                                Export PDF
                            </ZoruDropdownMenuItem>
                        ) : null}
                    </ZoruDropdownMenuContent>
                </DropdownMenu>
            ) : null}
        </div>
    );

    return (
        <EntityListShell
            title={title}
            subtitle={subtitle}
            primaryAction={toolbar}
            filters={filters}
        >
            {back ? (
                <div className="-mt-2">
                    <Link
                        href={back.href}
                        className="inline-flex items-center gap-1 text-[12.5px] text-zoru-ink-muted hover:text-zoru-ink"
                    >
                        <ChevronLeft className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
                        {back.label}
                    </Link>
                </div>
            ) : null}

            {children ?? (
                <div className="flex flex-col gap-4">
                    {kpis ? <div>{kpis}</div> : null}
                    {chart ? <Card className="p-4">{chart}</Card> : null}
                    {table ? <Card className="p-0 overflow-hidden">{table}</Card> : null}
                    {pagination ? <div>{pagination}</div> : null}
                </div>
            )}
        </EntityListShell>
    );
}

/* ────────────────────────────────────────────────────────────────────────
 * <ReportKpiStrip /> — 3-4 stat-card pattern shared across sub-reports.
 * ──────────────────────────────────────────────────────────────────────── */

export type ReportKpiTone = 'default' | 'success' | 'warning' | 'danger';

export interface ReportKpiCard {
    label: string;
    value: string | number;
    hint?: string;
    /**
     * Either a lucide component (when rendered by a client component) or a
     * string name (when passed across the RSC boundary from a Server
     * Component — function values are non-serializable and would crash the
     * server render). Names resolve via the lucide barrel.
     */
    icon?: React.ElementType;
    iconName?: string;
    tone?: ReportKpiTone;
}

function resolveKpiIcon(card: ReportKpiCard): React.ElementType | undefined {
    if (card.icon) return card.icon;
    if (card.iconName) {
        const found = (LucideIcons as Record<string, unknown>)[card.iconName];
        if (typeof found === 'function' || (found && typeof found === 'object')) {
            return found as React.ElementType;
        }
    }
    return undefined;
}

const reportKpiToneClass: Record<ReportKpiTone, string> = {
    default: 'bg-zoru-surface-2 text-zoru-ink',
    success: 'bg-zoru-success/10 text-zoru-success-ink',
    warning: 'bg-zoru-warning/15 text-zoru-warning-ink',
    danger: 'bg-zoru-danger/10 text-zoru-danger-ink',
};

export function ReportKpiStrip({ cards }: { cards: ReportKpiCard[] }): React.JSX.Element {
    return (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {cards.map((card) => {
                const Icon = resolveKpiIcon(card);
                const tone = card.tone ?? 'default';
                return (
                    <Card key={card.label} className="h-full p-5">
                        <div className="flex items-start justify-between gap-3">
                            <p className="text-[12px] font-medium uppercase tracking-wide text-zoru-ink-subtle">
                                {card.label}
                            </p>
                            {Icon ? (
                                <span
                                    className={`flex h-8 w-8 items-center justify-center rounded-[var(--zoru-radius-sm)] ${reportKpiToneClass[tone]}`}
                                >
                                    <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                                </span>
                            ) : null}
                        </div>
                        <p className="mt-3 text-[24px] font-semibold leading-none tracking-tight text-zoru-ink">
                            {card.value}
                        </p>
                        {card.hint ? (
                            <p className="mt-2 text-[12px] text-zoru-ink-muted">{card.hint}</p>
                        ) : null}
                    </Card>
                );
            })}
        </div>
    );
}
