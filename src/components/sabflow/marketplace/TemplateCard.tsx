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
  Data: 'bg-[var(--st-text)]/60 text-[var(--st-text-secondary)] border-[var(--st-border)]/40',
  Communication: 'bg-[var(--st-text)]/60 text-[var(--st-text-secondary)] border-[var(--st-border)]/40',
  DevOps: 'bg-[var(--st-text)]/60 text-[var(--st-text-secondary)] border-[var(--st-border)]/40',
  Finance: 'bg-[var(--st-text)]/60 text-[var(--st-text-secondary)] border-[var(--st-border)]/40',
  Productivity: 'bg-[var(--st-text)]/60 text-[var(--st-text-secondary)] border-[var(--st-border)]/40',
  // Legacy registry categories
  Sales: 'bg-[var(--st-text)]/60 text-[var(--st-text-secondary)] border-[var(--st-border)]/40',
  Marketing: 'bg-[var(--st-text)]/60 text-[var(--st-text-secondary)] border-[var(--st-border)]/40',
  Support: 'bg-[var(--st-text)]/60 text-[var(--st-text-secondary)] border-[var(--st-border)]/40',
  Ops: 'bg-[var(--st-text)]/60 text-[var(--st-text-secondary)] border-[var(--st-border)]/40',
  AI: 'bg-[var(--st-text)]/60 text-[var(--st-text-secondary)] border-[var(--st-border)]/40',
  HR: 'bg-[var(--st-text)]/60 text-[var(--st-text-secondary)] border-[var(--st-border)]/40',
  Health: 'bg-[var(--st-text)]/60 text-[var(--st-text-secondary)] border-[var(--st-border)]/40',
  WhatsApp: 'bg-[var(--st-text)]/60 text-[var(--st-text-secondary)] border-[var(--st-border)]/40',
  CRM: 'bg-[var(--st-text)]/60 text-[var(--st-text-secondary)] border-[var(--st-border)]/40',
  'E-commerce': 'bg-[var(--st-text)]/60 text-[var(--st-text-secondary)] border-[var(--st-border)]/40',
};

const COMPLEXITY_COLOURS: Record<string, string> = {
  Starter: 'bg-[var(--st-text)]/60 text-[var(--st-text-secondary)] border-[var(--st-border)]/40',
  Intermediate: 'bg-[var(--st-text)]/60 text-[var(--st-text-secondary)] border-[var(--st-border)]/40',
  Advanced: 'bg-[var(--st-text)]/60 text-[var(--st-text-secondary)] border-[var(--st-border)]/40',
};

function categoryColour(cat: string): string {
  return CATEGORY_COLOURS[cat] ?? 'bg-[var(--st-text)] text-[var(--st-text-secondary)] border-[var(--st-border)]';
}

function complexityColour(cmp: string): string {
  return COMPLEXITY_COLOURS[cmp] ?? 'bg-[var(--st-text)] text-[var(--st-text-secondary)] border-[var(--st-border)]';
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
          'group relative flex flex-col rounded-xl border border-[var(--st-border)] bg-[var(--st-text)]',
          'shadow-sm hover:shadow-md hover:border-[var(--st-border)]',
          'transition-all duration-200 overflow-hidden',
        )}
        aria-label={`Template: ${template.name}`}
      >
        {/* ── Thumbnail strip ──────────────────────────────────────────────── */}
        <div className="relative flex h-[110px] items-center justify-center overflow-hidden border-b border-[var(--st-border)] bg-[var(--st-text)]">
          {/* Dot-grid background */}
          <div className="absolute inset-0 opacity-30 [background-image:radial-gradient(circle,#52525b_1px,transparent_1px)] [background-size:18px_18px]" />
          {/* Abstract flow preview */}
          <div className="relative flex items-center gap-2 opacity-60 group-hover:opacity-90 transition-opacity">
            {[0, 1, 2].map((i) => (
              <React.Fragment key={i}>
                <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--st-border)] bg-[var(--st-text)] shadow-sm">
                  <LuWorkflow className="h-4 w-4 text-[var(--st-text-secondary)]" strokeWidth={1.5} />
                </div>
                {i < 2 && <div className="h-px w-5 bg-[var(--st-text)]" />}
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
          <p className="text-[13px] font-semibold leading-snug text-white truncate" title={template.name}>
            {template.name}
          </p>

          {/* Description — clamped to 2 lines */}
          <p className="text-[11.5px] leading-relaxed text-[var(--st-text-secondary)] line-clamp-2 flex-1">
            {template.description}
          </p>

          {/* Meta row */}
          <div className="flex items-center justify-between text-[10.5px] text-[var(--st-text)] mt-auto pt-1 border-t border-[var(--st-border)]">
            <span className="flex items-center gap-1">
              <LuUser className="h-3 w-3" />
              <span className="truncate max-w-[100px]">{authorLabel}</span>
            </span>
            <div className="flex items-center gap-2.5">
              {template.rating != null && template.rating > 0 && (
                <span className="flex items-center gap-0.5">
                  <LuStar className="h-3 w-3 fill-[var(--st-text-secondary)] text-[var(--st-text-secondary)]" />
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
              'border-[var(--st-border)] bg-[var(--st-text)] py-2 text-[12px] font-medium text-white',
              'hover:border-[var(--st-border)] hover:bg-[var(--st-text)] hover:text-white',
              'transition-colors duration-150',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--st-border)]',
            )}
            aria-label={`Use template ${template.name}`}
          >
            <LuZap className="h-3.5 w-3.5" strokeWidth={2} />
            Use Template
          </button>
        </div>
      </article>

      {modalOpen && (
        <InstallModal
          onClose={() => setModalOpen(false)}
          templateId={template.slug}
          templateName={template.name}
        />
      )}
    </>
  );
}
