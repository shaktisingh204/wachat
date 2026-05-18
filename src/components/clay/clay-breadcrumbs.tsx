import {
  ZoruBreadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
} from '@/components/zoruui';
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
 * ClayBreadcrumbs — delegates to the shadcn ZoruBreadcrumb primitive set.
 * Trailing segment renders as `ZoruBreadcrumbPage`; preceding segments use
 * `ZoruBreadcrumbLink` (with next/link via `asChild` when an href is provided).
 */
export const ClayBreadcrumbs = React.forwardRef<
  HTMLElement,
  ClayBreadcrumbsProps
>(({ items, className, ...props }, ref) => (
  <ZoruBreadcrumb
    ref={ref}
    className={cn('text-[13px] leading-none', className)}
    {...props}
  >
    <ZoruBreadcrumbList>
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        return (
          <React.Fragment key={`${item.label}-${i}`}>
            {i > 0 ? (
              <ZoruBreadcrumbSeparator className="text-muted-foreground/60">
                /
              </ZoruBreadcrumbSeparator>
            ) : null}
            <ZoruBreadcrumbItem>
              {isLast ? (
                <ZoruBreadcrumbPage className="font-medium">
                  {item.label}
                </ZoruBreadcrumbPage>
              ) : item.href ? (
                <ZoruBreadcrumbLink asChild>
                  <Link href={item.href}>{item.label}</Link>
                </ZoruBreadcrumbLink>
              ) : (
                <span className="text-muted-foreground">{item.label}</span>
              )}
            </ZoruBreadcrumbItem>
          </React.Fragment>
        );
      })}
    </ZoruBreadcrumbList>
  </ZoruBreadcrumb>
));
ClayBreadcrumbs.displayName = 'ClayBreadcrumbs';
