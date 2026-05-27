import type { Metadata } from 'next';
import { Suspense } from 'react';
import { getSession } from '@/app/actions';
import { ModulePageShell } from '@/components/landing-v2/module-page-shell';
import { SabflowHero } from '@/components/landing-v2/heroes/sabflow-hero';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
    title: 'SabFlow · Visual automation | SabNode',
    description: '900+ integrations, drag-drop nodes, branching logic, scheduled runs.',
};

async function Inner() {
    const session = await getSession();
    return (
        <ModulePageShell slug="sabflow" session={session} heroVisual={<SabflowHero />} />
    );
}

export default function SabflowProductPage() {
    return (
        <Suspense fallback={<div className="min-h-screen" style={{ background: '#0c0617' }} />}>
            <Inner />
        </Suspense>
    );
}
