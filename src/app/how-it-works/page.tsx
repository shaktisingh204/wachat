import type { Metadata } from 'next';
import { Suspense } from 'react';
import { getSession } from '@/app/actions';
import { HowItWorksClient } from './client';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
    title: 'How it works | SabNode',
    description: 'Connect your data, pick your modules, ship in days. The architecture behind SabNode.',
};

async function Inner() {
    const session = await getSession();
    return <HowItWorksClient session={session} />;
}

export default function Page() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-zoru-surface" />}>
            <Inner />
        </Suspense>
    );
}
