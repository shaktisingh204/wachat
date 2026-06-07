'use client';

/**
 * TemplateCard - C.10.5
 *
 * Displays a single marketplace template card with:
 *   - name, description (clamped to 2 lines), category badge, complexity badge
 *   - install count, author display name
 *   - "Use Template" button that triggers the InstallModal
 *
 * Pure 20ui: Card / Badge / Button primitives with --st-* tokens.
 */

import * as React from 'react';
import { Download, User, Workflow, Star, Zap } from 'lucide-react';

import { Card, Badge, Button } from '@/components/sabcrm/20ui';
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
  /** Complexity tier, optional; omit for templates that don't declare it. */
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

/* ── Helpers ────────────────────────────────────────────────────────────── */

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
      <Card
        variant="interactive"
        padding="none"
        className="group relative flex flex-col overflow-hidden"
        aria-label={`Template: ${template.name}`}
      >
        {/* ── Thumbnail strip ──────────────────────────────────────────────── */}
        <div className="relative flex h-[110px] items-center justify-center overflow-hidden border-b border-[var(--st-border)] bg-[var(--st-bg-secondary)]">
          {/* Dot-grid background */}
          <div className="absolute inset-0 opacity-30 [background-image:radial-gradient(circle,var(--st-text-tertiary)_1px,transparent_1px)] [background-size:18px_18px]" />
          {/* Abstract flow preview */}
          <div className="relative flex items-center gap-2 opacity-60 transition-opacity group-hover:opacity-90">
            {[0, 1, 2].map((i) => (
              <React.Fragment key={i}>
                <div className="flex h-9 w-9 items-center justify-center rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg)] shadow-sm">
                  <Workflow className="h-4 w-4 text-[var(--st-text-secondary)]" strokeWidth={1.5} aria-hidden="true" />
                </div>
                {i < 2 && <div className="h-px w-5 bg-[var(--st-border)]" />}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* ── Card body ────────────────────────────────────────────────────── */}
        <div className="flex flex-1 flex-col gap-3 p-4">
          {/* Badges row */}
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone="neutral" kind="soft">{template.category}</Badge>
            {template.complexity && template.complexity !== 'All' && (
              <Badge tone="accent" kind="soft">{template.complexity}</Badge>
            )}
          </div>

          {/* Name */}
          <p
            className="truncate text-[13px] font-semibold leading-snug text-[var(--st-text)]"
            title={template.name}
          >
            {template.name}
          </p>

          {/* Description, clamped to 2 lines */}
          <p className="line-clamp-2 flex-1 text-[11.5px] leading-relaxed text-[var(--st-text-secondary)]">
            {template.description}
          </p>

          {/* Meta row */}
          <div className="mt-auto flex items-center justify-between border-t border-[var(--st-border)] pt-1 text-[10.5px] text-[var(--st-text-tertiary)]">
            <span className="flex items-center gap-1">
              <User className="h-3 w-3" aria-hidden="true" />
              <span className="max-w-[100px] truncate">{authorLabel}</span>
            </span>
            <div className="flex items-center gap-2.5">
              {template.rating != null && template.rating > 0 && (
                <span className="flex items-center gap-0.5">
                  <Star className="h-3 w-3 fill-[var(--st-warn)] text-[var(--st-warn)]" aria-hidden="true" />
                  {template.rating.toFixed(1)}
                </span>
              )}
              <span className="flex items-center gap-0.5">
                <Download className="h-3 w-3" aria-hidden="true" />
                {formatCount(template.installCount)}
              </span>
            </div>
          </div>

          {/* CTA */}
          <Button
            variant="primary"
            size="sm"
            block
            iconLeft={Zap}
            onClick={() => setModalOpen(true)}
            className={cn('mt-1')}
            aria-label={`Use template ${template.name}`}
          >
            Use Template
          </Button>
        </div>
      </Card>

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
