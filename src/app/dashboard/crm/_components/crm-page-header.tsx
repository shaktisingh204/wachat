import * as React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

/**
 * Breadcrumb entry for `CrmPageHeader`. `href` is optional — the last
 * crumb (or any crumb without an `href`) renders as plain text rather
 * than a link, signalling the current location.
 */
export interface CrmPageHeaderBreadcrumb {
  label: string;
  href?: string;
}

export interface CrmPageHeaderProps {
  title: string;
  subtitle?: string;
  icon?: React.ElementType;
  /**
   * Primary actions slot (top-right). Intended for the page's main CTA
   * (e.g. "New invoice"). Render `secondaryActions` to its left for
   * toolbar-style filter/sort/export buttons.
   */
  actions?: React.ReactNode;
  /**
   * Secondary actions slot rendered to the LEFT of `actions`. Use for
   * Filter / Sort / Export buttons that aren't the page's primary CTA.
   * Kept as a separate prop so existing consumers don't have to change.
   */
  secondaryActions?: React.ReactNode;
  /**
   * Optional breadcrumb trail rendered as a `<nav>` above the title.
   * Items are joined by `/` separators; the last item (or any item
   * without `href`) renders as plain text.
   */
  breadcrumbs?: CrmPageHeaderBreadcrumb[];
  className?: string;
}

/**
 * CrmPageHeader — Ui20-styled page header used across every CRM
 * landing page. Icon chip + title/subtitle + trailing actions, plus
 * optional breadcrumb rail and secondary toolbar.
 */
export function CrmPageHeader({
  title,
  subtitle,
  icon: Icon,
  actions,
  secondaryActions,
  breadcrumbs,
  className,
}: CrmPageHeaderProps) {
  const hasBreadcrumbs = Array.isArray(breadcrumbs) && breadcrumbs.length > 0;
  const lastCrumbIndex = hasBreadcrumbs ? breadcrumbs!.length - 1 : -1;

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {hasBreadcrumbs ? (
        <nav
          aria-label="Breadcrumb"
          className="flex flex-wrap items-center gap-1.5 text-[12px] text-[var(--st-text-secondary)]"
        >
          <ol className="flex flex-wrap items-center gap-1.5">
            {breadcrumbs!.map((crumb, i) => {
              const isLast = i === lastCrumbIndex;
              const isLink = !!crumb.href && !isLast;
              return (
                <li key={`${i}-${crumb.label}`} className="flex items-center gap-1.5">
                  {isLink ? (
                    <Link
                      href={crumb.href!}
                      className="hover:text-[var(--st-text)] transition-colors"
                    >
                      {crumb.label}
                    </Link>
                  ) : (
                    <span
                      className={cn(isLast && 'text-[var(--st-text)] font-medium')}
                      aria-current={isLast ? 'page' : undefined}
                    >
                      {crumb.label}
                    </span>
                  )}
                  {!isLast && (
                    <span aria-hidden className="text-[var(--st-text-secondary)]/60">
                      /
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        </nav>
      ) : null}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          {Icon ? (
            <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-bg-muted)]">
              <Icon className="h-5 w-5 text-[var(--st-text)]" strokeWidth={1.75} />
            </div>
          ) : null}
          <div className="min-w-0">
            <h1 className="text-[26px] leading-tight text-[var(--st-text)]">{title}</h1>
            {subtitle ? (
              <p className="mt-1 text-[13px] text-[var(--st-text-secondary)]">{subtitle}</p>
            ) : null}
          </div>
        </div>
        {secondaryActions || actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {secondaryActions ? (
              <div className="flex flex-wrap items-center gap-2">
                {secondaryActions}
              </div>
            ) : null}
            {actions ? (
              <div className="flex flex-wrap items-center gap-2">{actions}</div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
