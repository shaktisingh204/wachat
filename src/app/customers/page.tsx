import type { Metadata } from 'next';
import { Suspense } from 'react';
import { getSession } from '@/app/actions';
import { CustomersClient } from './customers-client';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
    title: 'Customers | SabNode',
    description: 'Teams shipping faster with SabNode — case studies, results, stories.',
};

async function Inner() {
    const session = await getSession();
    return <CustomersClient session={session} />;
}

export default function Page() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-[#fafaf7]" />}>
            <Inner />
        </Suspense>
    );
}
