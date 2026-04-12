'use client';

/**
 * SabPage + SabPageHeader — canonical page chrome.
 *
 * Aurora enhancements:
 *   - `hero` prop on SabPageHeader renders a 40px title with a subtle
 *     gradient accent bar on the left and a decorative gradient blob
 *     behind the eyebrow
 *   - Default size stays compact for sub-pages
 */

import * as React from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

/* -------------------------------------------------------------------------- */
/*  SabPage root                                                              */
/* -------------------------------------------------------------------------- */

export interface SabPageProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Constrain max width. Default unset so the page fills its parent. */
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
}

const MAX_WIDTH_CLASS: Record<NonNullable<SabPageProps['maxWidth']>, string> = {
  sm: 'max-w-3xl',
  md: 'max-w-5xl',
  lg: 'max-w-6xl',
  xl: 'max-w-7xl',
  '2xl': 'max-w-[1600px]',
  full: 'max-w-none',
};

export const SabPage = React.forwardRef<HTMLDivElement, SabPageProps>(
  ({ className, maxWidth = '2xl', children, style, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('sab-scope flex flex-col gap-8', MAX_WIDTH_CLASS[maxWidth], className)}
      style={{
        fontFamily: 'var(--sab-font-sans)',
        color: 'hsl(var(--sab-fg))',
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  ),
);
SabPage.displayName = 'SabPage';

/* -------------------------------------------------------------------------- */
/*  SabPageHeader                                                             */
/* -------------------------------------------------------------------------- */

export interface SabBreadcrumb {
  label: string;
  href?: string;
}

export interface SabPageHeaderProps {
  breadcrumb?: SabBreadcrumb[];
  eyebrow?: string;
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  /** Hero mode: larger title + decorative accent. */
  hero?: boolean;
  className?: string;
}

export function SabPageHeader({
  breadcrumb,
  eyebrow,
  title,
  description,
  actions,
  hero,
  className,
}: SabPageHeaderProps) {
  return (
    <header
      className={cn(
        'sab-page-header relative flex flex-col gap-4',
        hero && 'py-2',
        className,
      )}
    >
      {/* Decorative gradient orb — only in hero mode */}
      {hero ? (
        <div
          aria-hidden
          className="pointer-events-none absolute -left-8 -top-16 h-48 w-48 opacity-[0.35] blur-[48px]"
          style={{
            background:
              'radial-gradient(circle, hsl(var(--sab-primary)) 0%, transparent 70%)',
          }}
        />
      ) : null}

      {breadcrumb && breadcrumb.length > 0 ? (
        <nav
          aria-label="Breadcrumb"
          className="relative flex items-center gap-1 text-[13px]"
          style={{ color: 'hsl(var(--sab-fg-muted))' }}
        >
          {breadcrumb.map((c, i) => {
            const isLast = i === breadcrumb.length - 1;
            return (
              <React.Fragment key={`${c.label}-${i}`}>
                {c.href && !isLast ? (
                  <Link
                    href={c.href}
                    className="font-medium transition-colors hover:text-[hsl(var(--sab-fg))]"
                  >
                    {c.label}
                  </Link>
                ) : (
                  <span
                    className="font-medium"
                    style={{ color: isLast ? 'hsl(var(--sab-fg))' : undefined }}
                  >
                    {c.label}
                  </span>
                )}
                {!isLast && (
                  <ChevronRight
                    className="h-3.5 w-3.5"
                    style={{ color: 'hsl(var(--sab-fg-subtle))' }}
                    aria-hidden
                  />
                )}
              </React.Fragment>
            );
          })}
        </nav>
      ) : null}

      <div className="relative flex flex-wrap items-start justify-between gap-4">
        <div className={cn('flex min-w-0 flex-col', hero ? 'gap-3' : 'gap-2')}>
          {eyebrow ? (
            <span
              className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em]"
              style={{ color: 'hsl(var(--sab-primary))' }}
            >
              {hero ? (
                <span
                  aria-hidden
                  className="h-[2px] w-6 rounded-full"
                  style={{ background: 'var(--sab-gradient-primary)' }}
                />
              ) : null}
              {eyebrow}
            </span>
          ) : null}
          <h1
            className={cn(
              'sab-title font-semibold leading-[1.05] tracking-[-0.02em]',
              hero ? 'text-[40px] sm:text-[48px]' : 'text-[30px] sm:text-[34px]',
            )}
            style={{ color: 'hsl(var(--sab-fg))' }}
          >
            {title}
          </h1>
          {description ? (
            <p
              className={cn(
                'max-w-[65ch] leading-relaxed',
                hero ? 'text-[16px]' : 'text-[15px]',
              )}
              style={{ color: 'hsl(var(--sab-fg-muted))' }}
            >
              {description}
            </p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
        ) : null}
      </div>
    </header>
  );
}
