import * as React from 'react';
import Link from 'next/link';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { cn } from '@/lib/utils';

export interface ClayBreadcrumbItem {
  label: string;
  href?: string;
}

export interface ClayBreadcrumbsProps extends React.HTMLAttributes<HTMLElement> {
  items: ClayBreadcrumbItem[];
}

/**
 * ClayBreadcrumbs — delegates to the shadcn Breadcrumb primitive set.
 * Trailing segment renders as `BreadcrumbPage`; preceding segments use
 * `BreadcrumbLink` (with next/link via `asChild` when an href is provided).
 */
export const ClayBreadcrumbs = React.forwardRef<
  HTMLElement,
  ClayBreadcrumbsProps
>(({ items, className, ...props }, ref) => (
  <Breadcrumb
    ref={ref}
    className={cn('text-[13px] leading-none', className)}
    {...props}
  >
    <BreadcrumbList>
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        return (
          <React.Fragment key={`${item.label}-${i}`}>
            {i > 0 ? (
              <BreadcrumbSeparator className="text-muted-foreground/60">
                /
              </BreadcrumbSeparator>
            ) : null}
            <BreadcrumbItem>
              {isLast ? (
                <BreadcrumbPage className="font-medium">
                  {item.label}
                </BreadcrumbPage>
              ) : item.href ? (
                <BreadcrumbLink asChild>
                  <Link href={item.href}>{item.label}</Link>
                </BreadcrumbLink>
              ) : (
                <span className="text-muted-foreground">{item.label}</span>
              )}
            </BreadcrumbItem>
          </React.Fragment>
        );
      })}
    </BreadcrumbList>
  </Breadcrumb>
));
ClayBreadcrumbs.displayName = 'ClayBreadcrumbs';
