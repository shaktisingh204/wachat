import type { Metadata } from 'next';
import { Suspense } from 'react';
import { getSession } from '@/app/actions';
import { CompareClient } from './client';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
    title: 'Compare tools | SabNode',
    description: 'SabNode vs HubSpot, Zoho, Zapier, Freshworks — feature-by-feature.',
};

async function Inner() {
    const session = await getSession();
    return <CompareClient session={session} />;
}

export default function Page() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-zoru-surface" />}>
            <Inner />
        </Suspense>
    );
}
