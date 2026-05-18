import * as React from 'react';
import { ZoruCard, type CardProps } from '@/components/zoruui';
import { cn } from '@/lib/utils';

type Variant = 'default' | 'soft' | 'floating' | 'outline';

export interface ClayCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: Variant;
  padded?: boolean;
}

/**
 * ClayCard — delegates to the shadcn `ZoruCard` primitive.
 *
 * The shadcn ZoruCard is **borderless** by design (shadow-only depth), so the
 * mapping here intentionally adds NO border classes; instead each variant
 * tunes the shadow level / fill via the existing shadcn cva variants.
 *
 *   default  → ZoruCard variant `default`     (cream surface, soft shadow on hover)
 *   soft     → ZoruCard variant `default` + secondary fill for nested rows
 *   floating → ZoruCard variant `elevated`    (lifted shadow)
 *   outline  → ZoruCard variant `default`     (no border, no extra shadow)
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
    <ZoruCard
      ref={ref}
      variant={variantToCard[variant]}
      className={cn(variantExtra[variant], padded && 'p-5', className)}
      {...props}
    >
      {children}
    </ZoruCard>
  ),
);
ClayCard.displayName = 'ClayCard';
