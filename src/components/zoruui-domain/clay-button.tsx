'use client';

import { Button, type ButtonProps } from '@/components/sabcrm/20ui/compat';
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
const variantToZoru: Record<Variant, ButtonProps['variant']> = {
  obsidian: 'default',
  rose: 'default',
  'rose-soft': 'secondary',
  pill: 'outline',
  ghost: 'ghost',
};

const variantOverride: Record<Variant, string> = {
  // Use `[background-image:none]` (not `[background:none]`) to strip the
  // shadcn `default` gradient WITHOUT also wiping the `bg-[var(--st-text)]` color.
  // The shorthand `background` resets all background props, which had been
  // rendering the obsidian CTA as a blank/invisible pill.
  obsidian:
    'rounded-full bg-[var(--st-text)] text-[var(--st-bg-secondary)] [background-image:none] hover:bg-[var(--st-text)]/90 hover:[background-image:none] shadow-none',
  rose:
    'rounded-full bg-[var(--st-text)] text-white [background-image:none] hover:bg-[var(--st-text)]/90 hover:[background-image:none] shadow-none',
  'rose-soft':
    'rounded-full bg-[var(--st-bg-muted)] text-[var(--st-text)] border-accent hover:bg-[var(--st-bg-muted)]/80 hover:border-accent',
  pill:
    'rounded-full bg-[var(--st-bg-secondary)] text-[var(--st-text)] hover:bg-[var(--st-bg-muted)]',
  ghost:
    'rounded-lg text-[var(--st-text-secondary)] hover:text-[var(--st-text)] hover:bg-[var(--st-bg-muted)]',
};

const sizeToZoru: Record<Size, ButtonProps['size']> = {
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
