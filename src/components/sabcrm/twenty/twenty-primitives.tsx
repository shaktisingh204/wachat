import * as React from 'react';
import type { LucideIcon } from 'lucide-react';

import '@/styles/sabcrm-twenty.css';

/* =========================================================================
   TwentyButton
   ========================================================================= */
export type TwentyButtonVariant = 'primary' | 'secondary' | 'ghost';

export type TwentyButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: TwentyButtonVariant;
  icon?: LucideIcon;
};

export function TwentyButton({
  variant = 'secondary',
  icon: Icon,
  className,
  children,
  type = 'button',
  ...rest
}: TwentyButtonProps): React.JSX.Element {
  const classes = ['st-btn', `st-btn--${variant}`, className]
    .filter(Boolean)
    .join(' ');
  return (
    <button type={type} className={classes} {...rest}>
      {Icon ? <Icon size={14} aria-hidden="true" /> : null}
      {children}
    </button>
  );
}

/* =========================================================================
   TwentyChip
   ========================================================================= */
export type TwentyChipProps = {
  label: string;
  color?: string;
  className?: string;
};

export function TwentyChip({ label, color, className }: TwentyChipProps): React.JSX.Element {
  const classes = ['st-chip', className].filter(Boolean).join(' ');
  return (
    <span className={classes}>
      {color ? (
        <span className="st-chip__dot" style={{ background: color }} aria-hidden="true" />
      ) : null}
      <span className="st-chip__label">{label}</span>
    </span>
  );
}

/* =========================================================================
   TwentyAvatar
   ========================================================================= */
export type TwentyAvatarSize = 'sm' | 'md' | 'lg';

export type TwentyAvatarProps = {
  name: string;
  src?: string;
  size?: TwentyAvatarSize;
  className?: string;
};

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.charAt(0);
  return `${parts[0]!.charAt(0)}${parts[parts.length - 1]!.charAt(0)}`;
}

export function TwentyAvatar({
  name,
  src,
  size = 'md',
  className,
}: TwentyAvatarProps): React.JSX.Element {
  const classes = ['st-avatar', `st-avatar--${size}`, className]
    .filter(Boolean)
    .join(' ');
  return (
    <span className={classes} title={name}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={name} />
      ) : (
        initialsFromName(name)
      )}
    </span>
  );
}

/* =========================================================================
   TwentyPageHeader
   ========================================================================= */
export type TwentyPageHeaderProps = {
  title: string;
  icon?: LucideIcon;
  actions?: React.ReactNode;
  className?: string;
};

export function TwentyPageHeader({
  title,
  icon: Icon,
  actions,
  className,
}: TwentyPageHeaderProps): React.JSX.Element {
  const classes = ['st-page-header', className].filter(Boolean).join(' ');
  return (
    <header className={classes}>
      {Icon ? (
        <span className="st-page-header__icon" aria-hidden="true">
          <Icon size={16} />
        </span>
      ) : null}
      <h1 className="st-page-header__title">{title}</h1>
      {actions ? <div className="st-page-header__actions">{actions}</div> : null}
    </header>
  );
}
