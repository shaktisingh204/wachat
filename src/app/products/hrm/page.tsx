import type { Metadata } from 'next';
import { Suspense } from 'react';
import { getSession } from '@/app/actions';
import { ModulePageShell } from '@/components/landing-v2/module-page-shell';
import { HrmHero } from '@/components/landing-v2/heroes/hrm-hero';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
    title: 'HRM · People + payroll | SabNode',
    description: 'Roster, shifts, attendance, leaves, payroll, performance, roadmaps.',
};

async function Inner() {
    const session = await getSession();
    return <ModulePageShell slug="hrm" session={session} heroVisual={<HrmHero />} />;
}

export default function HrmProductPage() {
    return (
        <Suspense fallback={<div className="min-h-screen" style={{ background: '#021019' }} />}>
            <Inner />
        </Suspense>
    );
}
