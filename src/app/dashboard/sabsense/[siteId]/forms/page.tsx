import React, { Suspense } from 'react';

import {
    getPagesenseSite,
    listFormAnalytics,
} from '@/app/actions/pagesense.actions';

import { FormsClient } from './_forms-client';

export const dynamic = 'force-dynamic';

interface PageProps {
    params: Promise<{ siteId: string }>;
}

async function FormsData({ params }: PageProps) {
    const { siteId } = await params;
    const [site, forms] = await Promise.all([
        getPagesenseSite(siteId),
        listFormAnalytics(siteId),
    ]);
    return <FormsClient site={site} forms={forms} />;
}

export default function FormsPage(props: PageProps) {
    return (
        <Suspense
            fallback={
                <div className="zoruui p-8 text-sm text-[color:var(--zoru-fg-muted)]">
                    Loading form analytics…
                </div>
            }
        >
            <FormsData {...props} />
        </Suspense>
    );
}
