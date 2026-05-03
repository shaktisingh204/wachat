'use client';

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

const base =
  'inline-flex items-center justify-center gap-2 font-medium leading-none select-none transition-[background,border-color,transform,color] duration-150 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2 focus-visible:ring-offset-background';

const variantClass: Record<Variant, string> = {
  obsidian:
    'bg-foreground text-white hover:bg-foreground/90 rounded-full',
  rose:
    'bg-primary text-white hover:bg-primary rounded-full',
  'rose-soft':
    'bg-accent text-accent-foreground hover:brightness-[0.97] rounded-full border border-accent',
  pill:
    'bg-card text-foreground border border-border hover:bg-secondary hover:border-border rounded-full',
  ghost:
    'bg-transparent text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg',
};

const sizeClass: Record<Size, string> = {
  sm:   'h-8  px-3    text-[12.5px]',
  md:   'h-9  px-4    text-[13px]',
  lg:   'h-11 px-5    text-[14px]',
  icon: 'h-9  w-9     text-[13px] p-0',
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
    <button
      ref={ref}
      type={type}
      className={cn(base, variantClass[variant], sizeClass[size], className)}
      {...props}
    >
      {leading ? <span className="flex shrink-0 items-center">{leading}</span> : null}
      {children}
      {trailing ? <span className="flex shrink-0 items-center">{trailing}</span> : null}
    </button>
  ),
);
ClayButton.displayName = 'ClayButton';
