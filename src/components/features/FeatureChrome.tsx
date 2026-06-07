import * as React from 'react';
import Link from 'next/link';
import { ArrowRight, ChevronRight } from 'lucide-react';
import { Button } from '@/components/sabcrm/20ui';
import { SabNodeLogo } from '@/components/zoruui-domain/logo';
import { FEATURE_CATEGORIES } from '@/lib/features/types';
import { LandingHeader } from '@/components/landing/landing-header';

/**
 * Top header used across /features routes. Delegates to the shared
 * LandingHeader so feature pages get the same Zoho-style mega menu,
 * mobile drawer, and authenticated-state handling as the rest of the
 * marketing site.
 */
export function FeatureHeader() {
  return <LandingHeader active="features" />;
}

/**
 * Per-category hero background pattern. Gives each feature page a distinct
 * visual texture while keeping the theme cohesive (same color tokens, same
 * blur/halo system). The pattern overlays the existing radial gradient on
 * the /features/[slug] hero.
 */
export function FeatureHeroPattern({
  category,
  color,
}: {
  category: string;
  color: string;
}) {
  const c = encodeURIComponent(color);
  const cFaded = encodeURIComponent(color + '33');

  // Each category gets a distinct SVG pattern, all using `color` so they
  // share the same accent tone as the rest of the feature page.
  const patterns: Record<string, string> = {
    // tight dot grid
    conversations: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='28' height='28'><circle cx='2' cy='2' r='1.2' fill='${c}'/></svg>")`,
    // diagonal stripes
    automation: `repeating-linear-gradient(135deg, ${color}1a 0 1px, transparent 1px 14px)`,
    // crosshatch grid
    'customer-data': `linear-gradient(${color}14 1px, transparent 1px), linear-gradient(90deg, ${color}14 1px, transparent 1px)`,
    // soft wave (concentric arcs)
    growth: `radial-gradient(circle at 50% 100%, ${color}22 0 1px, transparent 1px 18px)`,
    // bar-chart silhouette
    analytics: `repeating-linear-gradient(90deg, ${color}1c 0 2px, transparent 2px 22px)`,
    // hex / triangle tile
    commerce: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='40' height='34'><polygon points='20,2 38,12 38,28 20,38 2,28 2,12' fill='none' stroke='${cFaded}' stroke-width='1'/></svg>")`,
    // monospace bracket grid
    developer: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32'><path d='M4 8 L1 16 L4 24 M28 8 L31 16 L28 24' fill='none' stroke='${cFaded}' stroke-width='1' stroke-linecap='round'/></svg>")`,
  };
  const size: Record<string, string> = {
    'customer-data': '40px 40px',
    growth: '36px 36px',
  };

  const pattern = patterns[category] ?? patterns.conversations;

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-0 opacity-70 [mask-image:radial-gradient(ellipse_70%_60%_at_80%_20%,black_30%,transparent_80%)] [-webkit-mask-image:radial-gradient(ellipse_70%_60%_at_80%_20%,black_30%,transparent_80%)]"
      style={{
        // Runtime-computed: pattern + size are derived from the `category`
        // and `color` props, so they cannot be static Tailwind classes.
        backgroundImage: pattern,
        backgroundSize: size[category],
      }}
    />
  );
}

/**
 * Sub-nav strip under the header listing feature categories.
 * Keeps every feature category one click away, important for SEO interlinking.
 */
export function FeatureCategoryStrip({ active }: { active?: string }) {
  return (
    <div className="border-b sn-hair bg-[var(--st-bg-secondary)]">
      <div className="container mx-auto px-4 md:px-6 overflow-x-auto">
        <div className="flex items-center gap-1 h-11 min-w-max">
          <Link
            href="/features"
            className={`h-8 inline-flex items-center px-3 rounded-[var(--st-radius)] text-[12.5px] font-semibold transition-colors ${
              !active
                ? 'bg-[var(--st-text)] text-[var(--st-bg)]'
                : 'text-[var(--st-text)] hover:text-[var(--st-accent)]'
            }`}
          >
            All
          </Link>
          {FEATURE_CATEGORIES.map(c => {
            const isActive = active === c.id;
            return (
              <Link
                key={c.id}
                href={`/features#${c.id}`}
                className={`h-8 inline-flex items-center px-3 rounded-[var(--st-radius)] text-[12.5px] font-semibold transition-colors ${
                  isActive
                    ? 'bg-[var(--st-text)] text-[var(--st-bg)]'
                    : 'text-[var(--st-text)] hover:text-[var(--st-accent)]'
                }`}
              >
                {c.label}
              </Link>
            );
          })}
          <span className="mx-2 h-4 w-px bg-[var(--st-border)]" aria-hidden />
          <Link
            href="/products"
            className="h-8 inline-flex items-center gap-1 px-3 text-[12px] font-bold uppercase tracking-[0.12em] text-[var(--st-text)] hover:text-[var(--st-accent)]"
          >
            Explore products <ChevronRight className="h-3 w-3" aria-hidden />
          </Link>
        </div>
      </div>
    </div>
  );
}

export function FeatureFooter() {
  return (
    <footer className="border-t sn-hair bg-[var(--st-bg-secondary)]">
      <div className="container mx-auto px-4 md:px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
          <div className="md:col-span-4">
            <SabNodeLogo className="h-7 w-auto" />
            <p className="mt-4 text-[13px] text-[var(--st-text-secondary)] leading-relaxed max-w-xs">
              SabNode is the operating layer for customer conversations. Chat,
              automation, CRM, broadcasts, commerce and AI in one workspace.
            </p>
            <div className="mt-6 flex items-center gap-2">
              <Link href="/signup" className="inline-flex">
                <Button variant="primary" size="md">
                  Start free
                </Button>
              </Link>
              <Link
                href="/contact"
                className="inline-flex h-10 items-center gap-1.5 px-3 text-[13px] font-medium text-[var(--st-text)] hover:text-[var(--st-accent)]"
              >
                Talk to sales <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </Link>
            </div>
          </div>

          {FEATURE_CATEGORIES.slice(0, 4).map(c => (
            <div key={c.id} className="md:col-span-2">
              <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--st-text-secondary)]">
                {c.label}
              </div>
              <Link
                href={`/features#${c.id}`}
                className="mt-3 inline-flex items-center gap-1 text-[13px] text-[var(--st-text)] hover:text-[var(--st-accent)]"
              >
                Browse <ArrowRight className="h-3 w-3" aria-hidden />
              </Link>
            </div>
          ))}
        </div>

        <div className="mt-10 pt-6 border-t sn-hair flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-[12px] text-[var(--st-text-secondary)]">
          <div>© {new Date().getFullYear()} SabNode. All rights reserved.</div>
          <div className="flex items-center gap-4">
            <Link href="/privacy-policy" className="hover:text-[var(--st-accent)]">Privacy</Link>
            <Link href="/terms-and-conditions" className="hover:text-[var(--st-accent)]">Terms</Link>
            <Link href="/status" className="hover:text-[var(--st-accent)]">Status</Link>
            <Link href="/contact" className="hover:text-[var(--st-accent)]">Contact</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
