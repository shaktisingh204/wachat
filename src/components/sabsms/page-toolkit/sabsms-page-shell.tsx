import * as React from "react";
import Link from "next/link";
import { ChevronRight, HelpCircle, MoreHorizontal } from "lucide-react";

import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator, Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, PageActions, PageDescription, PageEyebrow, PageHeader, PageHeading, PageTitle, Popover, PopoverContent, PopoverTrigger } from '@/components/sabcrm/20ui/compat';

/**
 * Common page shell for every `/sabsms/*` route.
 *
 * Delivers shared features S1-S5: title + description + eyebrow,
 * breadcrumb chain, primary action, secondary action overflow,
 * help popover.
 */

export interface SabsmsBreadcrumb {
  label: string;
  href?: string;
}

export interface SabsmsSecondaryAction {
  label: string;
  onSelectHref?: string;
  onSelectAction?: () => void;
  icon?: React.ReactNode;
  destructive?: boolean;
}

export interface SabsmsPageShellProps {
  eyebrow?: string;
  title: string;
  description?: React.ReactNode;
  breadcrumbs?: SabsmsBreadcrumb[];
  primaryAction?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  secondaryActions?: SabsmsSecondaryAction[];
  helpTitle?: string;
  helpBody?: React.ReactNode;
  toolbar?: React.ReactNode;
  children: React.ReactNode;
}

export function SabsmsPageShell({
  eyebrow,
  title,
  description,
  breadcrumbs,
  primaryAction,
  secondaryActions,
  helpTitle,
  helpBody,
  toolbar,
  children,
}: SabsmsPageShellProps) {
  return (
    <div className="space-y-6 p-6">
      {breadcrumbs && breadcrumbs.length > 0 && (
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/sabsms">SabSMS</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            {breadcrumbs.map((b, i) => (
              <React.Fragment key={`${b.label}-${i}`}>
                <BreadcrumbSeparator>
                  <ChevronRight className="h-3.5 w-3.5" />
                </BreadcrumbSeparator>
                <BreadcrumbItem>
                  {b.href ? (
                    <BreadcrumbLink asChild>
                      <Link href={b.href}>{b.label}</Link>
                    </BreadcrumbLink>
                  ) : (
                    <BreadcrumbPage>{b.label}</BreadcrumbPage>
                  )}
                </BreadcrumbItem>
              </React.Fragment>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
      )}

      <PageHeader>
        <PageHeading>
          {eyebrow && <PageEyebrow>{eyebrow}</PageEyebrow>}
          <div className="flex items-center gap-2">
            <PageTitle>{title}</PageTitle>
            {helpBody && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    aria-label="Help"
                  >
                    <HelpCircle className="h-4 w-4 text-[var(--st-text)]" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 text-sm">
                  {helpTitle && (
                    <div className="mb-2 font-medium">{helpTitle}</div>
                  )}
                  <div className="text-[var(--st-text)]">{helpBody}</div>
                </PopoverContent>
              </Popover>
            )}
          </div>
          {description && (
            <PageDescription>{description}</PageDescription>
          )}
        </PageHeading>

        {(primaryAction || (secondaryActions && secondaryActions.length > 0)) && (
          <PageActions>
            {secondaryActions && secondaryActions.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" aria-label="More actions">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {secondaryActions.map((a, i) =>
                    a.onSelectHref ? (
                      <DropdownMenuItem asChild key={`${a.label}-${i}`}>
                        <Link href={a.onSelectHref}>
                          {a.icon}
                          <span className={a.icon ? "ml-2" : undefined}>
                            {a.label}
                          </span>
                        </Link>
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem
                        key={`${a.label}-${i}`}
                        onSelect={a.onSelectAction}
                        destructive={a.destructive}
                      >
                        {a.icon}
                        <span className={a.icon ? "ml-2" : undefined}>
                          {a.label}
                        </span>
                      </DropdownMenuItem>
                    ),
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {primaryAction &&
              (primaryAction.href ? (
                <Button asChild>
                  <Link href={primaryAction.href}>{primaryAction.label}</Link>
                </Button>
              ) : (
                <Button onClick={primaryAction.onClick}>
                  {primaryAction.label}
                </Button>
              ))}
          </PageActions>
        )}
      </PageHeader>

      {toolbar}

      {children}
    </div>
  );
}
