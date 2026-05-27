import type { Metadata } from 'next';
import { Suspense } from 'react';
import { getSession } from '@/app/actions';
import { ModulePageShell } from '@/components/landing-v2/module-page-shell';
import { CrmHero } from '@/components/landing-v2/heroes/crm-hero';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
    title: 'CRM · Sales + ops in one stack | SabNode',
    description: 'Pipelines, deals, quotes, invoices, accounting, inventory, bookings, loyalty.',
};

async function Inner() {
    const session = await getSession();
    return <ModulePageShell slug="crm" session={session} heroVisual={<CrmHero />} />;
}

export default function CrmProductPage() {
    return (
        <Suspense fallback={<div className="min-h-screen" style={{ background: '#020817' }} />}>
            <Inner />
        </Suspense>
    );
}
