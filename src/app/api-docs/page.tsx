import type { Metadata } from 'next';
import { Suspense } from 'react';
import { getSession } from '@/app/actions';
import { ApiDocsClient } from './client';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
    title: 'API reference | SabNode',
    description: 'REST + webhook API for every module. Signed events, idempotent writes, typed SDKs.',
};

async function Inner() {
    const session = await getSession();
    return <ApiDocsClient session={session} />;
}

export default function Page() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-zoru-surface" />}>
            <Inner />
        </Suspense>
    );
}
