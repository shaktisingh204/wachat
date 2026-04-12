'use client';

/**
 * SabButton — Aurora-enhanced button.
 *
 * Primary variant now uses a gradient fill (violet → indigo → fuchsia) and
 * lifts on hover with a violet glow shadow. Secondary, ghost, and danger
 * variants stay tasteful — the primary is the one with character so it
 * reads as the hero CTA wherever it appears.
 *
 * Four variants × three sizes × optional icon. Renders as `button` by
 * default or wraps its first child via `asChild`.
 */

import * as React from 'react';
import { type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export type SabButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type SabButtonSize = 'sm' | 'md' | 'lg';

export interface SabButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'color'> {
  variant?: SabButtonVariant;
  size?: SabButtonSize;
  leftIcon?: LucideIcon;
  rightIcon?: LucideIcon;
  loading?: boolean;
  asChild?: boolean;
}

const SIZE_CLASS: Record<SabButtonSize, string> = {
  sm: 'h-8 px-3 text-[12.5px] gap-1.5 rounded-[8px]',
  md: 'h-9 px-3.5 text-[13.5px] gap-1.5 rounded-[10px]',
  lg: 'h-11 px-5 text-[14.5px] gap-2 rounded-[12px]',
};

const ICON_SIZE: Record<SabButtonSize, string> = {
  sm: 'h-3.5 w-3.5',
  md: 'h-4 w-4',
  lg: 'h-[18px] w-[18px]',
};

function getVariantStyle(variant: SabButtonVariant, hover = false): React.CSSProperties {
  switch (variant) {
    case 'primary':
      return {
        background: 'var(--sab-gradient-primary)',
        color: 'hsl(var(--sab-primary-fg))',
        border: '1px solid hsl(var(--sab-primary))',
        boxShadow: hover
          ? 'var(--sab-glow-primary), 0 1px 0 0 rgba(255,255,255,0.18) inset'
          : 'var(--sab-shadow-sm), 0 1px 0 0 rgba(255,255,255,0.14) inset',
        transform: hover ? 'translateY(-1px)' : 'translateY(0)',
      };
    case 'secondary':
      return {
        background: hover ? 'hsl(var(--sab-bg-subtle))' : 'hsl(var(--sab-surface))',
        color: 'hsl(var(--sab-fg))',
        border: `1px solid hsl(var(--sab-border)${hover ? '-strong' : ''})`,
        boxShadow: 'var(--sab-shadow-xs)',
      };
    case 'danger':
      return {
        background: 'var(--sab-gradient-danger)',
        color: '#fff',
        border: '1px solid hsl(var(--sab-danger))',
        boxShadow: hover ? 'var(--sab-glow-danger)' : 'var(--sab-shadow-xs)',
        transform: hover ? 'translateY(-1px)' : 'translateY(0)',
      };
    case 'ghost':
    default:
      return {
        background: hover ? 'hsl(var(--sab-bg-subtle))' : 'transparent',
        color: hover ? 'hsl(var(--sab-fg))' : 'hsl(var(--sab-fg-muted))',
        border: '1px solid transparent',
      };
  }
}

export const SabButton = React.forwardRef<HTMLButtonElement, SabButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      leftIcon: LeftIcon,
      rightIcon: RightIcon,
      loading,
      disabled,
      asChild,
      children,
      ...props
    },
    ref,
  ) => {
    const classes = cn(
      'sab-btn relative inline-flex shrink-0 select-none items-center justify-center font-medium transition-all duration-200',
      'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-offset-0',
      'disabled:cursor-not-allowed disabled:opacity-60',
      SIZE_CLASS[size],
      className,
    );
    const style: React.CSSProperties = {
      ...getVariantStyle(variant),
      fontFamily: 'var(--sab-font-sans)',
    };

    const content = (
      <>
        {loading ? (
          <span
            className={cn('animate-spin rounded-full border-[1.5px] border-current border-t-transparent', ICON_SIZE[size])}
            aria-hidden
          />
        ) : LeftIcon ? (
          <LeftIcon className={ICON_SIZE[size]} strokeWidth={2} />
        ) : null}
        <span className="truncate">{children}</span>
        {!loading && RightIcon ? <RightIcon className={ICON_SIZE[size]} strokeWidth={2} /> : null}
      </>
    );

    if (asChild && React.isValidElement(children)) {
      const child = children as React.ReactElement<any>;
      return React.cloneElement(child, {
        className: cn(classes, child.props.className),
        style: { ...style, ...(child.props.style || {}) },
        ref,
        ...props,
      });
    }

    return (
      <button
        ref={ref}
        className={classes}
        style={style}
        disabled={disabled || loading}
        onMouseEnter={(e) => {
          const btn = e.currentTarget;
          if (btn.disabled) return;
          Object.assign(btn.style, getVariantStyle(variant, true));
        }}
        onMouseLeave={(e) => {
          const btn = e.currentTarget;
          Object.assign(btn.style, getVariantStyle(variant, false));
        }}
        {...props}
      >
        {content}
      </button>
    );
  },
);
SabButton.displayName = 'SabButton';
