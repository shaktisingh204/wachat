import type { Metadata } from 'next';
import { Suspense } from 'react';
import { getSession } from '@/app/actions';
import { ModulePageShell } from '@/components/landing-v2/module-page-shell';
import { SabCallHero } from '@/components/landing-v2/heroes/sabcall-hero';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
    title: 'SabCall · Superphone-class calling cloud | SabNode',
    description:
        'A WebRTC browser softphone, unified call inbox, visual IVR, queues, live coaching, AI call intelligence and an outbound dialer — on a self-hosted SIP engine you own.',
};

async function Inner() {
    const session = await getSession();
    return <ModulePageShell slug="sabcall" session={session} heroVisual={<SabCallHero />} />;
}

export default function SabCallProductPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-[#0a081f]" />}>
            <Inner />
        </Suspense>
    );
}
