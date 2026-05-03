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

const tones: Record<Tone, string> = {
  neutral:    'bg-secondary text-muted-foreground border-border',
  rose:       'bg-primary text-white border-primary',
  'rose-soft':'bg-accent text-accent-foreground border-accent',
  obsidian:   'bg-foreground text-white border-foreground',
  green:      'bg-emerald-50 text-emerald-500 border-emerald-50',
  amber:      'bg-amber-50 text-amber-500 border-amber-50',
  red:        'bg-rose-50 text-destructive border-rose-50',
  blue:       'bg-sky-50 text-sky-500 border-sky-50',
};

const dotTones: Record<Tone, string> = {
  neutral:    'bg-muted-foreground',
  rose:       'bg-white',
  'rose-soft':'bg-primary',
  obsidian:   'bg-white',
  green:      'bg-emerald-500',
  amber:      'bg-amber-500',
  red:        'bg-destructive',
  blue:       'bg-sky-500',
};

export const ClayBadge = React.forwardRef<HTMLSpanElement, ClayBadgeProps>(
  ({ className, tone = 'neutral', dot = false, children, ...props }, ref) => (
    <span
      ref={ref}
      className={cn(
        'inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full border text-[11.5px] font-medium leading-none whitespace-nowrap',
        tones[tone],
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
