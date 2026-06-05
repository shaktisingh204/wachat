'use client';

/**
 * 20ui — PageHeader family.
 *
 * Page chrome: the calm, consistent header at the top of every page/section.
 * A flex header with an optional eyebrow (small uppercase kicker), a single h1
 * heading, a description, and a right-aligned actions slot. Composable and
 * token-styled. Mirrors ZoruUI's page-header API but reimplemented in 20ui
 * style (u- classes, --st-/--u- tokens, no zoruui import).
 *
 * Taste: one heading level (h1 — never skip levels), one accent, one radius.
 * Emil: the bottom hairline + spacing are static; nothing here animates on
 * every paint, so motion is intentionally minimal (the system's reduced-motion
 * block in 20ui.css still applies to any composed pressables).
 * A11y: the eyebrow is purely decorative kicker text; the h1 carries the page
 * name; actions live in their own group with their own accessible names.
 *
 * Compose:
 *   <PageHeader>
 *     <PageHeaderHeading>
 *       <PageEyebrow>Workspace</PageEyebrow>           // e.g. "Workspace"
 *       <PageTitle>Leads</PageTitle>                   // e.g. "Leads"
 *       <PageDescription>Track every deal …</PageDescription>
 *     </PageHeaderHeading>
 *     <PageActions>
 *       <Button variant="primary">New lead</Button>
 *     </PageActions>
 *   </PageHeader>
 */

import * as React from 'react';

import './pageheader.css';

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

export interface PageHeaderProps extends React.HTMLAttributes<HTMLElement> {
  /** Draw a hairline below the header (defaults to true). */
  bordered?: boolean;
  /** Tighten the vertical rhythm for dense / nested headers. */
  compact?: boolean;
}

/**
 * The header shell. Stacks on small screens, then becomes a row with the
 * heading on the left and actions on the right (baseline-aligned at the end).
 * Renders a semantic <header> landmark.
 */
export function PageHeader({
  bordered = true,
  compact = false,
  className,
  children,
  ...rest
}: PageHeaderProps): React.JSX.Element {
  return (
    <header
      className={cx(
        'u-pagehead',
        bordered && 'u-pagehead--bordered',
        compact && 'u-pagehead--compact',
        className,
      )}
      {...rest}
    >
      {children}
    </header>
  );
}

/** The left column: eyebrow + title + description, stacked tightly. */
export function PageHeaderHeading({
  className,
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>): React.JSX.Element {
  return (
    <div className={cx('u-pagehead__heading', className)} {...rest}>
      {children}
    </div>
  );
}

/** Small uppercase kicker above the title (e.g. a section or workspace name). */
export function PageEyebrow({
  className,
  children,
  ...rest
}: React.HTMLAttributes<HTMLParagraphElement>): React.JSX.Element {
  return (
    <p className={cx('u-pagehead__eyebrow', className)} {...rest}>
      {children}
    </p>
  );
}

/**
 * The page title. Always an <h1> — page headers sit at the top of the document
 * outline, so this is the single top-level heading (no skipped levels).
 */
export function PageTitle({
  className,
  children,
  ...rest
}: React.HTMLAttributes<HTMLHeadingElement>): React.JSX.Element {
  return (
    <h1 className={cx('u-pagehead__title', className)} {...rest}>
      {children}
    </h1>
  );
}

/** Supporting sentence below the title; capped width for readable line length. */
export function PageDescription({
  className,
  children,
  ...rest
}: React.HTMLAttributes<HTMLParagraphElement>): React.JSX.Element {
  return (
    <p className={cx('u-pagehead__desc', className)} {...rest}>
      {children}
    </p>
  );
}

/**
 * Right-aligned actions slot. Wraps to a new line on narrow widths. Marked as a
 * group so assistive tech announces the buttons as a related cluster; each
 * child still needs its own accessible name.
 */
export function PageActions({
  className,
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>): React.JSX.Element {
  return (
    <div role="group" className={cx('u-pagehead__actions', className)} {...rest}>
      {children}
    </div>
  );
}

/* Aliases — keep the ZoruUI-compatible names available. */
export {
  PageHeaderHeading as PageHeading,
  PageDescription as PageHeaderDescription,
};

export default PageHeader;
