import * as React from "react";
import Link from "next/link";
import { ChevronRight, HelpCircle, MoreHorizontal } from "lucide-react";

import {
  Breadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  Button,
  DropdownMenu,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuItem,
  ZoruDropdownMenuTrigger,
  ZoruPageActions,
  ZoruPageDescription,
  ZoruPageEyebrow,
  PageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  Popover,
  ZoruPopoverContent,
  ZoruPopoverTrigger,
} from "@/components/zoruui";

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
          <ZoruBreadcrumbList>
            <ZoruBreadcrumbItem>
              <ZoruBreadcrumbLink asChild>
                <Link href="/sabsms">SabSMS</Link>
              </ZoruBreadcrumbLink>
            </ZoruBreadcrumbItem>
            {breadcrumbs.map((b, i) => (
              <React.Fragment key={`${b.label}-${i}`}>
                <ZoruBreadcrumbSeparator>
                  <ChevronRight className="h-3.5 w-3.5" />
                </ZoruBreadcrumbSeparator>
                <ZoruBreadcrumbItem>
                  {b.href ? (
                    <ZoruBreadcrumbLink asChild>
                      <Link href={b.href}>{b.label}</Link>
                    </ZoruBreadcrumbLink>
                  ) : (
                    <ZoruBreadcrumbPage>{b.label}</ZoruBreadcrumbPage>
                  )}
                </ZoruBreadcrumbItem>
              </React.Fragment>
            ))}
          </ZoruBreadcrumbList>
        </Breadcrumb>
      )}

      <PageHeader>
        <ZoruPageHeading>
          {eyebrow && <ZoruPageEyebrow>{eyebrow}</ZoruPageEyebrow>}
          <div className="flex items-center gap-2">
            <ZoruPageTitle>{title}</ZoruPageTitle>
            {helpBody && (
              <Popover>
                <ZoruPopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    aria-label="Help"
                  >
                    <HelpCircle className="h-4 w-4 text-slate-500" />
                  </Button>
                </ZoruPopoverTrigger>
                <ZoruPopoverContent className="w-80 text-sm">
                  {helpTitle && (
                    <div className="mb-2 font-medium">{helpTitle}</div>
                  )}
                  <div className="text-slate-600">{helpBody}</div>
                </ZoruPopoverContent>
              </Popover>
            )}
          </div>
          {description && (
            <ZoruPageDescription>{description}</ZoruPageDescription>
          )}
        </ZoruPageHeading>

        {(primaryAction || (secondaryActions && secondaryActions.length > 0)) && (
          <ZoruPageActions>
            {secondaryActions && secondaryActions.length > 0 && (
              <DropdownMenu>
                <ZoruDropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" aria-label="More actions">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </ZoruDropdownMenuTrigger>
                <ZoruDropdownMenuContent align="end">
                  {secondaryActions.map((a, i) =>
                    a.onSelectHref ? (
                      <ZoruDropdownMenuItem asChild key={`${a.label}-${i}`}>
                        <Link href={a.onSelectHref}>
                          {a.icon}
                          <span className={a.icon ? "ml-2" : undefined}>
                            {a.label}
                          </span>
                        </Link>
                      </ZoruDropdownMenuItem>
                    ) : (
                      <ZoruDropdownMenuItem
                        key={`${a.label}-${i}`}
                        onSelect={a.onSelectAction}
                        destructive={a.destructive}
                      >
                        {a.icon}
                        <span className={a.icon ? "ml-2" : undefined}>
                          {a.label}
                        </span>
                      </ZoruDropdownMenuItem>
                    ),
                  )}
                </ZoruDropdownMenuContent>
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
          </ZoruPageActions>
        )}
      </PageHeader>

      {toolbar}

      {children}
    </div>
  );
}
