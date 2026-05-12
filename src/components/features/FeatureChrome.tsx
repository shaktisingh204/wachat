import * as React from 'react';
import Link from 'next/link';
import { ArrowRight, ChevronRight } from 'lucide-react';
import { SabNodeLogo } from '@/components/wabasimplify/logo';
import { FEATURE_CATEGORIES } from '@/lib/features/types';

/**
 * Top header used across /features routes. Server component, no JS.
 * Matches the SabUI aesthetic of the landing page (hairline border, white
 * blurred background, indigo primary).
 */
export function FeatureHeader() {
  return (
    <header className="sticky top-0 z-40 w-full border-b sn-hair bg-white/88 backdrop-blur-xl">
      <div className="container mx-auto px-4 md:px-6 flex h-16 items-center gap-6">
        <Link href="/" className="flex items-center gap-2 flex-shrink-0">
          <SabNodeLogo className="h-7 w-auto" />
        </Link>

        <nav className="hidden md:flex items-center gap-1 ml-4 rounded-full border border-black/[0.06] bg-black/[0.02] p-1">
          <Link href="/features" className="inline-flex items-center gap-1 h-8 px-3.5 rounded-full text-[13px] font-semibold text-[#4F46E5] border border-[#4F46E5]/30 bg-white shadow-sm">
            Features
          </Link>
          <Link href="/products" className="inline-flex items-center gap-1 h-8 px-3.5 rounded-full text-[13px] font-semibold text-[#121126] hover:text-[#4F46E5]">
            Products
          </Link>
          <Link href="/enterprise" className="inline-flex items-center gap-1 h-8 px-3.5 rounded-full text-[13px] font-semibold text-[#121126] hover:text-[#4F46E5]">
            Enterprise
          </Link>
          <Link href="/customers" className="inline-flex items-center gap-1 h-8 px-3.5 rounded-full text-[13px] font-semibold text-[#121126] hover:text-[#4F46E5]">
            Customers
          </Link>
          <Link href="/resources" className="inline-flex items-center gap-1 h-8 px-3.5 rounded-full text-[13px] font-semibold text-[#121126] hover:text-[#4F46E5]">
            Resources
          </Link>
          <Link href="/pricing" className="inline-flex items-center gap-1 h-8 px-3.5 rounded-full text-[13px] font-semibold text-[#121126] hover:text-[#4F46E5]">
            Pricing
          </Link>
        </nav>

        <div className="flex items-center gap-1.5 ml-auto">
          <Link href="/login" className="hidden sm:inline-flex h-9 items-center px-3 text-[13.5px] font-semibold text-[#121126] hover:text-[#4F46E5] transition-colors">
            Sign In
          </Link>
          <Link href="/signup" className="sn-btn-primary inline-flex h-9 items-center rounded-full px-4 text-[13.5px] font-semibold">
            Start free <ArrowRight className="h-3.5 w-3.5 ml-1" />
          </Link>
        </div>
      </div>
    </header>
  );
}

/**
 * Sub-nav strip under the header listing feature categories.
 * Keeps every feature category one click away — important for SEO interlinking.
 */
export function FeatureCategoryStrip({ active }: { active?: string }) {
  return (
    <div className="border-b sn-hair bg-[#FAF9F4]">
      <div className="container mx-auto px-4 md:px-6 overflow-x-auto">
        <div className="flex items-center gap-1 h-11 min-w-max">
          <Link
            href="/features"
            className={`h-8 inline-flex items-center px-3 rounded-full text-[12.5px] font-semibold transition-colors ${
              !active ? 'bg-[#121126] text-white' : 'text-[#4A4A6B] hover:text-[#121126]'
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
                className={`h-8 inline-flex items-center px-3 rounded-full text-[12.5px] font-semibold transition-colors ${
                  isActive
                    ? 'bg-[#121126] text-white'
                    : 'text-[#4A4A6B] hover:text-[#121126]'
                }`}
                style={isActive ? undefined : undefined}
              >
                {c.label}
              </Link>
            );
          })}
          <span className="mx-2 h-4 w-px bg-black/10" />
          <Link
            href="/products"
            className="h-8 inline-flex items-center gap-1 px-3 text-[12px] font-bold uppercase tracking-[0.12em] text-[#4F46E5] hover:text-[#4338CA]"
          >
            Explore products <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
    </div>
  );
}

export function FeatureFooter() {
  return (
    <footer className="border-t sn-hair bg-[#FAF9F4]">
      <div className="container mx-auto px-4 md:px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
          <div className="md:col-span-4">
            <SabNodeLogo className="h-7 w-auto" />
            <p className="mt-4 text-[13px] text-[#4A4A6B] leading-relaxed max-w-xs">
              SabNode is the operating layer for customer conversations — chat,
              automation, CRM, broadcasts, commerce and AI in one workspace.
            </p>
            <div className="mt-6 flex items-center gap-2">
              <Link href="/signup" className="sn-btn-primary inline-flex h-10 items-center gap-1.5 rounded-full px-5 text-[13px] font-semibold">
                Start free
              </Link>
              <Link href="/contact" className="inline-flex h-10 items-center gap-1.5 px-3 text-[13px] font-medium text-[#4A4A6B] hover:text-[#121126]">
                Talk to sales <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>

          {FEATURE_CATEGORIES.slice(0, 4).map(c => (
            <div key={c.id} className="md:col-span-2">
              <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#7878A1]">
                {c.label}
              </div>
              <Link href={`/features#${c.id}`} className="mt-3 block text-[13px] text-[#4A4A6B] hover:text-[#121126]">
                Browse →
              </Link>
            </div>
          ))}
        </div>

        <div className="mt-10 pt-6 border-t sn-hair flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-[12px] text-[#7878A1]">
          <div>© {new Date().getFullYear()} SabNode. All rights reserved.</div>
          <div className="flex items-center gap-4">
            <Link href="/privacy-policy" className="hover:text-[#121126]">Privacy</Link>
            <Link href="/terms-and-conditions" className="hover:text-[#121126]">Terms</Link>
            <Link href="/status" className="hover:text-[#121126]">Status</Link>
            <Link href="/contact" className="hover:text-[#121126]">Contact</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
