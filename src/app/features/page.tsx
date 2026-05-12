import * as React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, ArrowUpRight, ChevronRight, Sparkles } from 'lucide-react';

import { FEATURES, FEATURES_BY_CATEGORY } from '@/lib/features/catalog';
import { FEATURE_CATEGORIES } from '@/lib/features/types';
import { FEATURE_ICONS } from '@/lib/features/icons';
import { FeatureHeader, FeatureCategoryStrip, FeatureFooter } from '@/components/features/FeatureChrome';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://sabnode.com';

export const metadata: Metadata = {
  title: 'All Features — Conversations, Automation, CRM, Commerce | SabNode',
  description:
    'Every SabNode feature, organised. Shared inbox, WhatsApp API, flow builder, AI Studio, broadcasts, CRM, payments, webhooks and more — built into one operating layer.',
  keywords: [
    'WhatsApp Business API platform',
    'shared inbox for WhatsApp',
    'flow builder no-code',
    'WhatsApp broadcast tool',
    'CRM for conversations',
    'SabNode features',
    'WhatsApp automation India',
    'unified customer messaging',
  ],
  alternates: { canonical: `${SITE_URL}/features` },
  openGraph: {
    title: 'All Features | SabNode',
    description:
      'Every SabNode feature, organised — conversations, automation, CRM, growth, analytics, commerce and developer.',
    url: `${SITE_URL}/features`,
    siteName: 'SabNode',
    type: 'website',
  },
};

export default function FeaturesIndexPage() {
  const totalCount = FEATURES.length;

  const collectionLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'SabNode Features',
    description:
      'Every SabNode product feature, organised by category — from shared inbox to webhooks.',
    url: `${SITE_URL}/features`,
    hasPart: FEATURES.map(f => ({
      '@type': 'SoftwareApplication',
      name: f.name,
      url: `${SITE_URL}/features/${f.slug}`,
      description: f.tagline,
    })),
  };

  return (
    <div className="sn-root relative min-h-screen overflow-x-clip antialiased bg-white text-[#121126]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionLd) }} />

      <FeatureHeader />
      <FeatureCategoryStrip />

      {/* ───────────── Hero ───────────── */}
      <section className="relative">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-0"
          style={{
            backgroundImage:
              'radial-gradient(60% 70% at 80% 0%, #8B5CF622, transparent 70%),' +
              'radial-gradient(50% 60% at 5% 20%, #4F46E51a, transparent 70%)',
          }}
        />
        <div className="container mx-auto px-4 md:px-6 pt-14 md:pt-20 pb-12 md:pb-16 relative">
          <div className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-[#4A4A6B]">
            <Sparkles className="h-3.5 w-3.5 text-[#4F46E5]" />
            All features · {totalCount} live
          </div>

          <h1 className="mt-5 font-display tracking-[-0.03em] text-[44px] md:text-[72px] lg:text-[88px] leading-[1.0] text-[#121126] max-w-4xl">
            One workspace.{' '}
            <span className="sn-gradient-text">{totalCount} features</span>{' '}
            that move customers forward.
          </h1>
          <p className="mt-6 text-[16px] md:text-[18px] leading-[1.6] text-[#4A4A6B] max-w-2xl">
            SabNode replaces the seven tools you stitched together with one
            shared operating layer for chat, automation, CRM, broadcasts,
            commerce and AI. Every feature below is included on every plan,
            documented end-to-end, and built to compose with the rest.
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-2.5">
            <Link href="/signup" className="sn-btn-primary inline-flex h-11 items-center gap-1.5 rounded-full px-5 text-[13.5px] font-semibold">
              Start free <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/contact" className="inline-flex h-11 items-center gap-1.5 rounded-full px-5 border sn-hair text-[13.5px] font-semibold text-[#121126] hover:bg-black/[0.03]">
              Talk to sales
            </Link>
            <Link href="/pricing" className="inline-flex h-11 items-center gap-1.5 px-2 text-[13px] font-medium text-[#4A4A6B] hover:text-[#121126]">
              See pricing <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </section>

      {/* ───────────── Category jump-grid ───────────── */}
      <section className="border-t sn-hair bg-[#FAF9F4]">
        <div className="container mx-auto px-4 md:px-6 py-10 md:py-14">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
            {FEATURE_CATEGORIES.map(c => {
              const count = (FEATURES_BY_CATEGORY[c.id] ?? []).length;
              return (
                <a
                  key={c.id}
                  href={`#${c.id}`}
                  className="group rounded-xl p-4 bg-white border sn-hair hover:-translate-y-0.5 transition-all"
                  style={{ boxShadow: `0 10px 22px -18px ${c.accent}55` }}
                >
                  <span
                    className="h-2 w-2 rounded-full inline-block"
                    style={{ background: c.accent }}
                  />
                  <div className="mt-3 font-display text-[15px] leading-tight text-[#121126]">
                    {c.label}
                  </div>
                  <div className="mt-1 text-[10.5px] font-mono tabular-nums text-[#7878A1]">
                    {count} features
                  </div>
                </a>
              );
            })}
          </div>
        </div>
      </section>

      {/* ───────────── Category sections ───────────── */}
      {FEATURE_CATEGORIES.map(cat => {
        const items = FEATURES_BY_CATEGORY[cat.id] ?? [];
        if (items.length === 0) return null;
        return (
          <section key={cat.id} id={cat.id} className="border-t sn-hair scroll-mt-24">
            <div className="container mx-auto px-4 md:px-6 py-14 md:py-20">
              <div className="grid grid-cols-12 gap-6 md:gap-10 mb-10">
                <div className="col-span-12 md:col-span-5">
                  <div
                    className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em]"
                    style={{ color: cat.accent }}
                  >
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: cat.accent }} />
                    {cat.label}
                  </div>
                  <h2 className="mt-3 font-display tracking-[-0.02em] text-[32px] md:text-[48px] leading-[1.02] text-[#121126]">
                    {cat.blurb}
                  </h2>
                </div>
                <div className="col-span-12 md:col-span-7 md:pl-10 md:border-l sn-hair">
                  <div className="text-[12px] font-mono tabular-nums text-[#7878A1]">
                    {String(items.length).padStart(2, '0')} features
                  </div>
                  <div className="mt-2 text-[14.5px] leading-[1.7] text-[#4A4A6B]">
                    Each feature ships with a dedicated long-form page covering
                    the problem we solve, capabilities, real-world use cases,
                    integrations and FAQ — so your team can pre-qualify and your
                    finance partner can sign off without a sales call.
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {items.map(f => {
                  const Icon = FEATURE_ICONS[f.iconKey] ?? Sparkles;
                  return (
                    <Link
                      key={f.slug}
                      href={`/features/${f.slug}`}
                      className="group rounded-2xl p-5 md:p-6 bg-white border sn-hair hover:-translate-y-0.5 transition-all relative overflow-hidden"
                      style={{ boxShadow: `0 14px 30px -22px ${f.color}55` }}
                    >
                      <div
                        aria-hidden
                        className="absolute -top-12 -right-12 h-32 w-32 rounded-full opacity-[0.10] group-hover:opacity-30 transition-opacity"
                        style={{ background: `radial-gradient(circle, ${f.color}, transparent 70%)` }}
                      />
                      <div className="flex items-center gap-3 relative">
                        <span
                          className="h-10 w-10 rounded-lg inline-flex items-center justify-center text-white flex-shrink-0"
                          style={{
                            background: `linear-gradient(135deg, ${f.color}, ${f.color}cc)`,
                            boxShadow: `0 6px 16px -6px ${f.color}66`,
                          }}
                        >
                          <Icon className="h-4.5 w-4.5" strokeWidth={2.2} />
                        </span>
                        <div className="min-w-0">
                          {f.brand && (
                            <div className="text-[9.5px] font-bold uppercase tracking-[0.14em] text-[#7878A1] leading-none">
                              SabNode · {f.brand}
                            </div>
                          )}
                          <div className="mt-0.5 font-display text-[18px] leading-tight text-[#121126] truncate">
                            {f.name}
                          </div>
                        </div>
                      </div>
                      <p className="mt-4 text-[13px] leading-[1.6] text-[#4A4A6B] line-clamp-3 min-h-[3.6em] relative">
                        {f.tagline}
                      </p>
                      <div className="mt-5 inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-[0.14em] text-[#4F46E5] group-hover:text-[#4338CA] relative">
                        Read more <ChevronRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          </section>
        );
      })}

      {/* ───────────── Final CTA ───────────── */}
      <section className="relative overflow-hidden bg-[#0b0a1f] text-white">
        <div
          aria-hidden
          className="absolute inset-0 -z-0 opacity-70"
          style={{
            backgroundImage:
              'radial-gradient(60% 80% at 20% 20%, #4F46E555, transparent 60%),' +
              'radial-gradient(40% 80% at 90% 80%, #8B5CF655, transparent 60%)',
          }}
        />
        <div className="container mx-auto px-4 md:px-6 py-16 md:py-24 relative">
          <div className="max-w-3xl">
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/55">
              Operate · Grow · Repeat
            </div>
            <h2 className="mt-3 font-display tracking-[-0.02em] text-[34px] md:text-[54px] leading-[1.02]">
              Run every customer conversation on one stack.
            </h2>
            <p className="mt-5 text-[16px] md:text-[18px] leading-[1.6] text-white/70 max-w-2xl">
              Stop subscribing to seven tools that don't talk. SabNode includes
              every feature on this page — on every plan — with a 14-day trial
              and no card required.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-2.5">
              <Link href="/signup" className="inline-flex h-12 items-center gap-1.5 rounded-full bg-white text-[#121126] px-6 text-[14px] font-bold">
                Start free <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/contact" className="inline-flex h-12 items-center gap-1.5 rounded-full border border-white/20 bg-white/5 px-6 text-[14px] font-semibold text-white hover:bg-white/10">
                Book a demo
              </Link>
            </div>
          </div>
        </div>
      </section>

      <FeatureFooter />
    </div>
  );
}
