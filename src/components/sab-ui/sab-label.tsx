'use client';

/**
 * SabLabel — typography-refined form label.
 *
 * Wraps Radix Label for accessible field association. Pairs with
 * `SabField` for the full label + control + help/error pattern.
 */

import * as React from 'react';
import * as LabelPrimitive from '@radix-ui/react-label';
import { cn } from '@/lib/utils';

export interface SabLabelProps
  extends React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root> {
  required?: boolean;
  optional?: boolean;
}

export const SabLabel = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  SabLabelProps
>(({ className, children, required, optional, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn(
      'inline-flex items-center gap-1.5 text-[13px] font-medium leading-none',
      'peer-disabled:cursor-not-allowed peer-disabled:opacity-60',
      className,
    )}
    style={{ color: 'hsl(var(--sab-fg))', fontFamily: 'var(--sab-font-sans)' }}
    {...props}
  >
    {children}
    {required ? (
      <span
        aria-hidden
        className="text-[11px]"
        style={{ color: 'hsl(var(--sab-danger))' }}
        title="Required"
      >
        *
      </span>
    ) : null}
    {optional ? (
      <span
        className="text-[11px] font-normal"
        style={{ color: 'hsl(var(--sab-fg-subtle))' }}
      >
        Optional
      </span>
    ) : null}
  </LabelPrimitive.Root>
));
SabLabel.displayName = 'SabLabel';
