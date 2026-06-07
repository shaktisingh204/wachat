import type { Metadata } from 'next';
import { Suspense } from 'react';
import { getSession } from '@/app/actions';
import { ModulePageShell } from '@/components/landing-v2/module-page-shell';
import { SeoHero } from '@/components/landing-v2/heroes/seo-hero';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
    title: 'SEO · Growth surface | SabNode',
    description: 'Landing pages, sitemap, schema, link tracking, A/B tests. Your acquisition rails.',
};

async function Inner() {
    const session = await getSession();
    return <ModulePageShell slug="seo" session={session} heroVisual={<SeoHero />} />;
}

export default function SeoProductPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-[#170611]" />}>
            <Inner />
        </Suspense>
    );
}
