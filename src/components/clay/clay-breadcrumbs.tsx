import * as React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export interface ClayBreadcrumbItem {
  label: string;
  href?: string;
}

export interface ClayBreadcrumbsProps extends React.HTMLAttributes<HTMLElement> {
  items: ClayBreadcrumbItem[];
}

/**
 * ClayBreadcrumbs — the `Candidates / Junior FrontEnd Developer / Round 3`
 * trail from the reference. Trailing segment is bold-ish ink, preceding
 * segments are soft grey, separated by a thin slash.
 */
export const ClayBreadcrumbs = React.forwardRef<
  HTMLElement,
  ClayBreadcrumbsProps
>(({ items, className, ...props }, ref) => (
  <nav
    ref={ref}
    aria-label="Breadcrumb"
    className={cn('flex items-center text-[13px] leading-none', className)}
    {...props}
  >
    {items.map((item, i) => {
      const isLast = i === items.length - 1;
      return (
        <React.Fragment key={`${item.label}-${i}`}>
          {i > 0 ? (
            <span aria-hidden className="clay-breadcrumb-sep">/</span>
          ) : null}
          {item.href && !isLast ? (
            <Link
              href={item.href}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              {item.label}
            </Link>
          ) : (
            <span
              className={cn(
                isLast
                  ? 'text-foreground font-medium'
                  : 'text-muted-foreground',
              )}
            >
              {item.label}
            </span>
          )}
        </React.Fragment>
      );
    })}
  </nav>
));
ClayBreadcrumbs.displayName = 'ClayBreadcrumbs';
