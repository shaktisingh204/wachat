import { badgeVariants } from '@/components/sabcrm/20ui';
import * as React from 'react';

import { cn } from '@/lib/utils';

type Tone =
  | 'neutral'
  | 'rose'
  | 'rose-soft'
  | 'obsidian'
  | 'green'
  | 'amber'
  | 'red'
  | 'blue';

export interface ClayBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
  dot?: boolean;
}

/**
 * Map each ClayBadge tone onto a shadcn Badge variant. Two clay tones
 * (`obsidian`, `rose-soft`) have no 1:1 shadcn variant, so we layer
 * a small override on top of the closest match.
 */
const toneToVariant: Record<
  Tone,
  'default' | 'secondary' | 'danger' | 'success' | 'warning' | 'info' | 'outline'
> = {
  neutral: 'secondary',
  rose: 'default',
  'rose-soft': 'secondary',
  obsidian: 'default',
  green: 'success',
  amber: 'warning',
  red: 'danger',
  blue: 'info',
};

const toneOverride: Partial<Record<Tone, string>> = {
  obsidian:
    'bg-[var(--st-text)] text-[var(--st-bg-secondary)] hover:bg-[var(--st-text)]/90 [background:none]',
  'rose-soft':
    'bg-[var(--st-bg-muted)] text-[var(--st-text)] hover:bg-[var(--st-bg-muted)]/80',
};

const dotTones: Record<Tone, string> = {
  neutral: 'bg-[var(--st-text)]',
  rose: 'bg-[var(--st-text-inverted)]',
  'rose-soft': 'bg-[var(--st-text)]',
  obsidian: 'bg-[var(--st-bg-secondary)]',
  green: 'bg-[var(--st-text)]',
  amber: 'bg-[var(--st-text)]',
  red: 'bg-[var(--st-text)]',
  blue: 'bg-[var(--st-text)]',
};

/**
 * ClayBadge — delegates visual styling to `badgeVariants` while
 * keeping the original `<span>` element + `HTMLSpanElement` ref contract
 * that callers depend on.
 */
export const ClayBadge = React.forwardRef<HTMLSpanElement, ClayBadgeProps>(
  ({ className, tone = 'neutral', dot = false, children, ...props }, ref) => (
    <span
      ref={ref}
      className={cn(
        badgeVariants({ variant: toneToVariant[tone] }),
        // ClayBadge's traditional sizing: 24px tall, slightly larger horizontal pad.
        'h-6 px-2.5 text-[11.5px] gap-1.5 leading-none whitespace-nowrap',
        toneOverride[tone],
        className,
      )}
      {...props}
    >
      {dot ? (
        <span
          aria-hidden
          className={cn('h-1.5 w-1.5 rounded-full', dotTones[tone])}
        />
      ) : null}
      {children}
    </span>
  ),
);
ClayBadge.displayName = 'ClayBadge';
