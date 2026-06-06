import React, { Suspense } from 'react';

import { Spinner } from '@/components/sabcrm/20ui';

import { listPagesenseSites } from '@/app/actions/sabsense.actions';

import { PagesenseSitesClient } from './_components/sabsense-sites-client';

export const dynamic = 'force-dynamic';

async function SitesData() {
    const sites = await listPagesenseSites();
    return <PagesenseSitesClient initialSites={sites} />;
}

export default function PagesenseHomePage() {
    return (
        <Suspense
            fallback={
                <div className="ui20 flex items-center gap-3 p-8 text-sm text-[var(--st-text-secondary)]">
                    <Spinner size="sm" label="Loading sites" />
                    <span>Loading sites</span>
                </div>
            }
        >
            <SitesData />
        </Suspense>
    );
}
