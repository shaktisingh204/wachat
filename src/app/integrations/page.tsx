import type { Metadata } from 'next';
import { Suspense } from 'react';
import { getSession } from '@/app/actions';
import { IntegrationsClient } from './client';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
    title: 'Integrations · 900+ apps | SabNode',
    description: 'Connect SabNode to the rest of your stack — 900+ integrations across communication, commerce, AI, data.',
};

async function Inner() {
    const session = await getSession();
    return <IntegrationsClient session={session} />;
}

export default function Page() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-zoru-surface" />}>
            <Inner />
        </Suspense>
    );
}
