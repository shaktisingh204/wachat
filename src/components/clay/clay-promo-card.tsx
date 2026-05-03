'use client';

import * as React from 'react';
import { LuTag } from 'react-icons/lu';
import { Card } from '@/components/ui/card';
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
 * ClayPromoCard — gradient-mesh "You're now in PRO mode!" sidebar block.
 * Uses the shadcn `Card` primitive for the surface, and styles the
 * mesh hero via `style={{ background: 'var(--prism-mesh)' }}` (with a
 * radial-gradient fallback for environments without the prism token).
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
    <Card
      variant="default"
      className={cn('rounded-2xl overflow-hidden p-0', className)}
    >
      {/* Large gradient-mesh hero */}
      <div className="relative h-[128px] w-full overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            background:
              'var(--prism-mesh, ' +
              'radial-gradient(at 18% 18%, hsl(340 90% 85%) 0px, transparent 52%),' +
              'radial-gradient(at 82% 22%, hsl(262 85% 88%) 0px, transparent 52%),' +
              'radial-gradient(at 68% 82%, hsl(198 90% 86%) 0px, transparent 55%),' +
              'radial-gradient(at 22% 80%, hsl(28  95% 86%) 0px, transparent 55%),' +
              'hsl(var(--card)))',
            filter: 'saturate(1.05)',
          }}
        />
      </div>

      <div className="p-4">
        <h4 className="text-sm font-semibold tracking-tight text-foreground leading-tight">
          {title}
        </h4>
        {description ? (
          <p className="mt-1 text-[11.5px] leading-[1.45] text-muted-foreground">
            {description}
          </p>
        ) : null}

        {discountLabel ? (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-secondary px-2.5 py-1.5">
            <LuTag
              className="h-3 w-3 text-primary"
              strokeWidth={2.25}
            />
            <span className="text-[11px] font-semibold text-accent-foreground">
              {discountLabel}
            </span>
            {discountNote ? (
              <span className="text-[10.5px] text-muted-foreground">
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
    </Card>
  );
}
