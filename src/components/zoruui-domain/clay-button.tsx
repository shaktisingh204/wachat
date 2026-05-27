'use client';

import { Button, type ZoruButtonProps } from '@/components/zoruui';
import * as React from 'react';

import { cn } from '@/lib/utils';

type Variant =
  | 'obsidian'       // primary dark CTA — "Create", "View candidates →"
  | 'rose'           // secondary rose CTA — "Create New Prompt"
  | 'rose-soft'      // tertiary rose — muted info/notification actions
  | 'pill'           // ghost pill (topbar — Search, Add person, Notifications)
  | 'ghost';         // borderless nav trigger

type Size = 'sm' | 'md' | 'lg' | 'icon';

export interface ClayButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
}

/**
 * Map clay variants → Button variants. ClayButton is now a thin
 * back-compat wrapper around Button for the public-facing pages
 * and dashboards that still reference it.
 */
const variantToZoru: Record<Variant, ZoruButtonProps['variant']> = {
  obsidian: 'default',
  rose: 'default',
  'rose-soft': 'secondary',
  pill: 'outline',
  ghost: 'ghost',
};

const variantOverride: Record<Variant, string> = {
  // Use `[background-image:none]` (not `[background:none]`) to strip the
  // shadcn `default` gradient WITHOUT also wiping the `bg-zoru-ink` color.
  // The shorthand `background` resets all background props, which had been
  // rendering the obsidian CTA as a blank/invisible pill.
  obsidian:
    'rounded-full bg-zoru-ink text-zoru-surface [background-image:none] hover:bg-zoru-ink/90 hover:[background-image:none] shadow-none',
  rose:
    'rounded-full bg-zoru-ink text-white [background-image:none] hover:bg-zoru-ink/90 hover:[background-image:none] shadow-none',
  'rose-soft':
    'rounded-full bg-zoru-surface-2 text-zoru-ink border-accent hover:bg-zoru-surface-2/80 hover:border-accent',
  pill:
    'rounded-full bg-zoru-surface text-zoru-ink hover:bg-zoru-surface-2',
  ghost:
    'rounded-lg text-zoru-ink-muted hover:text-zoru-ink hover:bg-zoru-surface-2',
};

const sizeToZoru: Record<Size, ZoruButtonProps['size']> = {
  sm: 'sm',
  md: 'md',
  lg: 'lg',
  icon: 'icon',
};

export const ClayButton = React.forwardRef<HTMLButtonElement, ClayButtonProps>(
  (
    {
      className,
      variant = 'pill',
      size = 'md',
      leading,
      trailing,
      children,
      type = 'button',
      ...props
    },
    ref,
  ) => (
    <Button
      ref={ref}
      type={type}
      variant={variantToZoru[variant]}
      size={sizeToZoru[size]}
      className={cn('gap-2 font-medium leading-none', variantOverride[variant], className)}
      {...props}
    >
      {leading ? (
        <span className="flex shrink-0 items-center">{leading}</span>
      ) : null}
      {children}
      {trailing ? (
        <span className="flex shrink-0 items-center">{trailing}</span>
      ) : null}
    </Button>
  ),
);
ClayButton.displayName = 'ClayButton';
