import * as React from 'react';
import { badgeVariants } from '@/components/ui/badge';
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
  'default' | 'secondary' | 'destructive' | 'success' | 'warning' | 'info' | 'outline'
> = {
  neutral: 'secondary',
  rose: 'default',
  'rose-soft': 'secondary',
  obsidian: 'default',
  green: 'success',
  amber: 'warning',
  red: 'destructive',
  blue: 'info',
};

const toneOverride: Partial<Record<Tone, string>> = {
  obsidian:
    'bg-foreground text-background hover:bg-foreground/90 [background:none]',
  'rose-soft':
    'bg-accent text-accent-foreground hover:bg-accent/80',
};

const dotTones: Record<Tone, string> = {
  neutral: 'bg-muted-foreground',
  rose: 'bg-primary-foreground',
  'rose-soft': 'bg-primary',
  obsidian: 'bg-background',
  green: 'bg-[hsl(var(--prism-emerald))]',
  amber: 'bg-[hsl(var(--prism-coral))]',
  red: 'bg-destructive',
  blue: 'bg-[hsl(var(--prism-sky))]',
};

/**
 * ClayBadge — delegates visual styling to shadcn `badgeVariants` while
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
