/**
 * WachatPage — the ONE page container every WaChat page renders inside.
 *
 * Why this exists: WaChat pages used to each pick their own outer width and
 * padding (some `mx-auto max-w-[1320px] px-6 pt-6`, others `flex flex-col gap-6`
 * with no gutters), which is exactly what made the module's padding/margins look
 * uneven page-to-page. This container makes the page frame a single decision:
 *
 *   - wraps the subtree in `.ui20` so 20ui tokens always resolve (idempotent if
 *     an ancestor shell already provides it),
 *   - centres content at one max width with one responsive side gutter,
 *   - composes the standard breadcrumb + {@link PageHeader} at the top, with one
 *     consistent rhythm between header and body.
 *
 * Standard page:
 *   <WachatPage
 *     breadcrumb={[{ label: 'SabNode', href: '/dashboard' }, { label: 'WaChat', href: '/wachat' }, { label: 'Contacts' }]}
 *     title="Contacts"
 *     description="Everyone you can message."
 *     actions={<Button variant="primary">Add contact</Button>}
 *   >
 *     …page body…
 *   </WachatPage>
 *
 * Full-bleed "app" page (inbox, kanban, flow canvas, calls) — children own the
 * whole frame (no max width, no gutter, no header):
 *   <WachatPage variant="app">…</WachatPage>
 *
 * Built to the three UI skills the system follows: emil-design-eng (no per-frame
 * motion here; spacing is static), fixing-accessibility (semantic header/nav
 * landmarks, one h1 via PageTitle), design-taste-frontend (one width, one gutter,
 * one rhythm — calm and consistent).
 */

import * as React from 'react';

import {
  Breadcrumb,
  type BreadcrumbItem,
  PageHeader,
  PageHeaderHeading,
  PageEyebrow,
  PageTitle,
  PageDescription,
  PageActions,
} from '@/components/sabcrm/20ui';

import './wachat-page.css';

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

/** Content max-width. `default` (1320) for most pages, `narrow` for single-column
 * forms/settings, `wide` for dense tables/dashboards. */
export type WachatPageWidth = 'default' | 'narrow' | 'wide';

export interface WachatPageProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  /** Breadcrumb trail; omit for pages that don't want one. */
  breadcrumb?: BreadcrumbItem[];
  /** Small uppercase kicker above the title. */
  eyebrow?: React.ReactNode;
  /** The page H1. Omit (with eyebrow/description/actions) to skip the header. */
  title?: React.ReactNode;
  /** Supporting sentence under the title. */
  description?: React.ReactNode;
  /** Right-aligned header actions (buttons, menus). */
  actions?: React.ReactNode;
  /** Draw the hairline under the header (default true). */
  bordered?: boolean;
  /** Content max-width. */
  width?: WachatPageWidth;
  /** `app` = full-height edge-to-edge frame; children own everything. */
  variant?: 'default' | 'app';
  /** Extra classes on the inner content column. */
  contentClassName?: string;
  children?: React.ReactNode;
}

/**
 * The standard WaChat page frame. Render every WaChat page's content inside one
 * of these so width, gutter, and header rhythm are identical everywhere.
 */
export function WachatPage({
  breadcrumb,
  eyebrow,
  title,
  description,
  actions,
  bordered = true,
  width = 'default',
  variant = 'default',
  className,
  contentClassName,
  children,
  ...rest
}: WachatPageProps): React.JSX.Element {
  if (variant === 'app') {
    return (
      <div className={cx('ui20', 'wachat-page', 'wachat-page--app', className)} {...rest}>
        {children}
      </div>
    );
  }

  const hasHeader = Boolean(eyebrow || title || description || actions);

  return (
    <div className={cx('ui20', 'wachat-page', className)} {...rest}>
      <div className={cx('wachat-page__inner', contentClassName)} data-width={width}>
        {breadcrumb && breadcrumb.length > 0 ? (
          <Breadcrumb className="wachat-page__crumbs" items={breadcrumb} />
        ) : null}

        {hasHeader ? (
          <PageHeader bordered={bordered}>
            <PageHeaderHeading>
              {eyebrow ? <PageEyebrow>{eyebrow}</PageEyebrow> : null}
              {title ? <PageTitle>{title}</PageTitle> : null}
              {description ? <PageDescription>{description}</PageDescription> : null}
            </PageHeaderHeading>
            {actions ? <PageActions>{actions}</PageActions> : null}
          </PageHeader>
        ) : null}

        <div className={cx('wachat-page__body', hasHeader && 'wachat-page__body--after-header')}>
          {children}
        </div>
      </div>
    </div>
  );
}

export default WachatPage;
