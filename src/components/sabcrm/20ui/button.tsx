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
import { Slot } from '@radix-ui/react-slot';

import { renderIcon, type IconProp } from './_icon';

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
  iconLeft?: IconProp;
  /** Icon after the label. */
  iconRight?: IconProp;
  /** Show a spinner + disable while an async action runs. */
  loading?: boolean;
  /** Stretch to the container width. */
  block?: boolean;
  /**
   * Render the single child as the button (Radix Slot), merging button
   * styling onto it — e.g. `<Button asChild><Link …>…</Link></Button>`.
   * Consumed here so it never leaks onto the DOM node.
   */
  asChild?: boolean;
}

const ICON_SIZE: Record<ButtonSize, number> = { sm: 13, md: 14, lg: 16 };

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = 'secondary',
      size = 'md',
      iconLeft,
      iconRight,
      loading = false,
      block = false,
      asChild = false,
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

    // asChild: render the caller's single child as the button via Slot. Native
    // <button> attributes (type/disabled/aria-busy) are omitted so they don't
    // land on a non-button child (e.g. an <a>), and the decoration spans are
    // skipped since Slot requires exactly one child.
    if (asChild) {
      return (
        <Slot ref={ref} className={cls} {...rest}>
          {children}
        </Slot>
      );
    }

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
        {!loading ? renderIcon(iconLeft, { size: s, 'aria-hidden': true }) : null}
        {children != null ? <span className="u-btn__label">{children}</span> : null}
        {!loading ? renderIcon(iconRight, { size: s, 'aria-hidden': true }) : null}
      </button>
    );
  },
);

export interface IconButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Required accessible name (icon-only control). */
  label: string;
  icon: IconProp;
  variant?: ButtonVariant;
  size?: ButtonSize;
}

/** A square, icon-only pressable. `label` is mandatory for accessibility. */
export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton(
    { label, icon, variant = 'ghost', size = 'md', className, type = 'button', ...rest },
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
        {renderIcon(icon, { size: ICON_SIZE[size], 'aria-hidden': true })}
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
