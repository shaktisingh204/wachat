import React, { Suspense } from 'react';

import { getPagesenseSite, listRecordings } from '@/app/actions/sabsense.actions';
import { Spinner } from '@/components/sabcrm/20ui';

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
                <div className="20ui flex items-center gap-2 p-8 text-sm text-[var(--st-text-secondary)]">
                    <Spinner size="sm" label="Loading recordings" />
                    <span>Loading recordings.</span>
                </div>
            }
        >
            <RecordingsData {...props} />
        </Suspense>
    );
}
