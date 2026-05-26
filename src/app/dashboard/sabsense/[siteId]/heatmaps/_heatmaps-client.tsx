'use client';

import React, { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Monitor, Smartphone, Tablet, RefreshCw } from 'lucide-react';

import {
    Button,
    Card,
    ZoruCardContent,
    ZoruCardHeader,
    ZoruCardTitle,
    ZoruCardDescription,
    Input,
    Label,
    PageHeader,
    ZoruPageTitle,
    ZoruPageDescription,
    ZoruPageActions,
    useZoruToast,
} from '@/components/zoruui';

import { regenerateHeatmapSnapshot } from '@/app/actions/pagesense.actions';
import type { PagesenseSite } from '@/lib/rust-client/pagesense-sites';
import type { HeatmapEventDoc } from '@/lib/rust-client/pagesense-heatmap-events';
import type { HeatmapSnapshot } from '@/lib/rust-client/pagesense-heatmaps';

import { PagesenseSiteNav } from '../_site-nav';

type DeviceKey = 'desktop' | 'tablet' | 'mobile';

const DEVICE_WIDTHS: Record<DeviceKey, number> = {
    desktop: 1280,
    tablet: 768,
    mobile: 375,
};

interface Props {
    site: PagesenseSite | null;
    initialUrl: string;
    initialDevice: DeviceKey;
    snapshots: HeatmapSnapshot[];
    clickEvents: HeatmapEventDoc[];
}

export function HeatmapsClient({
    site,
    initialUrl,
    initialDevice,
    snapshots,
    clickEvents,
}: Props) {
    const router = useRouter();
    const { toast } = useZoruToast();
    const [url, setUrl] = useState(initialUrl);
    const [device, setDevice] = useState<DeviceKey>(initialDevice);
    const [pending, startTransition] = useTransition();

    const width = DEVICE_WIDTHS[device];
    const totalClicks = clickEvents.length;

    // Pre-bucket clicks for a 40x60 grid so the heat overlay is fast.
    const grid = useMemo(() => {
        const cols = 40;
        const rows = 60;
        const cells = new Array<number>(cols * rows).fill(0);
        let max = 0;
        for (const ev of clickEvents) {
            const cx = Math.min(cols - 1, Math.max(0, Math.floor((ev.x / Math.max(1, ev.viewportW)) * cols)));
            const cy = Math.min(rows - 1, Math.max(0, Math.floor((ev.y / Math.max(1, ev.viewportH)) * rows)));
            const idx = cy * cols + cx;
            cells[idx] += 1;
            if (cells[idx] > max) max = cells[idx];
        }
        return { cols, rows, cells, max };
    }, [clickEvents]);

    const handleApplyUrl = () => {
        const params = new URLSearchParams();
        params.set('url', url);
        params.set('device', device);
        router.push(`?${params.toString()}`);
    };

    const handleRegenerate = () => {
        if (!site) return;
        const periodToMs = Date.now();
        const periodFromMs = periodToMs - 7 * 24 * 60 * 60 * 1000;
        startTransition(async () => {
            const res = await regenerateHeatmapSnapshot({
                siteId: site._id,
                url,
                periodFromMs,
                periodToMs,
            });
            if (res.success) {
                toast({ title: 'Snapshot regenerated', description: `Sample size: ${res.data?.sampleSize ?? 0}` });
                router.refresh();
            } else {
                toast({ title: 'Error', description: res.error, variant: 'destructive' });
            }
        });
    };

    if (!site) {
        return (
            <div className="zoruui p-8 text-sm text-[color:var(--zoru-fg-muted)]">
                Site not found.
            </div>
        );
    }

    return (
        <div className="zoruui p-8 space-y-6">
            <PageHeader>
                <ZoruPageTitle>{site.name} — Heatmaps</ZoruPageTitle>
                <ZoruPageDescription>
                    Click density overlay. Pick a URL and a device viewport.
                </ZoruPageDescription>
                <ZoruPageActions>
                    <Button onClick={handleRegenerate} disabled={pending}>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Regenerate snapshot
                    </Button>
                </ZoruPageActions>
            </PageHeader>

            <PagesenseSiteNav siteId={site._id} />

            <Card>
                <ZoruCardHeader>
                    <ZoruCardTitle>Filters</ZoruCardTitle>
                    <ZoruCardDescription>Page URL and device viewport.</ZoruCardDescription>
                </ZoruCardHeader>
                <ZoruCardContent>
                    <div className="grid gap-4 sm:grid-cols-[1fr_auto_auto]">
                        <div className="space-y-2">
                            <Label htmlFor="ps-url">URL path</Label>
                            <Input
                                id="ps-url"
                                value={url}
                                onChange={(e) => setUrl(e.target.value)}
                                placeholder="/"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Device</Label>
                            <div className="flex gap-2">
                                <Button
                                    size="sm"
                                    variant={device === 'desktop' ? 'default' : 'ghost'}
                                    onClick={() => setDevice('desktop')}
                                    aria-pressed={device === 'desktop'}
                                >
                                    <Monitor className="h-4 w-4" />
                                </Button>
                                <Button
                                    size="sm"
                                    variant={device === 'tablet' ? 'default' : 'ghost'}
                                    onClick={() => setDevice('tablet')}
                                    aria-pressed={device === 'tablet'}
                                >
                                    <Tablet className="h-4 w-4" />
                                </Button>
                                <Button
                                    size="sm"
                                    variant={device === 'mobile' ? 'default' : 'ghost'}
                                    onClick={() => setDevice('mobile')}
                                    aria-pressed={device === 'mobile'}
                                >
                                    <Smartphone className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>&nbsp;</Label>
                            <Button onClick={handleApplyUrl}>Apply</Button>
                        </div>
                    </div>
                </ZoruCardContent>
            </Card>

            <Card>
                <ZoruCardHeader>
                    <ZoruCardTitle>Click density</ZoruCardTitle>
                    <ZoruCardDescription>
                        {totalClicks} clicks · {snapshots.length} snapshot(s) on file.
                    </ZoruCardDescription>
                </ZoruCardHeader>
                <ZoruCardContent>
                    <div
                        className="relative mx-auto overflow-hidden rounded-md border border-[color:var(--zoru-border)] bg-[color:var(--zoru-surface-2)]"
                        style={{ width, aspectRatio: '4 / 3' }}
                    >
                        {/* Stub screenshot — TODO: real screenshot service. */}
                        {site.screenshotUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                                src={site.screenshotUrl}
                                alt="Page screenshot stub"
                                className="absolute inset-0 h-full w-full object-cover opacity-70"
                            />
                        ) : (
                            <div className="absolute inset-0 flex items-center justify-center text-xs text-[color:var(--zoru-fg-muted)]">
                                No screenshot yet — overlay shows click density on a blank canvas.
                            </div>
                        )}
                        {/* Heat overlay */}
                        <svg
                            className="absolute inset-0 h-full w-full"
                            viewBox={`0 0 ${grid.cols} ${grid.rows}`}
                            preserveAspectRatio="none"
                            aria-label="Click density grid"
                        >
                            {grid.cells.map((count, i) => {
                                if (count === 0) return null;
                                const x = i % grid.cols;
                                const y = Math.floor(i / grid.cols);
                                const intensity = grid.max > 0 ? count / grid.max : 0;
                                const hue = 60 - 60 * intensity; // yellow → red
                                return (
                                    <rect
                                        key={i}
                                        x={x}
                                        y={y}
                                        width={1}
                                        height={1}
                                        fill={`hsl(${hue} 100% 50% / ${0.15 + intensity * 0.55})`}
                                    />
                                );
                            })}
                        </svg>
                    </div>
                </ZoruCardContent>
            </Card>
        </div>
    );
}
