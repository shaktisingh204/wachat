'use client';

import React, { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Monitor, Smartphone, Tablet, RefreshCw, MousePointerClick, MapPin } from 'lucide-react';

import {
    Badge,
    Button,
    Card,
    CardBody,
    CardDescription,
    CardHeader,
    CardTitle,
    EmptyState,
    Field,
    Input,
    PageActions,
    PageDescription,
    PageHeader,
    PageTitle,
    SegmentedControl,
    useToast,
} from '@/components/sabcrm/20ui';

import { regenerateHeatmapSnapshot } from '@/app/actions/sabsense.actions';
import type { PagesenseSite } from '@/lib/rust-client/pagesense-sites';
import type { HeatmapEventDoc } from '@/lib/rust-client/pagesense-heatmap-events';
import type { HeatmapSnapshot } from '@/lib/rust-client/pagesense-heatmaps';

type DeviceKey = 'desktop' | 'tablet' | 'mobile';

const DEVICE_WIDTHS: Record<DeviceKey, number> = {
    desktop: 1280,
    tablet: 768,
    mobile: 375,
};

const DEVICE_ITEMS = [
    { value: 'desktop' as const, label: 'Desktop', icon: Monitor },
    { value: 'tablet' as const, label: 'Tablet', icon: Tablet },
    { value: 'mobile' as const, label: 'Mobile', icon: Smartphone },
];

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
    const { toast } = useToast();
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
                toast.success({
                    title: 'Snapshot regenerated',
                    description: `Sample size: ${res.data?.sampleSize ?? 0}`,
                });
                router.refresh();
            } else {
                toast.error({ title: 'Could not regenerate snapshot', description: res.error });
            }
        });
    };

    if (!site) {
        return (
            <div className="p-8">
                <EmptyState
                    icon={MapPin}
                    title="Site not found"
                    description="This site is no longer available, or you do not have access to it."
                />
            </div>
        );
    }

    return (
        <div className="p-8 space-y-6">
            <PageHeader>
                <PageTitle>{site.name} heatmaps</PageTitle>
                <PageDescription>
                    Click density overlay. Pick a URL and a device viewport.
                </PageDescription>
                <PageActions>
                    <Button
                        variant="primary"
                        iconLeft={RefreshCw}
                        onClick={handleRegenerate}
                        loading={pending}
                    >
                        Regenerate snapshot
                    </Button>
                </PageActions>
            </PageHeader>

            <Card>
                <CardHeader>
                    <CardTitle>Filters</CardTitle>
                    <CardDescription>Page URL and device viewport.</CardDescription>
                </CardHeader>
                <CardBody>
                    <div className="grid gap-4 sm:grid-cols-[1fr_auto_auto] sm:items-end">
                        <Field label="URL path" id="ps-url">
                            <Input
                                value={url}
                                onChange={(e) => setUrl(e.target.value)}
                                placeholder="/"
                            />
                        </Field>
                        <Field label="Device">
                            <SegmentedControl
                                items={DEVICE_ITEMS}
                                value={device}
                                onChange={setDevice}
                                aria-label="Device viewport"
                            />
                        </Field>
                        <Button variant="secondary" onClick={handleApplyUrl}>
                            Apply
                        </Button>
                    </div>
                </CardBody>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Click density</CardTitle>
                    <CardDescription>
                        <span className="inline-flex flex-wrap items-center gap-2">
                            <Badge tone="accent">
                                {totalClicks} {totalClicks === 1 ? 'click' : 'clicks'}
                            </Badge>
                            <Badge tone="neutral">
                                {snapshots.length} {snapshots.length === 1 ? 'snapshot' : 'snapshots'} on file
                            </Badge>
                        </span>
                    </CardDescription>
                </CardHeader>
                <CardBody>
                    <div
                        className="relative mx-auto aspect-[4/3] overflow-hidden rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)]"
                        style={{ width }}
                    >
                        {/* Stub screenshot. TODO: real screenshot service. */}
                        {site.screenshotUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                                src={site.screenshotUrl}
                                alt="Page screenshot stub"
                                className="absolute inset-0 h-full w-full object-cover opacity-70"
                            />
                        ) : (
                            <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-xs text-[var(--st-text-secondary)]">
                                No screenshot yet. Overlay shows click density on a blank canvas.
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
                                const hue = 60 - 60 * intensity; // yellow to red
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

                        {totalClicks === 0 ? (
                            <div className="absolute inset-0 flex items-center justify-center bg-[var(--st-bg)]/60">
                                <EmptyState
                                    size="sm"
                                    icon={MousePointerClick}
                                    title="No clicks recorded"
                                    description="Once visitors interact with this page, their clicks appear here."
                                />
                            </div>
                        ) : null}
                    </div>
                </CardBody>
            </Card>
        </div>
    );
}
