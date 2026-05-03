import * as React from 'react';
import { Card, type CardProps } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type Variant = 'default' | 'soft' | 'floating' | 'outline';

export interface ClayCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: Variant;
  padded?: boolean;
}

/**
 * ClayCard — delegates to the shadcn `Card` primitive.
 *
 * The shadcn Card is **borderless** by design (shadow-only depth), so the
 * mapping here intentionally adds NO border classes; instead each variant
 * tunes the shadow level / fill via the existing shadcn cva variants.
 *
 *   default  → Card variant `default`     (cream surface, soft shadow on hover)
 *   soft     → Card variant `default` + secondary fill for nested rows
 *   floating → Card variant `elevated`    (lifted shadow)
 *   outline  → Card variant `default`     (no border, no extra shadow)
 */
const variantToCard: Record<Variant, CardProps['variant']> = {
  default: 'default',
  soft: 'default',
  floating: 'elevated',
  outline: 'default',
};

const variantExtra: Record<Variant, string> = {
  default: '',
  soft: 'bg-secondary',
  floating: '',
  outline: '',
};

export const ClayCard = React.forwardRef<HTMLDivElement, ClayCardProps>(
  ({ className, variant = 'default', padded = true, children, ...props }, ref) => (
    <Card
      ref={ref}
      variant={variantToCard[variant]}
      className={cn(variantExtra[variant], padded && 'p-5', className)}
      {...props}
    >
      {children}
    </Card>
  ),
);
ClayCard.displayName = 'ClayCard';
