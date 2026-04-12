'use client';

/**
 * SabSwitch — pill-shaped toggle built on Radix Switch.
 *
 *   <SabSwitch
 *     id="darkmode"
 *     checked={dark}
 *     onCheckedChange={setDark}
 *   />
 */

import * as React from 'react';
import * as SwitchPrimitive from '@radix-ui/react-switch';
import { cn } from '@/lib/utils';

export interface SabSwitchProps
  extends React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root> {
  size?: 'sm' | 'md';
}

const SIZE = {
  sm: { root: 'h-[18px] w-[32px]', thumb: 'h-3.5 w-3.5 data-[state=checked]:translate-x-[14px]' },
  md: { root: 'h-[22px] w-[38px]', thumb: 'h-[18px] w-[18px] data-[state=checked]:translate-x-[16px]' },
} as const;

export const SabSwitch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitive.Root>,
  SabSwitchProps
>(({ className, size = 'md', ...props }, ref) => {
  const s = SIZE[size];
  return (
    <SwitchPrimitive.Root
      ref={ref}
      className={cn(
        'peer inline-flex shrink-0 cursor-pointer items-center rounded-full transition-colors',
        'focus-visible:outline-none focus-visible:ring-[3px]',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'data-[state=checked]:bg-[hsl(var(--sab-primary))]',
        'data-[state=unchecked]:bg-[hsl(var(--sab-border-strong))]',
        s.root,
        className,
      )}
      style={{
        ['--tw-ring-color' as any]: 'hsl(var(--sab-primary) / 0.35)',
        padding: '2px',
      }}
      {...props}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          'pointer-events-none block rounded-full shadow-[0_1px_2px_rgba(0,0,0,0.15)] ring-0 transition-transform duration-200',
          s.thumb,
        )}
        style={{ background: 'hsl(var(--sab-surface))' }}
      />
    </SwitchPrimitive.Root>
  );
});
SabSwitch.displayName = 'SabSwitch';
