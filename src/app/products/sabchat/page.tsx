import type { Metadata } from 'next';
import { Suspense } from 'react';
import { getSession } from '@/app/actions';
import { ModulePageShell } from '@/components/landing-v2/module-page-shell';
import { SabchatHero } from '@/components/landing-v2/heroes/sabchat-hero';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
    title: 'SabChat · Omnichannel inbox | SabNode',
    description:
        'Live chat, email, WhatsApp, Instagram, Telegram, SMS — every message in one window.',
};

async function Inner() {
    const session = await getSession();
    return (
        <ModulePageShell slug="sabchat" session={session} heroVisual={<SabchatHero />} />
    );
}

export default function SabchatProductPage() {
    return (
        <Suspense fallback={<div className="min-h-screen" style={{ background: '#150a02' }} />}>
            <Inner />
        </Suspense>
    );
}
