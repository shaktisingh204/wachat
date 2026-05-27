import type { Metadata } from 'next';
import { Suspense } from 'react';
import { getSession } from '@/app/actions';
import { SecurityClient } from './client';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
    title: 'Security & compliance | SabNode',
    description: 'SOC 2, ISO 27001, encryption, region pinning, DPDP/GDPR — the security posture of SabNode.',
};

async function Inner() {
    const session = await getSession();
    return <SecurityClient session={session} />;
}

export default function Page() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-[#fafaf7]" />}>
            <Inner />
        </Suspense>
    );
}
