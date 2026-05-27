import type { Metadata } from 'next';
import { Suspense } from 'react';
import { getSession } from '@/app/actions';
import { ChangelogClient } from './client';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
    title: 'Changelog | SabNode',
    description: 'What shipped this week. Versioned releases, feature flags, and the boring fixes too.',
};

async function Inner() {
    const session = await getSession();
    return <ChangelogClient session={session} />;
}

export default function Page() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-[#fafaf7]" />}>
            <Inner />
        </Suspense>
    );
}
