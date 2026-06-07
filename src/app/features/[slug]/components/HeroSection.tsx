'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight, ArrowUpRight, Check, Sparkles } from 'lucide-react';
import { Button, Card } from '@/components/sabcrm/20ui';
import { FeatureHeroPattern } from '@/components/features/FeatureChrome';
import { FEATURE_ICONS } from '@/lib/features/icons';
import type { Feature, FeatureCategoryMeta } from '@/lib/features/types';

interface HeroSectionProps {
  feature: Feature;
  categoryMeta?: FeatureCategoryMeta;
}

export function HeroSection({ feature, categoryMeta }: HeroSectionProps) {
  const Icon = FEATURE_ICONS[feature.iconKey] ?? Sparkles;

  return (
    <section className="ui20 relative overflow-hidden">
      {/* feature-tinted halo */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-0"
        style={{
          backgroundImage: `radial-gradient(60% 60% at 80% 0%, ${feature.color}22, transparent 70%), radial-gradient(50% 50% at 10% 30%, ${feature.tint}, transparent 70%)`,
        }}
      />
      {/* per-category texture overlay - each category gets a distinct pattern */}
      <FeatureHeroPattern category={feature.category} color={feature.color} />
      <div className="container mx-auto px-4 md:px-6 pt-12 md:pt-16 pb-10 md:pb-16 relative">
        <div className="grid grid-cols-12 gap-6 md:gap-10 items-end">
          <div className="col-span-12 md:col-span-8">
            <div className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--st-text-secondary)]">
              <span
                className="h-7 w-7 rounded-[var(--st-radius)] inline-flex items-center justify-center text-white"
                style={{
                  background: `linear-gradient(135deg, ${feature.color}, ${feature.color}cc)`,
                  boxShadow: `0 6px 16px -6px ${feature.color}66`,
                }}
              >
                <Icon className="h-3.5 w-3.5" strokeWidth={2.4} aria-hidden="true" />
              </span>
              {feature.hero.eyebrow}
            </div>

            <h1 className="mt-5 font-display tracking-[-0.03em] text-[40px] md:text-[64px] lg:text-[76px] leading-[1.02] text-[var(--st-text)]">
              {feature.hero.headline}
            </h1>
            <p className="mt-6 text-[16px] md:text-[18px] leading-[1.55] text-[var(--st-text-secondary)] max-w-2xl">
              {feature.hero.subhead}
            </p>

            <ul className="mt-7 grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-w-2xl">
              {feature.hero.bullets.map(b => (
                <li key={b} className="inline-flex items-start gap-2 text-[13.5px] text-[var(--st-text)]">
                  <span
                    className="mt-0.5 h-4 w-4 rounded-full inline-flex items-center justify-center flex-shrink-0"
                    style={{ background: `${feature.color}1a`, color: feature.color }}
                  >
                    <Check className="h-3 w-3" strokeWidth={3} aria-hidden="true" />
                  </span>
                  <span className="leading-snug">{b}</span>
                </li>
              ))}
            </ul>

            <div className="mt-8 flex flex-wrap items-center gap-2.5">
              <Link href="/signup" className="inline-flex">
                <Button
                  size="lg"
                  iconRight={ArrowRight}
                  className="rounded-[var(--st-radius-pill)] text-white"
                  style={{ background: feature.color, boxShadow: `0 10px 24px -10px ${feature.color}` }}
                >
                  Start free
                </Button>
              </Link>
              <Link href="/contact" className="inline-flex">
                <Button variant="secondary" size="lg" className="rounded-[var(--st-radius-pill)]">
                  Talk to sales
                </Button>
              </Link>
              <Link href="/features" className="inline-flex">
                <Button variant="ghost" iconRight={ArrowUpRight}>
                  Browse all features
                </Button>
              </Link>
            </div>
          </div>

          {/* hero side-card: feature signature */}
          <aside className="col-span-12 md:col-span-4">
            <Card
              variant="elevated"
              padding="none"
              className="relative overflow-hidden p-6"
              style={{ boxShadow: `0 30px 60px -30px ${feature.color}55` }}
            >
              <div
                aria-hidden
                className="pointer-events-none absolute -top-12 -right-12 h-40 w-40 rounded-full opacity-30"
                style={{ background: `radial-gradient(circle, ${feature.color}, transparent 70%)` }}
              />
              <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--st-text-tertiary)]">
                Feature signature
              </div>
              <div className="mt-3 flex items-center gap-3">
                <span
                  className="h-12 w-12 rounded-[var(--st-radius-lg)] inline-flex items-center justify-center text-white"
                  style={{
                    background: `linear-gradient(135deg, ${feature.color}, ${feature.color}cc)`,
                    boxShadow: `0 12px 28px -10px ${feature.color}88`,
                  }}
                >
                  <Icon className="h-5 w-5" strokeWidth={2.2} aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <div className="text-[10.5px] uppercase tracking-[0.14em] text-[var(--st-text-tertiary)] font-bold leading-none">
                    SabNode . {feature.brand ?? categoryMeta?.label}
                  </div>
                  <div className="mt-1 font-display text-[20px] leading-tight text-[var(--st-text)]">
                    {feature.name}
                  </div>
                </div>
              </div>
              <p className="mt-4 text-[13px] leading-relaxed text-[var(--st-text-secondary)]">
                {feature.tagline}
              </p>

              {feature.metrics && feature.metrics.length > 0 && (
                <div className="mt-5 grid grid-cols-3 gap-2 border-t border-[var(--st-border)] pt-4 relative group">
                  {/* Real-time status indicator */}
                  <div className="absolute -top-3 -right-2 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity bg-[var(--st-bg)] px-2 py-1 border border-[var(--st-border)] rounded-[var(--st-radius-pill)] shadow-sm z-10">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: feature.color }}></span>
                      <span className="relative inline-flex rounded-full h-2 w-2" style={{ backgroundColor: feature.color }}></span>
                    </span>
                    <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--st-text-tertiary)]">Live</span>
                  </div>

                  {feature.metrics.slice(0, 3).map(m => (
                    <div key={m.label}>
                      <div className="font-display text-[22px] leading-none" style={{ color: feature.color }}>
                        {m.value}
                      </div>
                      <div className="mt-1 text-[10.5px] text-[var(--st-text-tertiary)] leading-snug">
                        {m.label}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </aside>
        </div>
      </div>
    </section>
  );
}
