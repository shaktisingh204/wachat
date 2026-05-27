import * as React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight, ArrowUpRight, Check, ChevronRight, Sparkles, Plus, Minus } from 'lucide-react';

import { FEATURES, getFeature, getRelatedFeatures } from '@/lib/features/catalog';
import { FEATURE_CATEGORIES } from '@/lib/features/types';
import { FEATURE_ICONS } from '@/lib/features/icons';
import { FeatureHeader, FeatureCategoryStrip, FeatureFooter } from '@/components/features/FeatureChrome';
import { CapabilitiesSection } from './components/CapabilitiesSection';
import { HeroSection } from './components/HeroSection';
import { PlatformIntegrations } from './components/PlatformIntegrations';
import { FaqSection } from './components/FaqSection';
import { UseCasesSection } from './components/UseCasesSection';
import { HowItWorksSection } from './components/HowItWorksSection';

export const dynamic = 'force-dynamic';

type Params = { slug: string };

export function generateStaticParams(): Params[] {
  return FEATURES.map(f => ({ slug: f.slug }));
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://sabnode.com';

export async function generateMetadata(
  { params }: { params: Promise<Params> }
): Promise<Metadata> {
  const { slug } = await params;
  const feature = getFeature(slug);
  if (!feature) {
    return {
      title: 'Feature not found | SabNode',
      description: 'The feature you requested does not exist on SabNode.',
    };
  }

  const url = `${SITE_URL}/features/${feature.slug}`;
  return {
    title: feature.seoTitle,
    description: feature.seoDescription,
    keywords: feature.keywords,
    alternates: { canonical: url },
    openGraph: {
      title: feature.seoTitle,
      description: feature.seoDescription,
      url,
      siteName: 'SabNode',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: feature.seoTitle,
      description: feature.seoDescription,
    },
  };
}

export default async function FeatureDetailPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const feature = getFeature(slug);
  if (!feature) notFound();

  const Icon = FEATURE_ICONS[feature.iconKey] ?? Sparkles;
  const related = getRelatedFeatures(feature);
  const categoryMeta = FEATURE_CATEGORIES.find(c => c.id === feature.category);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: `SabNode ${feature.name}`,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    description: feature.seoDescription,
    url: `${SITE_URL}/features/${feature.slug}`,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  };

  const faqLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: feature.faqs.map(f => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Features', item: `${SITE_URL}/features` },
      { '@type': 'ListItem', position: 3, name: feature.name, item: `${SITE_URL}/features/${feature.slug}` },
    ],
  };

  return (
    <div className="sn-root relative min-h-screen overflow-x-clip antialiased bg-white text-zoru-ink">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />

      <FeatureHeader />
      <FeatureCategoryStrip active={feature.category} />

      {/* breadcrumbs */}
      <nav aria-label="Breadcrumb" className="container mx-auto px-4 md:px-6 pt-6">
        <ol className="flex items-center gap-1.5 text-[12px] text-zoru-ink">
          <li><Link href="/" className="hover:text-zoru-ink">Home</Link></li>
          <li><ChevronRight className="h-3 w-3" /></li>
          <li><Link href="/features" className="hover:text-zoru-ink">Features</Link></li>
          <li><ChevronRight className="h-3 w-3" /></li>
          <li>
            <Link href={`/features#${feature.category}`} className="hover:text-zoru-ink">
              {categoryMeta?.label}
            </Link>
          </li>
          <li><ChevronRight className="h-3 w-3" /></li>
          <li className="text-zoru-ink font-semibold truncate max-w-[12rem]">{feature.name}</li>
        </ol>
      </nav>

      {/* ───────────── Hero ───────────── */}
      <HeroSection feature={feature} categoryMeta={categoryMeta} />

      {/* ───────────── Problem ───────────── */}
      <section className="border-t sn-hair">
        <div className="container mx-auto px-4 md:px-6 py-14 md:py-20">
          <div className="grid grid-cols-12 gap-6 md:gap-10">
            <div className="col-span-12 md:col-span-4">
              <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-zoru-ink">
                The problem
              </div>
              <h2 className="mt-3 font-display tracking-[-0.02em] text-[28px] md:text-[40px] leading-[1.05] text-zoru-ink">
                {feature.problem.title}
              </h2>
            </div>
            <div className="col-span-12 md:col-span-8">
              <div className="text-[16px] md:text-[17px] leading-[1.7] text-zoru-ink space-y-5 max-w-2xl">
                {feature.problem.body.split('\n\n').map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ───────────── Overview (editorial) ───────────── */}
      <section className="border-t sn-hair bg-zoru-surface">
        <div className="container mx-auto px-4 md:px-6 py-14 md:py-20">
          <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-zoru-ink">
            What it is
          </div>
          <h2 className="mt-3 font-display tracking-[-0.02em] text-[28px] md:text-[40px] leading-[1.05] text-zoru-ink max-w-3xl">
            {feature.name}, in depth.
          </h2>

          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-5 text-[16px] leading-[1.75] text-zoru-ink">
            {feature.overview.map((p, i) => (
              <p key={i} className={i === 0 ? 'first-letter:font-display first-letter:text-[44px] first-letter:font-bold first-letter:leading-[0.9] first-letter:float-left first-letter:mr-2 first-letter:mt-1' : ''} style={i === 0 ? { color: '#121126' } : undefined}>
                {p}
              </p>
            ))}
          </div>
        </div>
      </section>

      <CapabilitiesSection 
        featureName={feature.name} 
        color={feature.color} 
        capabilities={feature.capabilities} 
      />

      {/* ───────────── Use cases ───────────── */}
      <UseCasesSection color={feature.color} useCases={feature.useCases} />

      {/* ───────────── How it works ───────────── */}
      <HowItWorksSection featureName={feature.name} color={feature.color} howItWorks={feature.howItWorks} />

      {/* ───────────── Integrations ───────────── */}
      <PlatformIntegrations color={feature.color} integrations={feature.integrations} />

      {/* ───────────── FAQ ───────────── */}
      <FaqSection featureName={feature.name} faqs={feature.faqs} />

      {/* ───────────── Related features ───────────── */}
      {related.length > 0 && (
        <section className="border-t sn-hair bg-zoru-surface">
          <div className="container mx-auto px-4 md:px-6 py-14 md:py-20">
            <div className="flex items-end justify-between mb-8 gap-6 flex-wrap">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-zoru-ink">
                  Related features
                </div>
                <h2 className="mt-3 font-display tracking-[-0.02em] text-[28px] md:text-[40px] leading-[1.05] text-zoru-ink">
                  Stronger when stacked.
                </h2>
              </div>
              <Link
                href="/features"
                className="inline-flex items-center gap-1 text-[12.5px] font-bold uppercase tracking-[0.14em] text-zoru-ink hover:text-zoru-ink"
              >
                Browse every feature <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {related.map(r => {
                const RIcon = FEATURE_ICONS[r.iconKey] ?? Sparkles;
                return (
                  <Link
                    key={r.slug}
                    href={`/features/${r.slug}`}
                    className="group rounded-xl p-5 bg-white border sn-hair hover:-translate-y-0.5 transition-all"
                  >
                    <span
                      className="h-9 w-9 rounded-lg inline-flex items-center justify-center text-white"
                      style={{
                        background: `linear-gradient(135deg, ${r.color}, ${r.color}cc)`,
                        boxShadow: `0 6px 16px -6px ${r.color}66`,
                      }}
                    >
                      <RIcon className="h-4 w-4" strokeWidth={2.2} />
                    </span>
                    <div className="mt-4 font-display text-[16px] leading-tight text-zoru-ink">
                      {r.name}
                    </div>
                    <div className="mt-2 text-[12.5px] text-zoru-ink leading-snug line-clamp-3">
                      {r.tagline}
                    </div>
                    <div className="mt-4 inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-[0.14em] text-zoru-ink group-hover:text-zoru-ink">
                      Read more <ChevronRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ───────────── Final CTA band ───────────── */}
      <section className="relative overflow-hidden bg-zoru-ink text-white">
        <div
          aria-hidden
          className="absolute inset-0 -z-0 opacity-70"
          style={{
            backgroundImage:
              `radial-gradient(60% 80% at 20% 20%, ${feature.color}33, transparent 60%),` +
              `radial-gradient(40% 80% at 90% 80%, #4F46E555, transparent 60%)`,
          }}
        />
        <div className="container mx-auto px-4 md:px-6 py-16 md:py-24 relative">
          <div className="max-w-3xl">
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/55">
              {feature.hero.eyebrow}
            </div>
            <h2 className="mt-3 font-display tracking-[-0.02em] text-[34px] md:text-[54px] leading-[1.02]">
              Ship {feature.name.toLowerCase()} into production this week.
            </h2>
            <p className="mt-5 text-[16px] md:text-[18px] leading-[1.6] text-white/70 max-w-2xl">
              No credit card. No sales call required. Spin up a workspace, plug
              in a number, and your team is live in under an hour.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-2.5">
              <Link
                href="/signup"
                className="inline-flex h-12 items-center gap-1.5 rounded-full bg-white text-zoru-ink px-6 text-[14px] font-bold transition-transform hover:translate-y-[-1px]"
              >
                Start free <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/contact"
                className="inline-flex h-12 items-center gap-1.5 rounded-full border border-white/20 bg-white/5 px-6 text-[14px] font-semibold text-white hover:bg-white/10"
              >
                Book a demo
              </Link>
              <Link
                href="/pricing"
                className="inline-flex h-12 items-center gap-1.5 px-2 text-[13.5px] font-medium text-white/70 hover:text-white"
              >
                See pricing <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <FeatureFooter />
    </div>
  );
}
