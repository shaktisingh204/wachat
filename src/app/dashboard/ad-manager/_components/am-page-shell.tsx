"use client";

import {
  Alert,
  ZoruAlertDescription,
  ZoruAlertTitle,
  Breadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  ZoruPageActions,
  ZoruPageDescription,
  PageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
} from '@/components/zoruui';
import {
  CircleAlert } from "lucide-react";

/**
 * Shared chrome for /dashboard/ad-manager ZoruUI pages.
 *
 * - <AmBreadcrumb> renders SabNode › Ad Manager › <section>.
 * - <AmHeader> renders PageHeader with title / description / actions.
 * - <AmNoProject> is the canonical empty state for "No project selected".
 * - <AmErrorAlert> is the canonical error.
 *
 * All migrated ad-manager pages import from here so headers stay
 * consistent. Mirrors src/app/dashboard/facebook/_components/zoru-fb-page-shell.tsx.
 */

import * as React from "react";

interface AmBreadcrumbProps {
  page: string;
  parent?: { label: string; href: string };
}

export function AmBreadcrumb({ page, parent }: AmBreadcrumbProps) {
  return (
    <Breadcrumb>
      <ZoruBreadcrumbList>
        <ZoruBreadcrumbItem>
          <ZoruBreadcrumbLink href="/dashboard">SabNode</ZoruBreadcrumbLink>
        </ZoruBreadcrumbItem>
        <ZoruBreadcrumbSeparator />
        <ZoruBreadcrumbItem>
          <ZoruBreadcrumbLink href="/dashboard/ad-manager">
            Ad Manager
          </ZoruBreadcrumbLink>
        </ZoruBreadcrumbItem>
        {parent && (
          <>
            <ZoruBreadcrumbSeparator />
            <ZoruBreadcrumbItem>
              <ZoruBreadcrumbLink href={parent.href}>
                {parent.label}
              </ZoruBreadcrumbLink>
            </ZoruBreadcrumbItem>
          </>
        )}
        <ZoruBreadcrumbSeparator />
        <ZoruBreadcrumbItem>
          <ZoruBreadcrumbPage>{page}</ZoruBreadcrumbPage>
        </ZoruBreadcrumbItem>
      </ZoruBreadcrumbList>
    </Breadcrumb>
  );
}

interface AmHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}

export function AmHeader({
  title,
  description,
  actions,
  className,
}: AmHeaderProps) {
  return (
    <PageHeader className={className ?? "mt-5"}>
      <ZoruPageHeading>
        <ZoruPageTitle>{title}</ZoruPageTitle>
        {description && (
          <ZoruPageDescription>{description}</ZoruPageDescription>
        )}
      </ZoruPageHeading>
      {actions ? <ZoruPageActions>{actions}</ZoruPageActions> : null}
    </PageHeader>
  );
}

export function AmNoProject() {
  return (
    <Alert variant="destructive" className="mt-6">
      <CircleAlert />
      <ZoruAlertTitle>No project selected</ZoruAlertTitle>
      <ZoruAlertDescription>
        Please select a project from the main dashboard to manage ad campaigns.
      </ZoruAlertDescription>
    </Alert>
  );
}

export function AmErrorAlert({ message }: { message: string }) {
  return (
    <Alert variant="destructive" className="mt-6">
      <CircleAlert />
      <ZoruAlertTitle>Something went wrong</ZoruAlertTitle>
      <ZoruAlertDescription>{message}</ZoruAlertDescription>
    </Alert>
  );
}
