import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { getSession } from '@/app/actions';
import { ModulePageShell } from '@/components/landing-v2/module-page-shell';
import { CategoryHero } from '@/components/landing-v2/heroes/category-hero';
import { MODULES, MODULES_BY_SLUG, type ModuleSlug } from '@/components/landing-v2/modules-data';

export const dynamic = 'force-dynamic';

interface PageProps {
    params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { slug } = await params;
    const mod = MODULES_BY_SLUG[slug as ModuleSlug];
    if (!mod) return { title: 'Products | SabNode' };
    return {
        title: `${mod.name} · ${mod.tag} | SabNode`,
        description: mod.desc,
    };
}

export function generateStaticParams() {
    return MODULES.map((m) => ({ slug: m.slug }));
}

async function Inner({ slug }: { slug: ModuleSlug }) {
    const session = await getSession();
    return (
        <ModulePageShell
            slug={slug}
            session={session}
            heroVisual={<CategoryHero slug={slug} />}
        />
    );
}

export default async function ProductDynamicPage({ params }: PageProps) {
    const { slug } = await params;
    const mod = MODULES_BY_SLUG[slug as ModuleSlug];
    if (!mod) notFound();

    return (
        <Suspense fallback={<div className="min-h-screen" style={{ background: mod.bg }} />}>
            <Inner slug={slug as ModuleSlug} />
        </Suspense>
    );
}
