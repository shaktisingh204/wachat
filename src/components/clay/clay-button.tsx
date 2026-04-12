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
  'inline-flex items-center justify-center gap-2 font-medium leading-none select-none transition-[background,border-color,transform,color] duration-150 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay-rose/30 focus-visible:ring-offset-2 focus-visible:ring-offset-clay-bg';

const variantClass: Record<Variant, string> = {
  obsidian:
    'bg-clay-obsidian text-white hover:bg-clay-obsidian-hover rounded-full',
  rose:
    'bg-clay-rose text-white hover:bg-clay-rose-hover rounded-full',
  'rose-soft':
    'bg-clay-rose-soft text-clay-rose-ink hover:brightness-[0.97] rounded-full border border-clay-rose-soft',
  pill:
    'bg-clay-surface text-clay-ink border border-clay-border hover:bg-clay-surface-2 hover:border-clay-border-strong rounded-full',
  ghost:
    'bg-transparent text-clay-ink-muted hover:text-clay-ink hover:bg-clay-surface-2 rounded-clay-md',
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
