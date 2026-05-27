import type { Metadata } from 'next';
import { Suspense } from 'react';
import { getSession } from '@/app/actions';
import { StatusClient } from './client';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
    title: 'Status | SabNode',
    description: 'Live operational status of every SabNode service. 90-day uptime, incidents, scheduled maintenance.',
};

async function Inner() {
    const session = await getSession();
    return <StatusClient session={session} />;
}

export default function Page() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-zoru-surface" />}>
            <Inner />
        </Suspense>
    );
}
