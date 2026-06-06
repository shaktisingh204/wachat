import React, { Suspense } from 'react';

import {
    getPagesenseSite,
    listHeatmapEvents,
    listHeatmapSnapshots,
} from '@/app/actions/sabsense.actions';

import { HeatmapsClient } from './_heatmaps-client';

export const dynamic = 'force-dynamic';

interface PageProps {
    params: Promise<{ siteId: string }>;
    searchParams: Promise<{ url?: string; device?: string }>;
}

async function HeatmapsData({ params, searchParams }: PageProps) {
    const { siteId } = await params;
    const sp = await searchParams;
    const url = sp.url || '/';

    // Run reads in parallel; no waterfall.
    const [site, snapshots, recentClicks] = await Promise.all([
        getPagesenseSite(siteId),
        listHeatmapSnapshots({ siteId, url }),
        listHeatmapEvents({ siteId, url, eventType: 'click', limit: 1000 }),
    ]);

    return (
        <HeatmapsClient
            site={site}
            initialUrl={url}
            initialDevice={(sp.device as 'desktop' | 'tablet' | 'mobile') || 'desktop'}
            snapshots={snapshots}
            clickEvents={recentClicks}
        />
    );
}

export default function HeatmapsPage(props: PageProps) {
    return (
        <Suspense
            fallback={
                <div className="zoruui p-8 text-sm text-[color:var(--st-text-secondary)]">
                    Loading heatmaps…
                </div>
            }
        >
            <HeatmapsData {...props} />
        </Suspense>
    );
}
