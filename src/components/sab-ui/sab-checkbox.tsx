'use client';

/**
 * SabCheckbox — accessible checkbox with SabUI styling.
 *
 * Built on top of Radix Checkbox so keyboard navigation, focus states,
 * indeterminate support, and form integration all come for free.
 * We own the visuals only.
 *
 *   <SabCheckbox
 *     id="remember-me"
 *     checked={checked}
 *     onCheckedChange={setChecked}
 *   />
 *   <SabLabel htmlFor="remember-me">Remember me</SabLabel>
 */

import * as React from 'react';
import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { Check, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SabCheckboxProps
  extends React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root> {
  size?: 'sm' | 'md';
}

const SIZE = {
  sm: { box: 'h-4 w-4', icon: 'h-3 w-3' },
  md: { box: 'h-[18px] w-[18px]', icon: 'h-3.5 w-3.5' },
} as const;

export const SabCheckbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  SabCheckboxProps
>(({ className, size = 'md', ...props }, ref) => {
  const s = SIZE[size];
  return (
    <CheckboxPrimitive.Root
      ref={ref}
      className={cn(
        'peer group inline-flex shrink-0 items-center justify-center rounded-[5px] border transition-all',
        'focus-visible:outline-none focus-visible:ring-[3px]',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'data-[state=checked]:border-[hsl(var(--sab-primary))] data-[state=checked]:bg-[hsl(var(--sab-primary))]',
        'data-[state=indeterminate]:border-[hsl(var(--sab-primary))] data-[state=indeterminate]:bg-[hsl(var(--sab-primary))]',
        'border-[hsl(var(--sab-border-strong))] bg-[hsl(var(--sab-surface))]',
        'hover:border-[hsl(var(--sab-primary))]',
        s.box,
        className,
      )}
      style={{
        // Focus ring colour
        ['--tw-ring-color' as any]: 'hsl(var(--sab-primary) / 0.35)',
      }}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        className="flex items-center justify-center text-[hsl(var(--sab-primary-fg))]"
        forceMount
      >
        <Check
          className={cn(
            s.icon,
            'opacity-0 transition-opacity group-data-[state=checked]:opacity-100',
          )}
          strokeWidth={3}
        />
        <Minus
          className={cn(
            s.icon,
            'absolute opacity-0 transition-opacity group-data-[state=indeterminate]:opacity-100',
          )}
          strokeWidth={3}
        />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
});
SabCheckbox.displayName = 'SabCheckbox';
