import React, { Suspense } from 'react';

import { getPagesenseSite, listRecordings } from '@/app/actions/pagesense.actions';

import { RecordingsClient } from './_recordings-client';

export const dynamic = 'force-dynamic';

interface PageProps {
    params: Promise<{ siteId: string }>;
    searchParams: Promise<{ url?: string; country?: string; minDuration?: string }>;
}

async function RecordingsData({ params, searchParams }: PageProps) {
    const { siteId } = await params;
    const sp = await searchParams;
    const minDuration = sp.minDuration ? Number(sp.minDuration) : undefined;

    const [site, recordings] = await Promise.all([
        getPagesenseSite(siteId),
        listRecordings({ siteId, url: sp.url, country: sp.country, minDuration }),
    ]);

    return (
        <RecordingsClient
            site={site}
            initialUrl={sp.url || ''}
            initialCountry={sp.country || ''}
            initialMinDuration={minDuration || 0}
            recordings={recordings}
        />
    );
}

export default function RecordingsPage(props: PageProps) {
    return (
        <Suspense
            fallback={
                <div className="zoruui p-8 text-sm text-[color:var(--zoru-fg-muted)]">
                    Loading recordings…
                </div>
            }
        >
            <RecordingsData {...props} />
        </Suspense>
    );
}
