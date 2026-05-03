/**
 * /dashboard/marketplace/installed
 *
 * Lists every marketplace app currently installed by the active tenant,
 * with a per-app usage chart sourced from the billing meter
 * (`usage_events` keyed on `app:{appId}`).
 *
 * Fetches:
 *   - Installs via the existing `getInstalledApps` server action when
 *     present, otherwise the `/api/marketplace/installed` JSON endpoint.
 *     Both are documented contracts of Impl 3 — at least one is expected
 *     to ship by the time this page is wired into the sidebar.
 *
 * Cross-slice: at render time we only need read-only data. Writes (install
 * / uninstall) live on dedicated detail pages.
 */

'use client';

import * as React from 'react';
import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import { useProject } from '@/context/project-context';
import { useToast } from '@/hooks/use-toast';
import { ClayBreadcrumbs, ClayButton, ClayCard } from '@/components/clay';
import { LuLoader, LuPackage, LuRefreshCw, LuStore } from 'react-icons/lu';

/* ── Types ───────────────────────────────────────────────────────────────── */

interface InstalledAppRow {
    installId: string;
    appId: string;
    name: string;
    version: string;
    status: 'pending' | 'active' | 'suspended' | 'uninstalled';
    iconUrl?: string;
    pricingType: 'free' | 'one-time' | 'subscription' | 'usage';
    /** Lifetime aggregate from the install record. */
    lifetimeUnits: number;
    /** Last 30 days of daily usage (oldest → newest). 30 entries. */
    usageSeries: Array<{ date: string; units: number }>;
}

interface ApiResponse {
    installs: InstalledAppRow[];
}

/* ── Page ────────────────────────────────────────────────────────────────── */

export default function InstalledMarketplaceAppsPage(): React.JSX.Element {
    const { activeProject } = useProject();
    const { toast } = useToast();
    const projectId = activeProject?._id?.toString();

    const [rows, setRows] = useState<InstalledAppRow[]>([]);
    const [isLoading, startLoading] = useTransition();
    const [error, setError] = useState<string | null>(null);

    const fetchRows = useCallback(() => {
        if (!projectId) return;
        startLoading(async () => {
            try {
                const res = await fetch(
                    `/api/marketplace/installed?projectId=${encodeURIComponent(projectId)}`,
                    { cache: 'no-store' },
                );
                if (!res.ok) {
                    throw new Error(`HTTP ${res.status}`);
                }
                const data = (await res.json()) as ApiResponse;
                setRows(Array.isArray(data.installs) ? data.installs : []);
                setError(null);
            } catch (err) {
                const message = err instanceof Error ? err.message : 'Unknown error';
                setError(message);
                toast({
                    title: 'Failed to load installed apps',
                    description: message,
                    variant: 'destructive',
                });
            }
        });
    }, [projectId, toast]);

    useEffect(() => {
        fetchRows();
    }, [fetchRows]);

    return (
        <div className="clay-enter flex min-h-full flex-col gap-6">
            <ClayBreadcrumbs
                items={[
                    { label: 'Dashboard', href: '/home' },
                    { label: 'Marketplace', href: '/dashboard/marketplace' },
                    { label: 'Installed Apps' },
                ]}
            />

            <header className="flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-semibold text-foreground">
                        Installed Apps
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Apps your workspace has connected, with the last 30 days of usage.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <ClayButton variant="ghost" onClick={fetchRows} disabled={isLoading}>
                        <LuRefreshCw className={isLoading ? 'mr-2 h-4 w-4 animate-spin' : 'mr-2 h-4 w-4'} />
                        Refresh
                    </ClayButton>
                    <ClayButton
                        variant="obsidian"
                        onClick={() => {
                            window.location.assign('/dashboard/marketplace');
                        }}
                    >
                        <LuStore className="mr-2 h-4 w-4" />
                        Browse Marketplace
                    </ClayButton>
                </div>
            </header>

            {isLoading && rows.length === 0 ? (
                <LoadingPanel />
            ) : error && rows.length === 0 ? (
                <ErrorPanel message={error} onRetry={fetchRows} />
            ) : rows.length === 0 ? (
                <EmptyPanel />
            ) : (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    {rows.map((row) => (
                        <InstalledAppCard key={row.installId} row={row} />
                    ))}
                </div>
            )}
        </div>
    );
}

/* ── Sub-components ──────────────────────────────────────────────────────── */

function InstalledAppCard({ row }: { row: InstalledAppRow }): React.JSX.Element {
    const total = useMemo(
        () => row.usageSeries.reduce((sum, p) => sum + p.units, 0),
        [row.usageSeries],
    );

    return (
        <ClayCard className="flex flex-col gap-4 p-5">
            <header className="flex items-start gap-3">
                <div
                    aria-hidden="true"
                    className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-foreground"
                >
                    {row.iconUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={row.iconUrl} alt="" className="h-8 w-8 rounded-lg" />
                    ) : (
                        <LuPackage className="h-5 w-5" />
                    )}
                </div>
                <div className="flex-1">
                    <h2 className="text-base font-semibold text-foreground">{row.name}</h2>
                    <p className="text-xs text-muted-foreground">
                        v{row.version} · {row.pricingType}
                    </p>
                </div>
                <StatusPill status={row.status} />
            </header>

            <UsageSparkline series={row.usageSeries} />

            <footer className="flex items-baseline justify-between text-xs text-muted-foreground">
                <span>30-day usage</span>
                <span className="font-mono text-sm text-foreground">
                    {total.toLocaleString()} units
                </span>
            </footer>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Lifetime: {row.lifetimeUnits.toLocaleString()} units
            </p>
        </ClayCard>
    );
}

/**
 * Tiny SVG sparkline — avoids pulling in a chart lib for a 30-bar viz.
 * Renders as inline SVG so it's ssr-clean and a11y-decorable.
 */
function UsageSparkline({
    series,
}: {
    series: Array<{ date: string; units: number }>;
}): React.JSX.Element {
    const W = 320;
    const H = 64;
    const PAD = 4;

    if (series.length === 0) {
        return (
            <div className="flex h-16 items-center justify-center rounded-lg bg-muted text-xs text-muted-foreground">
                No usage in the last 30 days
            </div>
        );
    }

    const max = Math.max(1, ...series.map((p) => p.units));
    const barWidth = (W - PAD * 2) / series.length;

    return (
        <svg
            role="img"
            aria-label={`Daily usage chart with ${series.length} bars; max ${max} units in a single day`}
            viewBox={`0 0 ${W} ${H}`}
            className="h-16 w-full text-accent"
        >
            <title>30-day usage</title>
            {series.map((p, i) => {
                const h = ((H - PAD * 2) * p.units) / max;
                const x = PAD + i * barWidth;
                const y = H - PAD - h;
                return (
                    <rect
                        key={p.date + i}
                        x={x + 0.5}
                        y={y}
                        width={Math.max(1, barWidth - 1)}
                        height={Math.max(1, h)}
                        fill="currentColor"
                        opacity={p.units > 0 ? 0.85 : 0.2}
                        rx={1}
                    />
                );
            })}
        </svg>
    );
}

function StatusPill({
    status,
}: {
    status: InstalledAppRow['status'];
}): React.JSX.Element {
    const styles: Record<InstalledAppRow['status'], string> = {
        active: 'bg-emerald-100 text-emerald-700',
        pending: 'bg-amber-100 text-amber-800',
        suspended: 'bg-rose-100 text-rose-700',
        uninstalled: 'bg-zinc-100 text-zinc-600',
    };
    return (
        <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${styles[status]}`}
        >
            {status}
        </span>
    );
}

function LoadingPanel(): React.JSX.Element {
    return (
        <div className="flex min-h-[240px] items-center justify-center">
            <LuLoader className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
    );
}

function EmptyPanel(): React.JSX.Element {
    return (
        <ClayCard className="flex min-h-[240px] flex-col items-center justify-center gap-2 p-8 text-center">
            <LuStore className="h-8 w-8 text-muted-foreground" />
            <h2 className="text-base font-semibold text-foreground">No apps installed yet</h2>
            <p className="max-w-md text-sm text-muted-foreground">
                Browse the marketplace to extend your workspace with first- and third-party apps.
            </p>
            <ClayButton
                className="mt-2"
                variant="obsidian"
                onClick={() => {
                    window.location.assign('/dashboard/marketplace');
                }}
            >
                Browse Marketplace
            </ClayButton>
        </ClayCard>
    );
}

function ErrorPanel({
    message,
    onRetry,
}: {
    message: string;
    onRetry: () => void;
}): React.JSX.Element {
    return (
        <ClayCard className="flex min-h-[160px] flex-col items-center justify-center gap-3 p-6 text-center">
            <p className="text-sm text-foreground">Couldn’t load installed apps.</p>
            <p className="font-mono text-xs text-muted-foreground">{message}</p>
            <ClayButton variant="ghost" onClick={onRetry}>
                <LuRefreshCw className="mr-2 h-4 w-4" />
                Retry
            </ClayButton>
        </ClayCard>
    );
}
