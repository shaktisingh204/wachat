import React, { Suspense } from 'react';

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
                <div className="zoruui p-8 text-sm text-[color:var(--zoru-fg-muted)]">
                    Loading sites…
                </div>
            }
        >
            <SitesData />
        </Suspense>
    );
}
