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

   Mirrors twenty-ui's <Avatar>: a small square-rounded media chip that shows
   an image (`src`) when available, with a deterministic initials fallback when
   the image is absent OR fails to load. People avatars use `shape="round"`
   (a circle); company logos + everything else default to Twenty's 4px-radius
   rounded square. `size="xs"` is the 14px in-cell size used by RELATION / ACTOR
   chips and table cells.
   ========================================================================= */
export type TwentyAvatarSize = 'xs' | 'sm' | 'md' | 'lg';
export type TwentyAvatarShape = 'square' | 'round';

export type TwentyAvatarProps = {
  /** Display name — drives the initials fallback + accessible title. */
  name: string;
  /** Image / logo URL. Falls back to initials when missing or it 404s. */
  src?: string;
  size?: TwentyAvatarSize;
  /** `round` = people (circle); `square` = companies/logos (default). */
  shape?: TwentyAvatarShape;
  /** Override the initials (e.g. single glyph for actors). */
  initials?: string;
  className?: string;
};

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.charAt(0).toUpperCase();
  return `${parts[0]!.charAt(0)}${parts[parts.length - 1]!.charAt(0)}`.toUpperCase();
}

export function TwentyAvatar({
  name,
  src,
  size = 'md',
  shape = 'square',
  initials,
  className,
}: TwentyAvatarProps): React.JSX.Element {
  const classes = [
    'st-avatar',
    `st-avatar--${size}`,
    `st-avatar--${shape}`,
    className,
  ]
    .filter(Boolean)
    .join(' ');
  const fallback = initials ?? initialsFromName(name);
  return (
    <span className={classes} title={name} aria-label={name}>
      {/* Initials sit underneath; a successful image paints over them. If the
          image fails to load, onError hides it so the initials show through —
          this keeps the component free of React state so it stays SSR-safe. */}
      <span className="st-avatar__initials" aria-hidden={src ? 'true' : undefined}>
        {fallback}
      </span>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={name}
          className="st-avatar__img"
          loading="lazy"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />
      ) : null}
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
