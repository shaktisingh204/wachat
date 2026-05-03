import * as React from 'react';
import { cn } from '@/lib/utils';

type Variant = 'default' | 'soft' | 'floating' | 'outline';

export interface ClayCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: Variant;
  padded?: boolean;
}

/**
 * ClayCard — the pure-white rounded card used across the reference.
 *
 * - `default`  white surface + hairline border + quiet shadow (most cards)
 * - `soft`     cream inset surface for nested content (e.g. the numbered rows)
 * - `floating` lifts on the page with a larger shadow
 * - `outline`  border-only, no shadow (for inline chips / lightweight groupings)
 */
export const ClayCard = React.forwardRef<HTMLDivElement, ClayCardProps>(
  ({ className, variant = 'default', padded = true, children, ...props }, ref) => {
    const variants: Record<Variant, string> = {
      default:
        'bg-card border border-border shadow-sm rounded-xl',
      soft:
        'bg-secondary border border-border rounded-xl',
      floating:
        'bg-card border border-border shadow-md rounded-xl',
      outline:
        'bg-card border border-border rounded-xl',
    };

    return (
      <div
        ref={ref}
        className={cn(variants[variant], padded && 'p-5', className)}
        {...props}
      >
        {children}
      </div>
    );
  },
);
ClayCard.displayName = 'ClayCard';
