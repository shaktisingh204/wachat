/**
 * SabflowPage — the ONE page container every SabFlow dashboard page renders
 * inside (clone of WaChat's WachatPage pattern).
 *
 * Why this exists: SabFlow pages each picked their own outer width and
 * padding, which made the module's padding/margins look uneven page-to-page.
 * This container makes the page frame a single decision:
 *
 *   - wraps the subtree in `.ui20` so 20ui tokens always resolve (idempotent
 *     if an ancestor shell already provides it),
 *   - centres content at one max width with one responsive side gutter,
 *   - composes the standard breadcrumb + {@link PageHeader} at the top, with
 *     one consistent rhythm between header and body.
 *
 * Standard page:
 *   <SabflowPage
 *     breadcrumb={[{ label: 'SabNode', href: '/dashboard' }, { label: 'SabFlow', href: '/dashboard/sabflow' }, { label: 'Executions' }]}
 *     title="Executions"
 *     description="Every run of every flow."
 *     actions={<Button variant="primary">New flow</Button>}
 *   >
 *     …page body…
 *   </SabflowPage>
 *
 * Full-bleed "app" page (flow canvas, graph views) — children own the whole
 * frame (no max width, no gutter, no header):
 *   <SabflowPage variant="app">…</SabflowPage>
 */

import * as React from 'react';

import {
  BreadcrumbTrail,
  type BreadcrumbTrailItem,
  PageHeader,
  PageHeaderHeading,
  PageEyebrow,
  PageTitle,
  PageDescription,
  PageActions,
} from '@/components/sabcrm/20ui';

import './sabflow-page.css';

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

/** Content max-width. `default` (1320) for most pages, `narrow` for single-column
 * forms/settings, `wide` for dense tables/dashboards. */
export type SabflowPageWidth = 'default' | 'narrow' | 'wide';

export interface SabflowPageProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  /** Breadcrumb trail; omit for pages that don't want one. */
  breadcrumb?: BreadcrumbTrailItem[];
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
  width?: SabflowPageWidth;
  /** `app` = full-height edge-to-edge frame; children own everything. */
  variant?: 'default' | 'app';
  /** Extra classes on the inner content column. */
  contentClassName?: string;
  children?: React.ReactNode;
}

/** Standard breadcrumb root for SabFlow pages. */
export const SABFLOW_CRUMBS: BreadcrumbTrailItem[] = [
  { label: 'SabNode', href: '/dashboard' },
  { label: 'SabFlow', href: '/dashboard/sabflow' },
];

/**
 * The standard SabFlow page frame. Render every SabFlow page's content inside
 * one of these so width, gutter, and header rhythm are identical everywhere.
 */
export function SabflowPage({
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
}: SabflowPageProps): React.JSX.Element {
  if (variant === 'app') {
    return (
      <div className={cx('ui20', 'sabflow-page', 'sabflow-page--app', className)} {...rest}>
        {children}
      </div>
    );
  }

  const hasHeader = Boolean(eyebrow || title || description || actions);

  return (
    <div className={cx('ui20', 'sabflow-page', className)} {...rest}>
      <div className={cx('sabflow-page__inner', contentClassName)} data-width={width}>
        {breadcrumb && breadcrumb.length > 0 ? (
          <BreadcrumbTrail className="sabflow-page__crumbs" items={breadcrumb} />
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

        <div className={cx('sabflow-page__body', hasHeader && 'sabflow-page__body--after-header')}>
          {children}
        </div>
      </div>
    </div>
  );
}

export default SabflowPage;
