import * as React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight, ArrowUpRight, Check, ChevronRight, Sparkles, Plus, Minus } from 'lucide-react';

import { FEATURES, getFeature, getRelatedFeatures } from '@/lib/features/catalog';
import { FEATURE_CATEGORIES } from '@/lib/features/types';
import { FEATURE_ICONS } from '@/lib/features/icons';
import { FeatureHeader, FeatureCategoryStrip, FeatureFooter, FeatureHeroPattern } from '@/components/features/FeatureChrome';

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
    <div className="sn-root relative min-h-screen overflow-x-clip antialiased bg-white text-[#121126]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />

      <FeatureHeader />
      <FeatureCategoryStrip active={feature.category} />

      {/* breadcrumbs */}
      <nav aria-label="Breadcrumb" className="container mx-auto px-4 md:px-6 pt-6">
        <ol className="flex items-center gap-1.5 text-[12px] text-[#7878A1]">
          <li><Link href="/" className="hover:text-[#121126]">Home</Link></li>
          <li><ChevronRight className="h-3 w-3" /></li>
          <li><Link href="/features" className="hover:text-[#121126]">Features</Link></li>
          <li><ChevronRight className="h-3 w-3" /></li>
          <li>
            <Link href={`/features#${feature.category}`} className="hover:text-[#121126]">
              {categoryMeta?.label}
            </Link>
          </li>
          <li><ChevronRight className="h-3 w-3" /></li>
          <li className="text-[#121126] font-semibold truncate max-w-[12rem]">{feature.name}</li>
        </ol>
      </nav>

      {/* ───────────── Hero ───────────── */}
      <section className="relative overflow-hidden">
        {/* feature-tinted halo */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-0"
          style={{
            backgroundImage: `radial-gradient(60% 60% at 80% 0%, ${feature.color}22, transparent 70%), radial-gradient(50% 50% at 10% 30%, ${feature.tint}, transparent 70%)`,
          }}
        />
        {/* per-category texture overlay — each category gets a distinct pattern */}
        <FeatureHeroPattern category={feature.category} color={feature.color} />
        <div className="container mx-auto px-4 md:px-6 pt-12 md:pt-16 pb-10 md:pb-16 relative">
          <div className="grid grid-cols-12 gap-6 md:gap-10 items-end">
            <div className="col-span-12 md:col-span-8">
              <div className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-[#4A4A6B]">
                <span
                  className="h-7 w-7 rounded-md inline-flex items-center justify-center text-white"
                  style={{
                    background: `linear-gradient(135deg, ${feature.color}, ${feature.color}cc)`,
                    boxShadow: `0 6px 16px -6px ${feature.color}66`,
                  }}
                >
                  <Icon className="h-3.5 w-3.5" strokeWidth={2.4} />
                </span>
                {feature.hero.eyebrow}
              </div>

              <h1 className="mt-5 font-display tracking-[-0.03em] text-[40px] md:text-[64px] lg:text-[76px] leading-[1.02] text-[#121126]">
                {feature.hero.headline}
              </h1>
              <p className="mt-6 text-[16px] md:text-[18px] leading-[1.55] text-[#4A4A6B] max-w-2xl">
                {feature.hero.subhead}
              </p>

              <ul className="mt-7 grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-w-2xl">
                {feature.hero.bullets.map(b => (
                  <li key={b} className="inline-flex items-start gap-2 text-[13.5px] text-[#121126]">
                    <span
                      className="mt-0.5 h-4 w-4 rounded-full inline-flex items-center justify-center flex-shrink-0"
                      style={{ background: `${feature.color}1a`, color: feature.color }}
                    >
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </span>
                    <span className="leading-snug">{b}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-8 flex flex-wrap items-center gap-2.5">
                <Link
                  href="/signup"
                  className="inline-flex h-11 items-center gap-1.5 rounded-full px-5 text-[13.5px] font-semibold text-white transition-transform hover:translate-y-[-1px]"
                  style={{ background: feature.color, boxShadow: `0 10px 24px -10px ${feature.color}` }}
                >
                  Start free <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/contact"
                  className="inline-flex h-11 items-center gap-1.5 rounded-full px-5 text-[13.5px] font-semibold text-[#121126] border sn-hair hover:bg-black/[0.03]"
                >
                  Talk to sales
                </Link>
                <Link
                  href="/features"
                  className="inline-flex h-11 items-center gap-1.5 px-2 text-[13px] font-medium text-[#4A4A6B] hover:text-[#121126]"
                >
                  Browse all features <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>

            {/* hero side-card: feature signature */}
            <aside className="col-span-12 md:col-span-4">
              <div
                className="rounded-2xl p-6 border sn-hair bg-white relative overflow-hidden"
                style={{ boxShadow: `0 30px 60px -30px ${feature.color}55` }}
              >
                <div
                  aria-hidden
                  className="pointer-events-none absolute -top-12 -right-12 h-40 w-40 rounded-full opacity-30"
                  style={{ background: `radial-gradient(circle, ${feature.color}, transparent 70%)` }}
                />
                <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#7878A1]">
                  Feature signature
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <span
                    className="h-12 w-12 rounded-xl inline-flex items-center justify-center text-white"
                    style={{
                      background: `linear-gradient(135deg, ${feature.color}, ${feature.color}cc)`,
                      boxShadow: `0 12px 28px -10px ${feature.color}88`,
                    }}
                  >
                    <Icon className="h-5.5 w-5.5" strokeWidth={2.2} />
                  </span>
                  <div className="min-w-0">
                    <div className="text-[10.5px] uppercase tracking-[0.14em] text-[#7878A1] font-bold leading-none">
                      SabNode · {feature.brand ?? categoryMeta?.label}
                    </div>
                    <div className="mt-1 font-display text-[20px] leading-tight text-[#121126]">
                      {feature.name}
                    </div>
                  </div>
                </div>
                <p className="mt-4 text-[13px] leading-relaxed text-[#4A4A6B]">
                  {feature.tagline}
                </p>

                {feature.metrics && feature.metrics.length > 0 && (
                  <div className="mt-5 grid grid-cols-3 gap-2 border-t sn-hair pt-4">
                    {feature.metrics.slice(0, 3).map(m => (
                      <div key={m.label}>
                        <div className="font-display text-[22px] leading-none text-[#121126]" style={{ color: feature.color }}>
                          {m.value}
                        </div>
                        <div className="mt-1 text-[10.5px] text-[#7878A1] leading-snug">
                          {m.label}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </aside>
          </div>
        </div>
      </section>

      {/* ───────────── Problem ───────────── */}
      <section className="border-t sn-hair">
        <div className="container mx-auto px-4 md:px-6 py-14 md:py-20">
          <div className="grid grid-cols-12 gap-6 md:gap-10">
            <div className="col-span-12 md:col-span-4">
              <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#7878A1]">
                The problem
              </div>
              <h2 className="mt-3 font-display tracking-[-0.02em] text-[28px] md:text-[40px] leading-[1.05] text-[#121126]">
                {feature.problem.title}
              </h2>
            </div>
            <div className="col-span-12 md:col-span-8">
              <div className="text-[16px] md:text-[17px] leading-[1.7] text-[#4A4A6B] space-y-5 max-w-2xl">
                {feature.problem.body.split('\n\n').map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ───────────── Overview (editorial) ───────────── */}
      <section className="border-t sn-hair bg-[#FAF9F4]">
        <div className="container mx-auto px-4 md:px-6 py-14 md:py-20">
          <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#7878A1]">
            What it is
          </div>
          <h2 className="mt-3 font-display tracking-[-0.02em] text-[28px] md:text-[40px] leading-[1.05] text-[#121126] max-w-3xl">
            {feature.name}, in depth.
          </h2>

          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-5 text-[16px] leading-[1.75] text-[#3a3a55]">
            {feature.overview.map((p, i) => (
              <p key={i} className={i === 0 ? 'first-letter:font-display first-letter:text-[44px] first-letter:font-bold first-letter:leading-[0.9] first-letter:float-left first-letter:mr-2 first-letter:mt-1' : ''} style={i === 0 ? { color: '#121126' } : undefined}>
                {p}
              </p>
            ))}
          </div>
        </div>
      </section>

      {/* ───────────── Capabilities grid ───────────── */}
      <section className="border-t sn-hair">
        <div className="container mx-auto px-4 md:px-6 py-14 md:py-20">
          <div className="flex items-end justify-between mb-10 gap-6 flex-wrap">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#7878A1]">
                Capabilities
              </div>
              <h2 className="mt-3 font-display tracking-[-0.02em] text-[28px] md:text-[40px] leading-[1.05] text-[#121126]">
                Everything you get with {feature.name}.
              </h2>
            </div>
            <div className="text-[12px] font-mono tabular-nums text-[#7878A1]">
              {feature.capabilities.length} capabilities
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {feature.capabilities.map((c, i) => (
              <article
                key={c.title}
                className="group relative rounded-2xl p-6 border sn-hair bg-white transition-all hover:bg-white hover:-translate-y-0.5"
                style={{
                  boxShadow: `0 14px 30px -22px rgba(17,17,38,0.18)`,
                }}
              >
                <div
                  aria-hidden
                  className="absolute left-0 top-0 h-full w-[3px] rounded-l-2xl"
                  style={{ background: feature.color }}
                />
                <div className="flex items-baseline gap-3">
                  <span className="font-mono text-[10.5px] tabular-nums text-[#7878A1]">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <h3 className="font-display text-[18px] leading-tight text-[#121126]">
                    {c.title}
                  </h3>
                </div>
                <p className="mt-3 text-[13.5px] leading-[1.65] text-[#4A4A6B]">
                  {c.body}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ───────────── Use cases ───────────── */}
      <section className="border-t sn-hair bg-[#121126] text-white">
        <div className="container mx-auto px-4 md:px-6 py-14 md:py-20">
          <div className="flex items-end justify-between mb-10 gap-6 flex-wrap">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/50">
                Use cases
              </div>
              <h2 className="mt-3 font-display tracking-[-0.02em] text-[28px] md:text-[40px] leading-[1.05] text-white">
                Built for the way teams actually work.
              </h2>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {feature.useCases.map((u, i) => (
              <article
                key={u.title}
                className="relative rounded-2xl p-6 md:p-7 bg-white/[0.04] border border-white/10 hover:bg-white/[0.06] transition-colors"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="inline-flex items-center gap-2">
                    <span
                      className="text-[10px] font-bold uppercase tracking-[0.14em] px-2 py-1 rounded-full"
                      style={{ background: `${feature.color}22`, color: feature.color }}
                    >
                      {u.industry ?? 'General'}
                    </span>
                  </div>
                  <span className="font-mono text-[10px] text-white/40 tabular-nums">
                    Case {String(i + 1).padStart(2, '0')}
                  </span>
                </div>
                <h3 className="mt-4 font-display text-[22px] leading-tight">
                  {u.title}
                </h3>
                <p className="mt-3 text-[14px] leading-[1.7] text-white/70">
                  {u.body}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ───────────── How it works ───────────── */}
      <section className="border-t sn-hair">
        <div className="container mx-auto px-4 md:px-6 py-14 md:py-20">
          <div className="grid grid-cols-12 gap-6 md:gap-10">
            <div className="col-span-12 md:col-span-4">
              <div className="md:sticky md:top-28">
                <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#7878A1]">
                  How it works
                </div>
                <h2 className="mt-3 font-display tracking-[-0.02em] text-[28px] md:text-[40px] leading-[1.05] text-[#121126]">
                  From signup to first send in minutes.
                </h2>
                <p className="mt-4 text-[14px] leading-[1.7] text-[#4A4A6B] max-w-sm">
                  {feature.name} is included on every SabNode workspace. No
                  separate billing, no extra setup — flip it on from your
                  workspace settings.
                </p>
              </div>
            </div>

            <div className="col-span-12 md:col-span-8">
              <ol className="relative">
                <span
                  aria-hidden
                  className="absolute left-[19px] top-2 bottom-2 w-px"
                  style={{ background: `linear-gradient(${feature.color}, ${feature.color}00)` }}
                />
                {feature.howItWorks.map((s, i) => (
                  <li key={s.step} className="relative pl-14 pb-7 last:pb-0">
                    <span
                      className="absolute left-0 top-0 h-10 w-10 rounded-full inline-flex items-center justify-center font-mono text-[12px] font-bold text-white"
                      style={{
                        background: feature.color,
                        boxShadow: `0 8px 20px -8px ${feature.color}`,
                      }}
                    >
                      {s.step}
                    </span>
                    <h3 className="font-display text-[20px] leading-tight text-[#121126]">
                      {s.title}
                    </h3>
                    <p className="mt-2 text-[14.5px] leading-[1.7] text-[#4A4A6B]">
                      {s.body}
                    </p>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </section>

      {/* ───────────── Integrations ───────────── */}
      <section className="border-t sn-hair bg-[#FAF9F4]">
        <div className="container mx-auto px-4 md:px-6 py-14 md:py-20">
          <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#7878A1]">
            Plays well with
          </div>
          <h2 className="mt-3 font-display tracking-[-0.02em] text-[28px] md:text-[40px] leading-[1.05] text-[#121126] max-w-3xl">
            Works with the tools you already ship on.
          </h2>

          <div className="mt-8 flex flex-wrap gap-2">
            {feature.integrations.map(i => (
              <span
                key={i}
                className="inline-flex items-center gap-1.5 h-10 px-4 rounded-full border sn-hair bg-white text-[13px] text-[#121126] font-medium hover:border-[#4F46E5]/30 transition-colors"
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: feature.color }}
                />
                {i}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ───────────── FAQ ───────────── */}
      <section className="border-t sn-hair">
        <div className="container mx-auto px-4 md:px-6 py-14 md:py-20">
          <div className="grid grid-cols-12 gap-6 md:gap-10">
            <div className="col-span-12 md:col-span-4">
              <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#7878A1]">
                Frequently asked
              </div>
              <h2 className="mt-3 font-display tracking-[-0.02em] text-[28px] md:text-[40px] leading-[1.05] text-[#121126]">
                Questions about {feature.name}.
              </h2>
              <p className="mt-4 text-[14px] leading-[1.7] text-[#4A4A6B] max-w-sm">
                Can't find what you're looking for?{' '}
                <Link href="/contact" className="font-semibold text-[#121126] underline decoration-[#4F46E5]/40 underline-offset-2 hover:decoration-[#4F46E5]">
                  Talk to our team
                </Link>
                .
              </p>
            </div>

            <div className="col-span-12 md:col-span-8">
              <div className="rounded-2xl border sn-hair bg-white overflow-hidden divide-y divide-[rgba(17,17,38,0.06)]">
                {feature.faqs.map((f, i) => (
                  <details key={i} className="group">
                    <summary className="cursor-pointer list-none flex items-start justify-between gap-4 px-5 md:px-6 py-4 md:py-5 hover:bg-black/[0.02]">
                      <span className="font-display text-[16px] md:text-[17px] leading-snug text-[#121126]">
                        {f.q}
                      </span>
                      <span
                        className="mt-1 h-7 w-7 rounded-full inline-flex items-center justify-center flex-shrink-0 border sn-hair text-[#4A4A6B] group-open:rotate-180 group-open:bg-[#121126] group-open:text-white transition-all"
                      >
                        <Plus className="h-4 w-4 group-open:hidden" />
                        <Minus className="h-4 w-4 hidden group-open:block" />
                      </span>
                    </summary>
                    <div className="px-5 md:px-6 pb-5 md:pb-6 text-[14.5px] leading-[1.75] text-[#4A4A6B]">
                      {f.a}
                    </div>
                  </details>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ───────────── Related features ───────────── */}
      {related.length > 0 && (
        <section className="border-t sn-hair bg-[#FAF9F4]">
          <div className="container mx-auto px-4 md:px-6 py-14 md:py-20">
            <div className="flex items-end justify-between mb-8 gap-6 flex-wrap">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#7878A1]">
                  Related features
                </div>
                <h2 className="mt-3 font-display tracking-[-0.02em] text-[28px] md:text-[40px] leading-[1.05] text-[#121126]">
                  Stronger when stacked.
                </h2>
              </div>
              <Link
                href="/features"
                className="inline-flex items-center gap-1 text-[12.5px] font-bold uppercase tracking-[0.14em] text-[#4F46E5] hover:text-[#4338CA]"
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
                    <div className="mt-4 font-display text-[16px] leading-tight text-[#121126]">
                      {r.name}
                    </div>
                    <div className="mt-2 text-[12.5px] text-[#4A4A6B] leading-snug line-clamp-3">
                      {r.tagline}
                    </div>
                    <div className="mt-4 inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-[0.14em] text-[#4F46E5] group-hover:text-[#4338CA]">
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
      <section className="relative overflow-hidden bg-[#0b0a1f] text-white">
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
                className="inline-flex h-12 items-center gap-1.5 rounded-full bg-white text-[#121126] px-6 text-[14px] font-bold transition-transform hover:translate-y-[-1px]"
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
