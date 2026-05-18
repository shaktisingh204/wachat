'use client';

import {
  ZoruBreadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  ZoruButton,
  ZoruCard,
  useZoruToast,
} from '@/components/zoruui';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition } from 'react';
import { useProject } from '@/context/project-context';

import * as React from 'react';

import { Loader, Package, RefreshCw, Store } from 'lucide-react';

interface InstalledAppRow {
    installId: string;
    appId: string;
    name: string;
    version: string;
    status: 'pending' | 'active' | 'suspended' | 'uninstalled';
    iconUrl?: string;
    pricingType: 'free' | 'one-time' | 'subscription' | 'usage';
    lifetimeUnits: number;
    usageSeries: Array<{ date: string; units: number }>;
}

interface ApiResponse {
    installs: InstalledAppRow[];
}

export default function InstalledMarketplaceAppsPage(): React.JSX.Element {
    const { activeProject } = useProject();
    const { toast } = useZoruToast();
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
        <div className="flex min-h-full flex-col gap-6">
            <ZoruBreadcrumb>
                <ZoruBreadcrumbList>
                    <ZoruBreadcrumbItem>
                        <ZoruBreadcrumbLink href="/dashboard">Dashboard</ZoruBreadcrumbLink>
                    </ZoruBreadcrumbItem>
                    <ZoruBreadcrumbSeparator />
                    <ZoruBreadcrumbItem>
                        <ZoruBreadcrumbLink href="/dashboard/marketplace">Marketplace</ZoruBreadcrumbLink>
                    </ZoruBreadcrumbItem>
                    <ZoruBreadcrumbSeparator />
                    <ZoruBreadcrumbItem>
                        <ZoruBreadcrumbPage>Installed Apps</ZoruBreadcrumbPage>
                    </ZoruBreadcrumbItem>
                </ZoruBreadcrumbList>
            </ZoruBreadcrumb>

            <header className="flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl text-zoru-ink">Installed Apps</h1>
                    <p className="mt-1 text-sm text-zoru-ink-muted">
                        Apps your workspace has connected, with the last 30 days of usage.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <ZoruButton variant="ghost" onClick={fetchRows} disabled={isLoading}>
                        <RefreshCw className={isLoading ? 'mr-2 h-4 w-4 animate-spin' : 'mr-2 h-4 w-4'} />
                        Refresh
                    </ZoruButton>
                    <ZoruButton
                        onClick={() => {
                            window.location.assign('/dashboard/marketplace');
                        }}
                    >
                        <Store className="mr-2 h-4 w-4" />
                        Browse Marketplace
                    </ZoruButton>
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

function InstalledAppCard({ row }: { row: InstalledAppRow }): React.JSX.Element {
    const total = useMemo(
        () => row.usageSeries.reduce((sum, p) => sum + p.units, 0),
        [row.usageSeries],
    );

    return (
        <ZoruCard className="flex flex-col gap-4 p-5">
            <header className="flex items-start gap-3">
                <div
                    aria-hidden="true"
                    className="flex h-10 w-10 items-center justify-center rounded-xl bg-zoru-surface-2 text-zoru-ink"
                >
                    {row.iconUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={row.iconUrl} alt="" className="h-8 w-8 rounded-lg" />
                    ) : (
                        <Package className="h-5 w-5" />
                    )}
                </div>
                <div className="flex-1">
                    <h2 className="text-base text-zoru-ink">{row.name}</h2>
                    <p className="text-xs text-zoru-ink-muted">
                        v{row.version} · {row.pricingType}
                    </p>
                </div>
                <StatusPill status={row.status} />
            </header>

            <UsageSparkline series={row.usageSeries} />

            <footer className="flex items-baseline justify-between text-xs text-zoru-ink-muted">
                <span>30-day usage</span>
                <span className="font-mono text-sm text-zoru-ink">{total.toLocaleString()} units</span>
            </footer>
            <p className="text-[11px] uppercase tracking-wider text-zoru-ink-muted">
                Lifetime: {row.lifetimeUnits.toLocaleString()} units
            </p>
        </ZoruCard>
    );
}

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
            <div className="flex h-16 items-center justify-center rounded-lg bg-zoru-surface-2 text-xs text-zoru-ink-muted">
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
            className="h-16 w-full text-zoru-ink"
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
        active: 'bg-zoru-success/10 text-zoru-success',
        pending: 'bg-zoru-warning/10 text-zoru-warning',
        suspended: 'bg-zoru-danger/10 text-zoru-danger-ink',
        uninstalled: 'bg-zoru-surface-2 text-zoru-ink-muted',
    };
    return (
        <span
            className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide ${styles[status]}`}
        >
            {status}
        </span>
    );
}

function LoadingPanel(): React.JSX.Element {
    return (
        <div className="flex min-h-[240px] items-center justify-center">
            <Loader className="h-6 w-6 animate-spin text-zoru-ink-muted" />
        </div>
    );
}

function EmptyPanel(): React.JSX.Element {
    return (
        <ZoruCard className="flex min-h-[240px] flex-col items-center justify-center gap-2 p-8 text-center">
            <Store className="h-8 w-8 text-zoru-ink-muted" />
            <h2 className="text-base text-zoru-ink">No apps installed yet</h2>
            <p className="max-w-md text-sm text-zoru-ink-muted">
                Browse the marketplace to extend your workspace with first- and third-party apps.
            </p>
            <ZoruButton
                className="mt-2"
                onClick={() => {
                    window.location.assign('/dashboard/marketplace');
                }}
            >
                Browse Marketplace
            </ZoruButton>
        </ZoruCard>
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
        <ZoruCard className="flex min-h-[160px] flex-col items-center justify-center gap-3 p-6 text-center">
            <p className="text-sm text-zoru-ink">Couldn&apos;t load installed apps.</p>
            <p className="font-mono text-xs text-zoru-ink-muted">{message}</p>
            <ZoruButton variant="ghost" onClick={onRetry}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Retry
            </ZoruButton>
        </ZoruCard>
    );
}
