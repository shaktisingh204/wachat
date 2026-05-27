import type { Metadata } from 'next';
import { Suspense } from 'react';
import { getSession } from '@/app/actions';
import { DocsClient } from './client';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
    title: 'Docs | SabNode',
    description: 'Guides, references, recipes — everything you need to ship with SabNode.',
};

async function Inner() {
    const session = await getSession();
    return <DocsClient session={session} />;
}

export default function Page() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-zoru-surface" />}>
            <Inner />
        </Suspense>
    );
}
