'use client';

/**
 * 20ui — Card family.
 *
 * Cards are used only where elevation communicates real hierarchy (taste rule).
 * Variants: `elevated` (soft shadow), `outlined` (hairline), `ghost` (no chrome),
 * `interactive` (hover lift + press, for clickable cards). Plus composed cards:
 * StatCard (a metric) and MediaCard (image + body). One radius system throughout.
 */

import * as React from 'react';
import type { LucideIcon } from 'lucide-react';

import './card.css';

export type CardVariant = 'elevated' | 'outlined' | 'ghost' | 'interactive';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  /** Inset padding preset. */
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export function Card({
  variant = 'outlined',
  padding = 'md',
  className,
  children,
  ...rest
}: CardProps): React.JSX.Element {
  const cls = [
    'u-card',
    `u-card--${variant}`,
    `u-card--pad-${padding}`,
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <div className={cls} {...rest}>
      {children}
    </div>
  );
}

export function CardHeader({
  className,
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>): React.JSX.Element {
  return (
    <div className={['u-card__header', className].filter(Boolean).join(' ')} {...rest}>
      {children}
    </div>
  );
}

export function CardTitle({
  className,
  children,
  ...rest
}: React.HTMLAttributes<HTMLHeadingElement>): React.JSX.Element {
  return (
    <h3 className={['u-card__title', className].filter(Boolean).join(' ')} {...rest}>
      {children}
    </h3>
  );
}

export function CardDescription({
  className,
  children,
  ...rest
}: React.HTMLAttributes<HTMLParagraphElement>): React.JSX.Element {
  return (
    <p className={['u-card__desc', className].filter(Boolean).join(' ')} {...rest}>
      {children}
    </p>
  );
}

export function CardBody({
  className,
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>): React.JSX.Element {
  return (
    <div className={['u-card__body', className].filter(Boolean).join(' ')} {...rest}>
      {children}
    </div>
  );
}

export function CardFooter({
  className,
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>): React.JSX.Element {
  return (
    <div className={['u-card__footer', className].filter(Boolean).join(' ')} {...rest}>
      {children}
    </div>
  );
}

export interface StatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
  value: React.ReactNode;
  /** Optional leading icon — a Lucide component (`Activity`) or a rendered node (`<Activity />`). */
  icon?: LucideIcon | React.ReactNode;
  /** A delta like "+12%" with a tone. */
  delta?: { value: string; tone?: 'up' | 'down' | 'neutral' };
  /** Tint the icon chip with a brand-ish accent. */
  accent?: string;
}

/** A single KPI/metric tile — label, big value, optional icon + delta. */
export function StatCard({
  label,
  value,
  icon,
  delta,
  accent,
  className,
  ...rest
}: StatCardProps): React.JSX.Element {
  // A bare Lucide component gets sized; an already-rendered node is used as-is.
  const glyph =
    typeof icon === 'function'
      ? React.createElement(icon as LucideIcon, { size: 16 })
      : icon;
  return (
    <div className={['u-card', 'u-statcard', className].filter(Boolean).join(' ')} {...rest}>
      {icon ? (
        <span
          className="u-statcard__icon"
          style={accent ? { background: `${accent}1a`, color: accent } : undefined}
          aria-hidden="true"
        >
          {glyph}
        </span>
      ) : null}
      <span className="u-statcard__label">{label}</span>
      <span className="u-statcard__value">{value}</span>
      {delta ? (
        <span className={`u-statcard__delta u-statcard__delta--${delta.tone ?? 'neutral'}`}>
          {delta.value}
        </span>
      ) : null}
    </div>
  );
}

export interface MediaCardProps extends React.HTMLAttributes<HTMLDivElement> {
  media: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  footer?: React.ReactNode;
}

/** Image/media on top, content below — for galleries, previews, records. */
export function MediaCard({
  media,
  title,
  description,
  footer,
  className,
  ...rest
}: MediaCardProps): React.JSX.Element {
  return (
    <div className={['u-card', 'u-card--outlined', 'u-mediacard', className].filter(Boolean).join(' ')} {...rest}>
      <div className="u-mediacard__media">{media}</div>
      <div className="u-mediacard__body">
        <h3 className="u-card__title">{title}</h3>
        {description ? <p className="u-card__desc">{description}</p> : null}
        {footer ? <div className="u-mediacard__footer">{footer}</div> : null}
      </div>
    </div>
  );
}

export default Card;
