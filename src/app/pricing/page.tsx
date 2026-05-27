import type { Metadata } from 'next';
import { Suspense } from 'react';
import { getSession } from '@/app/actions';
import { PricingPage } from '@/components/landing-v2/pricing-page';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
    title: 'Pricing · 47 products, one bill | SabNode',
    description:
        'Transparent, usage-based pricing for the SabNode platform. Start free. Scale to enterprise.',
};

async function Inner() {
    const session = await getSession();
    return <PricingPage session={session} />;
}

export default function PricingRoute() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-[#fafaf7]" />}>
            <Inner />
        </Suspense>
    );
}
