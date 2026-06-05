'use client';

/**
 * 20ui — Breadcrumb.
 *
 * A semantic trail for hierarchical navigation: `nav > ol > li`. Built on plain
 * markup (no Radix positioning needed) with one optional Radix dependency —
 * `@radix-ui/react-slot` — so `BreadcrumbLink` can render `asChild` onto a
 * framework link (e.g. Next's `<Link>`) while keeping the breadcrumb styling.
 *
 * The current page uses `BreadcrumbPage` (`aria-current="page"`), prior crumbs
 * use `BreadcrumbLink`, and the chevrons sit in `BreadcrumbSeparator`
 * (`aria-hidden`, `role="presentation"`) so assistive tech reads a clean trail.
 * `BreadcrumbEllipsis` collapses a long trail and carries an sr-only label.
 *
 *   <Breadcrumb>
 *     <BreadcrumbList>
 *       <BreadcrumbItem>
 *         <BreadcrumbLink href="/sabcrm">CRM</BreadcrumbLink>
 *       </BreadcrumbItem>
 *       <BreadcrumbSeparator />
 *       <BreadcrumbItem>
 *         <BreadcrumbLink href="/sabcrm/leads">Leads</BreadcrumbLink>
 *       </BreadcrumbItem>
 *       <BreadcrumbSeparator />
 *       <BreadcrumbItem>
 *         <BreadcrumbPage>Acme Corp</BreadcrumbPage>
 *       </BreadcrumbItem>
 *     </BreadcrumbList>
 *   </Breadcrumb>
 */

import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { ChevronRight, MoreHorizontal } from 'lucide-react';

import './breadcrumb.css';

const cx = (...parts: Array<string | false | null | undefined>): string =>
  parts.filter(Boolean).join(' ');

/**
 * Root landmark for the trail. Renders a `<nav aria-label="breadcrumb">`; the
 * optional `separator` prop is accepted for API parity (the separator glyph is
 * supplied per-crumb via `BreadcrumbSeparator`). Forwards its ref to the nav.
 */
export const Breadcrumb = React.forwardRef<
  HTMLElement,
  React.ComponentPropsWithoutRef<'nav'> & {
    separator?: React.ReactNode;
  }
>(function Breadcrumb({ className, separator: _separator, ...rest }, ref) {
  return (
    <nav
      ref={ref}
      aria-label="breadcrumb"
      className={cx('u-breadcrumb', className)}
      {...rest}
    />
  );
});
Breadcrumb.displayName = 'Breadcrumb';

/** The ordered list that holds the crumbs. Forwards its ref to the `<ol>`. */
export const BreadcrumbList = React.forwardRef<
  HTMLOListElement,
  React.ComponentPropsWithoutRef<'ol'>
>(function BreadcrumbList({ className, ...rest }, ref) {
  return <ol ref={ref} className={cx('u-breadcrumb__list', className)} {...rest} />;
});
BreadcrumbList.displayName = 'BreadcrumbList';

/** A single crumb slot (wraps a link, page, or ellipsis). */
export const BreadcrumbItem = React.forwardRef<
  HTMLLIElement,
  React.ComponentPropsWithoutRef<'li'>
>(function BreadcrumbItem({ className, ...rest }, ref) {
  return <li ref={ref} className={cx('u-breadcrumb__item', className)} {...rest} />;
});
BreadcrumbItem.displayName = 'BreadcrumbItem';

/**
 * A navigable crumb. Pass `asChild` to render onto your own anchor/link element
 * (e.g. Next's `<Link>`) while keeping the breadcrumb styling. Forwards its ref.
 */
export const BreadcrumbLink = React.forwardRef<
  HTMLAnchorElement,
  React.ComponentPropsWithoutRef<'a'> & { asChild?: boolean }
>(function BreadcrumbLink({ className, asChild, ...rest }, ref) {
  const Comp = asChild ? Slot : 'a';
  return <Comp ref={ref} className={cx('u-breadcrumb__link', className)} {...rest} />;
});
BreadcrumbLink.displayName = 'BreadcrumbLink';

/**
 * The current page crumb. Not a link — `role="link"` + `aria-current="page"`
 * marks it as the present location for assistive tech. Forwards its ref.
 */
export const BreadcrumbPage = React.forwardRef<
  HTMLSpanElement,
  React.ComponentPropsWithoutRef<'span'>
>(function BreadcrumbPage({ className, ...rest }, ref) {
  return (
    <span
      ref={ref}
      role="link"
      aria-disabled="true"
      aria-current="page"
      className={cx('u-breadcrumb__page', className)}
      {...rest}
    />
  );
});
BreadcrumbPage.displayName = 'BreadcrumbPage';

/**
 * The glyph between crumbs. Decorative — `role="presentation"` + `aria-hidden`
 * keep it out of the trail announced to screen readers. Defaults to a chevron;
 * pass `children` to override.
 */
export function BreadcrumbSeparator({
  children,
  className,
  ...rest
}: React.ComponentProps<'li'>): React.JSX.Element {
  return (
    <li
      role="presentation"
      aria-hidden="true"
      className={cx('u-breadcrumb__separator', className)}
      {...rest}
    >
      {children ?? <ChevronRight aria-hidden="true" />}
    </li>
  );
}

/**
 * A collapsed-trail indicator (the middle crumbs hidden behind a "…"). Decorative
 * glyph with an sr-only "More" label so the omission is announced.
 */
export function BreadcrumbEllipsis({
  className,
  ...rest
}: React.ComponentProps<'span'>): React.JSX.Element {
  return (
    <span
      role="presentation"
      aria-hidden="true"
      className={cx('u-breadcrumb__ellipsis', className)}
      {...rest}
    >
      <MoreHorizontal aria-hidden="true" />
      <span className="u-breadcrumb__sr-only">More</span>
    </span>
  );
}

export default Breadcrumb;
