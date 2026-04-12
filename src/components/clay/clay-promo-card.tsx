'use client';

import * as React from 'react';
import { LuTag } from 'react-icons/lu';
import { cn } from '@/lib/utils';
import { ClayButton } from './clay-button';

export interface ClayPromoCardProps {
  eyebrow?: string;
  title: string;
  description?: string;
  discountLabel?: string;
  discountNote?: string;
  ctaLabel?: string;
  onCtaClick?: () => void;
  className?: string;
}

/**
 * ClayPromoCard — the gradient-mesh "You're now in PRO mode!" sidebar block.
 *
 * Reference anatomy:
 *   ┌──────────────────────┐
 *   │                      │   ~44% of card height — large mesh
 *   │     (mesh)           │
 *   ├──────────────────────┤
 *   │ You're now in PRO…   │   title (14px semibold)
 *   │ Enjoy advanced…      │   description (11px muted)
 *   │ [🏷  -50% · note]    │   discount chip w/ tag icon
 *   │ [ Explore PRO tools ]│   full-width obsidian CTA
 *   └──────────────────────┘
 */
export function ClayPromoCard({
  title,
  description,
  discountLabel,
  discountNote,
  ctaLabel = 'Explore PRO tools',
  onCtaClick,
  className,
}: ClayPromoCardProps) {
  return (
    <div
      className={cn(
        'rounded-clay-xl border border-clay-border bg-clay-surface overflow-hidden',
        className,
      )}
    >
      {/* Large gradient-mesh hero — ~130px tall (≈ 44% of card) */}
      <div className="relative h-[128px] w-full overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(at 18% 18%, hsl(340 90% 85%) 0px, transparent 52%),' +
              'radial-gradient(at 82% 22%, hsl(262 85% 88%) 0px, transparent 52%),' +
              'radial-gradient(at 68% 82%, hsl(198 90% 86%) 0px, transparent 55%),' +
              'radial-gradient(at 22% 80%, hsl(28  95% 86%) 0px, transparent 55%),' +
              'hsl(var(--clay-surface))',
            filter: 'saturate(1.05)',
          }}
        />
        {/* subtle noise overlay to avoid flat gradients reading synthetic */}
        <div
          className="absolute inset-0 mix-blend-multiply opacity-30"
          style={{ backgroundImage: 'var(--clay-grain)', backgroundSize: '180px' }}
        />
      </div>

      <div className="p-4">
        <h4 className="text-[14px] font-semibold tracking-tight text-clay-ink leading-tight">
          {title}
        </h4>
        {description ? (
          <p className="mt-1 text-[11.5px] leading-[1.45] text-clay-ink-muted">
            {description}
          </p>
        ) : null}

        {discountLabel ? (
          <div className="mt-3 flex items-center gap-2 rounded-clay-md border border-clay-border bg-clay-surface-2 px-2.5 py-1.5">
            <LuTag
              className="h-3 w-3 text-clay-rose"
              strokeWidth={2.25}
            />
            <span className="text-[11px] font-semibold text-clay-rose-ink">
              {discountLabel}
            </span>
            {discountNote ? (
              <span className="text-[10.5px] text-clay-ink-muted">
                {discountNote}
              </span>
            ) : null}
          </div>
        ) : null}

        <ClayButton
          variant="obsidian"
          size="sm"
          onClick={onCtaClick}
          className="mt-3 w-full justify-center"
        >
          {ctaLabel}
        </ClayButton>
      </div>
    </div>
  );
}
