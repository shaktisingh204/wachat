'use client';

/**
 * SabRadioGroup / SabRadioItem — accessible radio buttons.
 *
 * Built on top of Radix RadioGroup.
 *
 *   <SabRadioGroup value={plan} onValueChange={setPlan}>
 *     <label className="flex items-center gap-2">
 *       <SabRadioItem value="starter" id="starter" />
 *       <SabLabel htmlFor="starter">Starter</SabLabel>
 *     </label>
 *     ...
 *   </SabRadioGroup>
 */

import * as React from 'react';
import * as RadioGroupPrimitive from '@radix-ui/react-radio-group';
import { cn } from '@/lib/utils';

export const SabRadioGroup = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root>
>(({ className, ...props }, ref) => (
  <RadioGroupPrimitive.Root
    ref={ref}
    className={cn('grid gap-2', className)}
    {...props}
  />
));
SabRadioGroup.displayName = 'SabRadioGroup';

export const SabRadioItem = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Item>
>(({ className, ...props }, ref) => (
  <RadioGroupPrimitive.Item
    ref={ref}
    className={cn(
      'peer h-[18px] w-[18px] shrink-0 rounded-full border transition-colors',
      'focus-visible:outline-none focus-visible:ring-[3px]',
      'disabled:cursor-not-allowed disabled:opacity-50',
      'border-[hsl(var(--sab-border-strong))] bg-[hsl(var(--sab-surface))]',
      'hover:border-[hsl(var(--sab-primary))]',
      'data-[state=checked]:border-[hsl(var(--sab-primary))]',
      className,
    )}
    style={{
      ['--tw-ring-color' as any]: 'hsl(var(--sab-primary) / 0.35)',
    }}
    {...props}
  >
    <RadioGroupPrimitive.Indicator className="flex h-full w-full items-center justify-center">
      <span
        className="h-2 w-2 rounded-full"
        style={{ background: 'hsl(var(--sab-primary))' }}
      />
    </RadioGroupPrimitive.Indicator>
  </RadioGroupPrimitive.Item>
));
SabRadioItem.displayName = 'SabRadioItem';
