'use client';

/**
 * 20ui — Feedback: Alert (Banner), Callout, EmptyState.
 *
 * Alert: a tinted, tone-tinged notice with a leading icon, optional title + body
 * and an optional dismiss control. `role=status` by default; `danger` escalates
 * to `role=alert` so assistive tech announces it. Callout: a softer inline note
 * for in-context tips. EmptyState: a centred icon chip + title + muted copy +
 * optional action slot, for empty lists / first-run. Tones reuse the Badge soft
 * tint palette so colour only ever carries meaning.
 */

import * as React from 'react';
import { Info, CheckCircle2, AlertTriangle, AlertCircle, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import './feedback.css';

export type FeedbackTone = 'info' | 'success' | 'warning' | 'danger' | 'neutral';

const TONE_ICON: Record<FeedbackTone, LucideIcon> = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: AlertCircle,
  neutral: Info,
};

const ALERT_VARIANT_TONE: Record<string, FeedbackTone> = {
  default: 'info',
  destructive: 'danger',
  error: 'danger',
  success: 'success',
  warning: 'warning',
  info: 'info',
};

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  tone?: FeedbackTone;
  /** Back-compat (shadcn/legacy) variant; mapped to tone when `tone` is absent. */
  variant?: 'default' | 'destructive' | 'error' | 'success' | 'warning' | 'info';
  /** Bold lead-in above the body. */
  title?: React.ReactNode;
  /** Override the tone's default icon, or pass `null` to hide it. */
  icon?: LucideIcon | null;
  /** Show a dismiss control; fires this on click. */
  onClose?: () => void;
  /** Accessible name for the dismiss control. */
  closeLabel?: string;
}

/** A tinted notice with a left edge, icon, title, body and optional dismiss. */
export function Alert({
  tone,
  variant,
  title,
  icon,
  onClose,
  closeLabel = 'Dismiss',
  className,
  children,
  ...rest
}: AlertProps): React.JSX.Element {
  const resolvedTone: FeedbackTone =
    tone ?? (variant ? ALERT_VARIANT_TONE[variant] ?? 'info' : 'info');
  const Icon = icon === null ? null : icon ?? TONE_ICON[resolvedTone];
  const cls = ['u-alert', `u-alert--${resolvedTone}`, className].filter(Boolean).join(' ');
  return (
    <div
      role={resolvedTone === 'danger' ? 'alert' : 'status'}
      aria-live={resolvedTone === 'danger' ? 'assertive' : 'polite'}
      className={cls}
      {...rest}
    >
      {Icon ? (
        <span className="u-alert__icon" aria-hidden="true">
          <Icon size={16} />
        </span>
      ) : null}
      <div className="u-alert__content">
        {title ? <p className="u-alert__title">{title}</p> : null}
        {children != null ? <div className="u-alert__body">{children}</div> : null}
      </div>
      {onClose ? (
        <button
          type="button"
          className="u-alert__close"
          aria-label={closeLabel}
          title={closeLabel}
          onClick={onClose}
        >
          <X size={14} aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}

/**
 * Compound sub-parts so Ui20/shadcn-style usages work as a drop-in:
 *   <Alert><AlertTitle/><AlertDescription/></Alert>
 * These render *inside* an Alert's `children` (which lands in `.u-alert__body`).
 * Token-styled only; no motion (alerts are static).
 */

export type AlertTitleProps = React.HTMLAttributes<HTMLHeadingElement>;

/** A medium-weight heading line for a compound Alert. Matches Ui20 AlertTitle. */
export function AlertTitle({ className, ...rest }: AlertTitleProps): React.JSX.Element {
  const cls = ['u-alert-title', className].filter(Boolean).join(' ');
  return <h5 className={cls} {...rest} />;
}

export type AlertDescriptionProps = React.HTMLAttributes<HTMLDivElement>;

/** Secondary body text for a compound Alert. Matches Ui20 AlertDescription. */
export function AlertDescription({
  className,
  ...rest
}: AlertDescriptionProps): React.JSX.Element {
  const cls = ['u-alert-description', className].filter(Boolean).join(' ');
  return <div className={cls} {...rest} />;
}

export interface CalloutProps extends React.HTMLAttributes<HTMLDivElement> {
  tone?: FeedbackTone;
  /** Optional leading icon (defaults to the tone icon; pass `null` to hide). */
  icon?: LucideIcon | null;
  /** Bold lead-in before the note. */
  title?: React.ReactNode;
}

/** A softer, borderless inline note — for tips and contextual asides. */
export function Callout({
  tone = 'neutral',
  icon,
  title,
  className,
  children,
  ...rest
}: CalloutProps): React.JSX.Element {
  const Icon = icon === null ? null : icon ?? TONE_ICON[tone];
  const cls = ['u-callout', `u-callout--${tone}`, className].filter(Boolean).join(' ');
  return (
    <div className={cls} {...rest}>
      {Icon ? (
        <span className="u-callout__icon" aria-hidden="true">
          <Icon size={14} />
        </span>
      ) : null}
      <div className="u-callout__content">
        {title ? <span className="u-callout__title">{title}</span> : null}
        {children != null ? <span className="u-callout__body">{children}</span> : null}
      </div>
    </div>
  );
}

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * The chip glyph (decorative). Either a Lucide component (`Search`) —
   * rendered with a tone-appropriate size — or an already-rendered node
   * (`<Search />`). Both are accepted so neither calling convention crashes.
   */
  icon?: LucideIcon | React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Action slot — typically a Button or two. */
  action?: React.ReactNode;
  /** Tint the icon chip with a tone. */
  tone?: FeedbackTone;
  size?: 'sm' | 'md';
}

/** A centred placeholder for empty lists / first-run, with an optional action. */
export function EmptyState({
  icon,
  title,
  description,
  action,
  tone = 'neutral',
  size = 'md',
  className,
  ...rest
}: EmptyStateProps): React.JSX.Element {
  const cls = ['u-empty', `u-empty--${size}`, className].filter(Boolean).join(' ');
  // An already-rendered node (<Search />) is used as-is; a component type —
  // including a Lucide icon (which is a forwardRef *object*, not a function,
  // so we can't `typeof === 'function'` it) — is created with a sized prop.
  const glyph = !icon
    ? null
    : React.isValidElement(icon)
      ? icon
      : React.createElement(icon as LucideIcon, { size: size === 'sm' ? 18 : 22 });
  return (
    <div className={cls} {...rest}>
      {icon ? (
        <span className={`u-empty__chip u-empty__chip--${tone}`} aria-hidden="true">
          {glyph}
        </span>
      ) : null}
      <p className="u-empty__title">{title}</p>
      {description ? <p className="u-empty__desc">{description}</p> : null}
      {action ? <div className="u-empty__action">{action}</div> : null}
    </div>
  );
}

export default Alert;
