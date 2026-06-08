'use client';

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MapPin } from 'lucide-react';

import {
    Button,
    Card,
    CardBody,
    CardHeader,
    CardTitle,
    CardDescription,
    EmptyState,
    Field,
    Input,
    PageHeader,
    PageHeaderHeading,
    PageTitle,
    PageDescription,
    Progress,
} from '@/components/sabcrm/20ui';

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
            // Bucket index: depth >= 10% goes to bucket[0], >= 20% to bucket[1], and so on.
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
            <div className="20ui p-8">
                <EmptyState
                    icon={MapPin}
                    title="Site not found"
                    description="We couldn't load this site. It may have been removed or you may not have access."
                />
            </div>
        );
    }

    const apply = () => {
        const params = new URLSearchParams();
        params.set('url', url);
        router.push(`?${params.toString()}`);
    };

    return (
        <div className="20ui p-8 space-y-6">
            <PageHeader>
                <PageHeaderHeading>
                    <PageTitle>{site.name} scroll map</PageTitle>
                    <PageDescription>
                        Percentage of sessions that scrolled past each decile of the
                        viewport.
                    </PageDescription>
                </PageHeaderHeading>
            </PageHeader>

            <PagesenseSiteNav siteId={site._id} />

            <Card>
                <CardHeader>
                    <CardTitle>Filters</CardTitle>
                </CardHeader>
                <CardBody>
                    <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
                        <Field label="URL path">
                            <Input
                                value={url}
                                onChange={(e) => setUrl(e.target.value)}
                                placeholder="/"
                            />
                        </Field>
                        <div className="flex items-end">
                            <Button variant="primary" onClick={apply}>
                                Apply
                            </Button>
                        </div>
                    </div>
                </CardBody>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Scroll depth</CardTitle>
                    <CardDescription>
                        {deciles.total} unique session(s) · {snapshots.length} snapshot(s)
                    </CardDescription>
                </CardHeader>
                <CardBody>
                    <div className="space-y-3">
                        {deciles.pct.map((pct, i) => (
                            <div key={i} className="space-y-1">
                                <div className="flex justify-between text-xs text-[var(--st-text-secondary)]">
                                    <span>Past {(i + 1) * 10}%</span>
                                    <span>{pct}%</span>
                                </div>
                                <Progress
                                    value={pct}
                                    aria-label={`Sessions that scrolled past ${(i + 1) * 10}%`}
                                />
                            </div>
                        ))}
                    </div>
                </CardBody>
            </Card>
        </div>
    );
}
