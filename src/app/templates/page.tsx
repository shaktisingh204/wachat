import type { Metadata } from 'next';
import { Suspense } from 'react';
import { getSession } from '@/app/actions';
import { TemplatesClient } from './client';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
    title: 'Templates | SabNode',
    description: 'Pre-built flows, dashboards, and campaigns — clone and tweak in one click.',
};

async function Inner() {
    const session = await getSession();
    return <TemplatesClient session={session} />;
}

export default function Page() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-zoru-surface" />}>
            <Inner />
        </Suspense>
    );
}
