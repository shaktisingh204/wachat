'use client';

import * as React from 'react';

import { Card, Button } from '@/components/sabcrm/20ui';
import { Tag } from 'lucide-react';

import { cn } from '@/lib/utils';

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
 * ClayPromoCard - gradient-mesh "You're now in PRO mode!" sidebar block.
 * Uses the 20ui Card primitive for the surface and renders the decorative
 * mesh hero with a Tailwind radial-gradient stack built from 20ui tokens.
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
      variant="outlined"
      padding="none"
      className={cn('overflow-hidden rounded-[var(--st-radius-lg)]', className)}
    >
      {/* Decorative gradient-mesh hero */}
      <div
        aria-hidden="true"
        className="relative h-[128px] w-full overflow-hidden bg-[var(--st-bg)] bg-[radial-gradient(at_18%_18%,hsl(340_90%_85%)_0px,transparent_52%),radial-gradient(at_82%_22%,hsl(262_85%_88%)_0px,transparent_52%),radial-gradient(at_68%_82%,hsl(198_90%_86%)_0px,transparent_55%),radial-gradient(at_22%_80%,hsl(28_95%_86%)_0px,transparent_55%)] [filter:saturate(1.05)]"
      />

      <div className="p-4">
        <h4 className="text-sm font-semibold leading-tight tracking-tight text-[var(--st-text)]">
          {title}
        </h4>
        {description ? (
          <p className="mt-1 text-[11.5px] leading-[1.45] text-[var(--st-text-secondary)]">
            {description}
          </p>
        ) : null}

        {discountLabel ? (
          <div className="mt-3 flex items-center gap-2 rounded-[var(--st-radius)] bg-[var(--st-bg-muted)] px-2.5 py-1.5">
            <Tag
              aria-hidden="true"
              className="h-3 w-3 text-[var(--st-text)]"
              strokeWidth={2.25}
            />
            <span className="text-[11px] font-semibold text-[var(--st-text)]">
              {discountLabel}
            </span>
            {discountNote ? (
              <span className="text-[10.5px] text-[var(--st-text-secondary)]">
                {discountNote}
              </span>
            ) : null}
          </div>
        ) : null}

        <Button
          variant="primary"
          size="sm"
          block
          onClick={onCtaClick}
          className="mt-3 justify-center"
        >
          {ctaLabel}
        </Button>
      </div>
    </Card>
  );
}
