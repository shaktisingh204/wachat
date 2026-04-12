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
  neutral:    'bg-clay-surface-2 text-clay-ink-muted border-clay-border',
  rose:       'bg-clay-rose text-white border-clay-rose',
  'rose-soft':'bg-clay-rose-soft text-clay-rose-ink border-clay-rose-soft',
  obsidian:   'bg-clay-obsidian text-white border-clay-obsidian',
  green:      'bg-clay-green-soft text-clay-green border-clay-green-soft',
  amber:      'bg-clay-amber-soft text-clay-amber border-clay-amber-soft',
  red:        'bg-clay-red-soft text-clay-red border-clay-red-soft',
  blue:       'bg-clay-blue-soft text-clay-blue border-clay-blue-soft',
};

const dotTones: Record<Tone, string> = {
  neutral:    'bg-clay-ink-soft',
  rose:       'bg-white',
  'rose-soft':'bg-clay-rose',
  obsidian:   'bg-white',
  green:      'bg-clay-green',
  amber:      'bg-clay-amber',
  red:        'bg-clay-red',
  blue:       'bg-clay-blue',
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
