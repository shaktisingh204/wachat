import React, { Suspense } from 'react';

import {
    getPagesenseSite,
    listHeatmapEvents,
    listHeatmapSnapshots,
} from '@/app/actions/sabsense.actions';

import { ScrollClient } from './_scroll-client';

export const dynamic = 'force-dynamic';

interface PageProps {
    params: Promise<{ siteId: string }>;
    searchParams: Promise<{ url?: string }>;
}

async function ScrollData({ params, searchParams }: PageProps) {
    const { siteId } = await params;
    const sp = await searchParams;
    const url = sp.url || '/';

    const [site, snapshots, scrolls] = await Promise.all([
        getPagesenseSite(siteId),
        listHeatmapSnapshots({ siteId, url }),
        listHeatmapEvents({ siteId, url, eventType: 'scroll', limit: 5000 }),
    ]);

    return (
        <ScrollClient
            site={site}
            initialUrl={url}
            snapshots={snapshots}
            scrollEvents={scrolls}
        />
    );
}

export default function ScrollPage(props: PageProps) {
    return (
        <Suspense
            fallback={
                <div className="zoruui p-8 text-sm text-[color:var(--zoru-fg-muted)]">
                    Loading scroll map…
                </div>
            }
        >
            <ScrollData {...props} />
        </Suspense>
    );
}
