import React, { Suspense } from 'react';

import {
    getPagesenseSite,
    listFunnels,
    listFunnelRuns,
} from '@/app/actions/sabsense.actions';

import { FunnelsClient } from './_funnels-client';

export const dynamic = 'force-dynamic';

interface PageProps {
    params: Promise<{ siteId: string }>;
}

async function FunnelsData({ params }: PageProps) {
    const { siteId } = await params;
    const [site, funnels] = await Promise.all([
        getPagesenseSite(siteId),
        listFunnels(siteId),
    ]);

    // Fan-out the per-funnel runs in parallel.
    const runs = await Promise.all(
        funnels.map((f) => listFunnelRuns(f._id).then((rs) => [f._id, rs] as const)),
    );
    const runsByFunnel = Object.fromEntries(runs);

    return <FunnelsClient site={site} funnels={funnels} runsByFunnel={runsByFunnel} />;
}

export default function FunnelsPage(props: PageProps) {
    return (
        <Suspense
            fallback={
                <div className="zoruui p-8 text-sm text-[color:var(--st-text-secondary)]">
                    Loading funnels…
                </div>
            }
        >
            <FunnelsData {...props} />
        </Suspense>
    );
}
