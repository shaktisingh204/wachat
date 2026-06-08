import React, { Suspense } from 'react';

import { Spinner } from '@/components/sabcrm/20ui';

import {
    getPagesenseSite,
    listFormAnalytics,
} from '@/app/actions/sabsense.actions';

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
                <div className="20ui flex items-center gap-2 p-8 text-sm text-[var(--st-text-secondary)]">
                    <Spinner size="sm" label="Loading form analytics" />
                    Loading form analytics.
                </div>
            }
        >
            <FormsData {...props} />
        </Suspense>
    );
}
