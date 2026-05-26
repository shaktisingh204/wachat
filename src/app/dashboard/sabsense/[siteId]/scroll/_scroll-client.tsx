'use client';

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

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
    Progress,
} from '@/components/zoruui';

import type { PagesenseSite } from '@/lib/rust-client/pagesense-sites';
import type { HeatmapEventDoc } from '@/lib/rust-client/pagesense-heatmap-events';
import type { HeatmapSnapshot } from '@/lib/rust-client/pagesense-heatmaps';

import { PagesenseSiteNav } from '../_site-nav';

interface Props {
    site: PagesenseSite | null;
    initialUrl: string;
    snapshots: HeatmapSnapshot[];
    scrollEvents: HeatmapEventDoc[];
}

export function ScrollClient({ site, initialUrl, snapshots, scrollEvents }: Props) {
    const router = useRouter();
    const [url, setUrl] = useState(initialUrl);

    // Compute deciles from raw scroll events: max scroll-y per session,
    // normalized to viewport height.
    const deciles = useMemo(() => {
        const maxBySession = new Map<string, number>();
        for (const ev of scrollEvents) {
            const norm = Math.min(1, ev.y / Math.max(1, ev.viewportH));
            const prev = maxBySession.get(ev.sessionId) ?? 0;
            if (norm > prev) maxBySession.set(ev.sessionId, norm);
        }
        const total = maxBySession.size;
        const buckets = new Array<number>(10).fill(0);
        for (const v of maxBySession.values()) {
            // Bucket index: depth >= 10% → bucket[0], >= 20% → bucket[1], …
            for (let i = 0; i < 10; i++) {
                if (v >= (i + 1) / 10) buckets[i] += 1;
            }
        }
        return {
            total,
            pct: buckets.map((b) => (total > 0 ? Math.round((b / total) * 100) : 0)),
        };
    }, [scrollEvents]);

    if (!site) {
        return (
            <div className="zoruui p-8 text-sm text-[color:var(--zoru-fg-muted)]">
                Site not found.
            </div>
        );
    }

    const apply = () => {
        const params = new URLSearchParams();
        params.set('url', url);
        router.push(`?${params.toString()}`);
    };

    return (
        <div className="zoruui p-8 space-y-6">
            <PageHeader>
                <ZoruPageTitle>{site.name} — Scroll map</ZoruPageTitle>
                <ZoruPageDescription>
                    Percentage of sessions that scrolled past each decile of the
                    viewport.
                </ZoruPageDescription>
            </PageHeader>

            <PagesenseSiteNav siteId={site._id} />

            <Card>
                <ZoruCardHeader>
                    <ZoruCardTitle>Filters</ZoruCardTitle>
                </ZoruCardHeader>
                <ZoruCardContent>
                    <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
                        <div className="space-y-2">
                            <Label htmlFor="ps-url">URL path</Label>
                            <Input
                                id="ps-url"
                                value={url}
                                onChange={(e) => setUrl(e.target.value)}
                                placeholder="/"
                            />
                        </div>
                        <div className="flex items-end">
                            <Button onClick={apply}>Apply</Button>
                        </div>
                    </div>
                </ZoruCardContent>
            </Card>

            <Card>
                <ZoruCardHeader>
                    <ZoruCardTitle>Scroll depth</ZoruCardTitle>
                    <ZoruCardDescription>
                        {deciles.total} unique session(s) · {snapshots.length} snapshot(s)
                    </ZoruCardDescription>
                </ZoruCardHeader>
                <ZoruCardContent>
                    <div className="space-y-3">
                        {deciles.pct.map((pct, i) => (
                            <div key={i} className="space-y-1">
                                <div className="flex justify-between text-xs text-[color:var(--zoru-fg-muted)]">
                                    <span>Past {(i + 1) * 10}%</span>
                                    <span>{pct}%</span>
                                </div>
                                <Progress value={pct} />
                            </div>
                        ))}
                    </div>
                </ZoruCardContent>
            </Card>
        </div>
    );
}
