'use client';

/**
 * 20ui — Button + IconButton.
 *
 * The canonical pressable. Variants map to modifier classes; the unstyled call
 * (`<Button>Save</Button>`) is already a polished secondary button. Emil polish:
 * scale-on-press, custom ease-out transitions; a11y: native <button>, visible
 * focus ring, `aria-busy` while loading, icon-only buttons require `aria-label`.
 */

import * as React from 'react';
import type { LucideIcon } from 'lucide-react';

import './button.css';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'ghost'
  | 'outline'
  | 'danger'
  /** Premium SabNode brand-gradient pill (amber to rose) with a hover sheen. */
  | 'gradient';
export type ButtonSize = 'sm' | 'md' | 'lg';

/** Back-compat (shadcn) variant/size names accepted and normalized to 20ui's. */
export type ButtonVariantCompat = ButtonVariant | 'default' | 'destructive' | 'link';
export type ButtonSizeCompat = ButtonSize | 'default' | 'icon';
const BTN_VARIANT_ALIAS: Record<string, ButtonVariant> = {
  default: 'primary',
  destructive: 'danger',
  link: 'ghost',
};
const BTN_SIZE_ALIAS: Record<string, ButtonSize> = { default: 'md', icon: 'md' };

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariantCompat;
  size?: ButtonSizeCompat;
  /** Icon before the label. */
  iconLeft?: LucideIcon;
  /** Icon after the label. */
  iconRight?: LucideIcon;
  /** Show a spinner + disable while an async action runs. */
  loading?: boolean;
  /** Stretch to the container width. */
  block?: boolean;
}

const ICON_SIZE: Record<ButtonSize, number> = { sm: 13, md: 14, lg: 16 };

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = 'secondary',
      size = 'md',
      iconLeft: IconLeft,
      iconRight: IconRight,
      loading = false,
      block = false,
      className,
      children,
      type = 'button',
      disabled,
      ...rest
    },
    ref,
  ) {
    const v: ButtonVariant = BTN_VARIANT_ALIAS[variant as string] ?? (variant as ButtonVariant);
    const sz: ButtonSize = BTN_SIZE_ALIAS[size as string] ?? (size as ButtonSize);
    const cls = [
      'u-btn',
      `u-btn--${v}`,
      `u-btn--${sz}`,
      block && 'u-btn--block',
      loading && 'is-loading',
      className,
    ]
      .filter(Boolean)
      .join(' ');
    const s = ICON_SIZE[sz];
    return (
      <button
        ref={ref}
        type={type}
        className={cls}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...rest}
      >
        {variant === 'gradient' ? <span className="u-btn__sheen" aria-hidden="true" /> : null}
        {loading ? <span className="u-btn__spinner" aria-hidden="true" /> : null}
        {!loading && IconLeft ? <IconLeft size={s} aria-hidden="true" /> : null}
        {children != null ? <span className="u-btn__label">{children}</span> : null}
        {!loading && IconRight ? <IconRight size={s} aria-hidden="true" /> : null}
      </button>
    );
  },
);

export interface IconButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Required accessible name (icon-only control). */
  label: string;
  icon: LucideIcon;
  variant?: ButtonVariant;
  size?: ButtonSize;
}

/** A square, icon-only pressable. `label` is mandatory for accessibility. */
export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton(
    { label, icon: Icon, variant = 'ghost', size = 'md', className, type = 'button', ...rest },
    ref,
  ) {
    const cls = [
      'u-btn',
      'u-icon-btn',
      `u-btn--${variant}`,
      `u-icon-btn--${size}`,
      className,
    ]
      .filter(Boolean)
      .join(' ');
    return (
      <button ref={ref} type={type} className={cls} aria-label={label} title={label} {...rest}>
        <Icon size={ICON_SIZE[size]} aria-hidden="true" />
      </button>
    );
  },
);

/** A segmented row of buttons that share borders (e.g. a toolbar cluster). */
export function ButtonGroup({
  className,
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>): React.JSX.Element {
  return (
    <div role="group" className={['u-btn-group', className].filter(Boolean).join(' ')} {...rest}>
      {children}
    </div>
  );
}

export default Button;
