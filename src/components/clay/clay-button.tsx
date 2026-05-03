'use client';

import * as React from 'react';
import { Button, type ButtonProps } from '@/components/ui/button';
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
 * Map clay variants → shadcn Button variants.
 * `obsidian` and `rose` are SabNode's primary CTAs; both lean on
 * shadcn's `default` (which is the indigo gradient) — we then layer
 * tone-specific overrides so the buttons read the way the design
 * reference expects.
 */
const variantToButton: Record<Variant, ButtonProps['variant']> = {
  obsidian: 'default',
  rose: 'default',
  'rose-soft': 'outline',
  pill: 'outline',
  ghost: 'ghost',
};

const variantOverride: Record<Variant, string> = {
  obsidian:
    'rounded-full bg-foreground text-background [background:none] hover:bg-foreground/90 hover:[background:none] shadow-none',
  rose:
    'rounded-full bg-primary text-primary-foreground [background:none] hover:bg-primary/90 hover:[background:none] shadow-none',
  'rose-soft':
    'rounded-full bg-accent text-accent-foreground border-accent hover:bg-accent/80 hover:border-accent',
  pill:
    'rounded-full bg-card text-foreground hover:bg-secondary',
  ghost:
    'rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary',
};

const sizeClass: Record<Size, string> = {
  sm: 'h-8 px-3 text-[12.5px]',
  md: 'h-9 px-4 text-[13px]',
  lg: 'h-11 px-5 text-[14px]',
  icon: 'h-9 w-9 p-0 text-[13px]',
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
      noMotion
      variant={variantToButton[variant]}
      className={cn(
        // gap and leading-none keep the leading/trailing icon spacing tight
        'gap-2 font-medium leading-none',
        sizeClass[size],
        variantOverride[variant],
        className,
      )}
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
