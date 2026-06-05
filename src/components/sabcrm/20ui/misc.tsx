/**
 * 20ui — Separator, Kbd, Breadcrumb.
 *
 * Small structural primitives. None of these own state, so this module is a
 * pure server component (no `'use client'`). Separator is a hairline rule with
 * an optional centred label (role=separator); Kbd is a styled key cap; and
 * Breadcrumb is a semantic <nav>/<ol> trail with chevron separators, the last
 * crumb marked aria-current=page. Colour is reserved for the one accent (links
 * on hover); everything else is calm near-monochrome.
 */

import * as React from 'react';
import { ChevronRight } from 'lucide-react';

import './misc.css';

export type SeparatorOrientation = 'horizontal' | 'vertical';

export interface SeparatorProps extends React.HTMLAttributes<HTMLDivElement> {
  orientation?: SeparatorOrientation;
  /** Optional centred label (horizontal only) — e.g. "or". */
  label?: React.ReactNode;
}

/**
 * A hairline rule. Horizontal by default; pass `label` for a centred caption
 * ("or", "Today") split across the line. Reports role=separator + orientation
 * to assistive tech.
 */
export function Separator({
  orientation = 'horizontal',
  label,
  className,
  ...rest
}: SeparatorProps): React.JSX.Element {
  const cls = ['u-sep', `u-sep--${orientation}`, label && 'u-sep--labeled', className]
    .filter(Boolean)
    .join(' ');

  if (label && orientation === 'horizontal') {
    return (
      <div
        className={cls}
        role="separator"
        aria-orientation="horizontal"
        {...rest}
      >
        <span className="u-sep__label">{label}</span>
      </div>
    );
  }

  return (
    <div
      className={cls}
      role="separator"
      aria-orientation={orientation}
      {...rest}
    />
  );
}

export interface KbdProps extends React.HTMLAttributes<HTMLElement> {
  children: React.ReactNode;
}

/** A styled key cap, e.g. `<Kbd>⌘</Kbd> <Kbd>K</Kbd>`. */
export function Kbd({ className, children, ...rest }: KbdProps): React.JSX.Element {
  return (
    <kbd className={['u-kbd', className].filter(Boolean).join(' ')} {...rest}>
      {children}
    </kbd>
  );
}

export interface BreadcrumbItem {
  label: React.ReactNode;
  /** Omit `href` for the current (last) page, or any non-link crumb. */
  href?: string;
}

export interface BreadcrumbProps
  extends Omit<React.HTMLAttributes<HTMLElement>, 'children'> {
  items: BreadcrumbItem[];
  /** Accessible label for the landmark. */
  label?: string;
}

/**
 * A breadcrumb trail. Renders nav[aria-label] > ol with ChevronRight separators
 * (aria-hidden). The final crumb is rendered as plain text with aria-current=page;
 * earlier crumbs with an `href` are links that pick up the accent on hover.
 */
export function Breadcrumb({
  items,
  label = 'Breadcrumb',
  className,
  ...rest
}: BreadcrumbProps): React.JSX.Element {
  const last = items.length - 1;
  return (
    <nav
      aria-label={label}
      className={['u-breadcrumb', className].filter(Boolean).join(' ')}
      {...rest}
    >
      <ol className="u-breadcrumb__list">
        {items.map((item, i) => {
          const isLast = i === last;
          return (
            <li className="u-breadcrumb__item" key={i}>
              {item.href && !isLast ? (
                <a className="u-breadcrumb__link" href={item.href}>
                  {item.label}
                </a>
              ) : (
                <span
                  className="u-breadcrumb__current"
                  aria-current={isLast ? 'page' : undefined}
                >
                  {item.label}
                </span>
              )}
              {!isLast ? (
                <ChevronRight
                  size={14}
                  className="u-breadcrumb__sep"
                  aria-hidden="true"
                />
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export default Separator;
