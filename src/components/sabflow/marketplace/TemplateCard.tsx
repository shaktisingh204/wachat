'use client';

/**
 * TemplateCard — C.10.5
 *
 * Displays a single marketplace template card with:
 *   - name, description (clamped to 2 lines), category badge, complexity badge
 *   - install count, author display name
 *   - "Use Template" button that triggers the InstallModal
 *
 * Dark theme matching SabFlow editor. No external UI library — Tailwind only.
 */

import * as React from 'react';
import {
  LuDownload,
  LuUser,
  LuWorkflow,
  LuStar,
  LuZap,
} from 'react-icons/lu';
import { cn } from '@/lib/utils';
import { InstallModal } from './InstallModal';
import type { MarketplaceComplexity } from './MarketplaceFilters';


/* ── Types ──────────────────────────────────────────────────────────────── */

export interface TemplateCardData {
  slug: string;
  name: string;
  description: string;
  /** Primary display category for the card badge. */
  category: string;
  /** Complexity tier — optional; omit for templates that don't declare it. */
  complexity?: MarketplaceComplexity;
  installCount: number;
  rating?: number;
  author?: {
    displayName?: string;
    avatarUrl?: string;
  };
}

interface Props {
  template: TemplateCardData;
}

/* ── Badge helpers ──────────────────────────────────────────────────────── */

const CATEGORY_COLOURS: Record<string, string> = {
  Data: 'bg-sky-950/60 text-sky-300 border-sky-700/40',
  Communication: 'bg-violet-950/60 text-violet-300 border-violet-700/40',
  DevOps: 'bg-orange-950/60 text-orange-300 border-orange-700/40',
  Finance: 'bg-emerald-950/60 text-emerald-300 border-emerald-700/40',
  Productivity: 'bg-amber-950/60 text-amber-300 border-amber-700/40',
  // Legacy registry categories
  Sales: 'bg-blue-950/60 text-blue-300 border-blue-700/40',
  Marketing: 'bg-pink-950/60 text-pink-300 border-pink-700/40',
  Support: 'bg-indigo-950/60 text-indigo-300 border-indigo-700/40',
  Ops: 'bg-teal-950/60 text-teal-300 border-teal-700/40',
  AI: 'bg-purple-950/60 text-purple-300 border-purple-700/40',
  HR: 'bg-rose-950/60 text-rose-300 border-rose-700/40',
  Health: 'bg-green-950/60 text-green-300 border-green-700/40',
  WhatsApp: 'bg-lime-950/60 text-lime-300 border-lime-700/40',
  CRM: 'bg-cyan-950/60 text-cyan-300 border-cyan-700/40',
  'E-commerce': 'bg-yellow-950/60 text-yellow-300 border-yellow-700/40',
};

const COMPLEXITY_COLOURS: Record<string, string> = {
  Starter: 'bg-emerald-950/60 text-emerald-300 border-emerald-700/40',
  Intermediate: 'bg-amber-950/60 text-amber-300 border-amber-700/40',
  Advanced: 'bg-rose-950/60 text-rose-300 border-rose-700/40',
};

function categoryColour(cat: string): string {
  return CATEGORY_COLOURS[cat] ?? 'bg-zinc-800 text-zinc-300 border-zinc-700';
}

function complexityColour(cmp: string): string {
  return COMPLEXITY_COLOURS[cmp] ?? 'bg-zinc-800 text-zinc-300 border-zinc-700';
}

function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

/* ── TemplateCard ───────────────────────────────────────────────────────── */

export function TemplateCard({ template }: Props) {
  const [modalOpen, setModalOpen] = React.useState(false);

  const authorLabel = template.author?.displayName ?? 'SabNode';

  return (
    <>
      <article
        className={cn(
          'group relative flex flex-col rounded-xl border border-zinc-800 bg-zinc-900',
          'shadow-sm hover:shadow-md hover:border-zinc-700',
          'transition-all duration-200 overflow-hidden',
        )}
        aria-label={`Template: ${template.name}`}
      >
        {/* ── Thumbnail strip ──────────────────────────────────────────────── */}
        <div className="relative flex h-[110px] items-center justify-center overflow-hidden border-b border-zinc-800 bg-zinc-950">
          {/* Dot-grid background */}
          <div className="absolute inset-0 opacity-30 [background-image:radial-gradient(circle,#52525b_1px,transparent_1px)] [background-size:18px_18px]" />
          {/* Abstract flow preview */}
          <div className="relative flex items-center gap-2 opacity-60 group-hover:opacity-90 transition-opacity">
            {[0, 1, 2].map((i) => (
              <React.Fragment key={i}>
                <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-800 shadow-sm">
                  <LuWorkflow className="h-4 w-4 text-zinc-400" strokeWidth={1.5} />
                </div>
                {i < 2 && <div className="h-px w-5 bg-zinc-700" />}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* ── Card body ────────────────────────────────────────────────────── */}
        <div className="flex flex-1 flex-col gap-3 p-4">
          {/* Badges row */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={cn(
                'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium',
                categoryColour(template.category),
              )}
            >
              {template.category}
            </span>
            {template.complexity && template.complexity !== 'All' && (
              <span
                className={cn(
                  'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium',
                  complexityColour(template.complexity),
                )}
              >
                {template.complexity}
              </span>
            )}
          </div>

          {/* Name */}
          <p className="text-[13px] font-semibold leading-snug text-zinc-100 truncate" title={template.name}>
            {template.name}
          </p>

          {/* Description — clamped to 2 lines */}
          <p className="text-[11.5px] leading-relaxed text-zinc-400 line-clamp-2 flex-1">
            {template.description}
          </p>

          {/* Meta row */}
          <div className="flex items-center justify-between text-[10.5px] text-zinc-500 mt-auto pt-1 border-t border-zinc-800">
            <span className="flex items-center gap-1">
              <LuUser className="h-3 w-3" />
              <span className="truncate max-w-[100px]">{authorLabel}</span>
            </span>
            <div className="flex items-center gap-2.5">
              {template.rating != null && template.rating > 0 && (
                <span className="flex items-center gap-0.5">
                  <LuStar className="h-3 w-3 fill-amber-400 text-amber-400" />
                  {template.rating.toFixed(1)}
                </span>
              )}
              <span className="flex items-center gap-0.5">
                <LuDownload className="h-3 w-3" />
                {formatCount(template.installCount)}
              </span>
            </div>
          </div>

          {/* CTA */}
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className={cn(
              'mt-1 flex w-full items-center justify-center gap-1.5 rounded-lg border',
              'border-zinc-700 bg-zinc-800 py-2 text-[12px] font-medium text-zinc-200',
              'hover:border-zinc-500 hover:bg-zinc-700 hover:text-white',
              'transition-colors duration-150',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500',
            )}
            aria-label={`Use template ${template.name}`}
          >
            <LuZap className="h-3.5 w-3.5" strokeWidth={2} />
            Use Template
          </button>
        </div>
      </article>

      {/* ── Install modal ────────────────────────────────────────────────── */}
      <InstallModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        templateSlug={template.slug}
        templateName={template.name}
      />
    </>
  );
}
