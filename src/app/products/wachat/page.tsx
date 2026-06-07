import type { Metadata } from 'next';
import { Suspense } from 'react';
import { getSession } from '@/app/actions';
import { ModulePageShell } from '@/components/landing-v2/module-page-shell';
import { WachatHero } from '@/components/landing-v2/heroes/wachat-hero';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
    title: 'Wachat · WhatsApp Business at scale | SabNode',
    description:
        'Templates, broadcasts, chatbot, catalog, payments, your WhatsApp number on autopilot.',
};

async function Inner() {
    const session = await getSession();
    return (
        <ModulePageShell
            slug="wachat"
            session={session}
            heroVisual={<WachatHero />}
        />
    );
}

export default function WachatProductPage() {
    return (
        <Suspense fallback={<div className="min-h-screen" style={{ background: '#02110d' }} />}>
            <Inner />
        </Suspense>
    );
}
