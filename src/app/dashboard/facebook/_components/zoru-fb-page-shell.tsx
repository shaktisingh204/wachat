"use client";

/**
 * Shared chrome for Meta Suite ZoruUI pages.
 *
 * - <FbBreadcrumb> renders SabNode › Meta Suite › <section>.
 * - <FbHeader> renders ZoruPageHeader with eyebrow / title / description /
 *   actions slot.
 * - <FbNoProject> is the canonical empty state for "No project selected".
 *
 * All Phase 4 pages use these to keep page-headers consistent.
 */

import * as React from "react";
import { CircleAlert } from "lucide-react";

import {
  ZoruAlert,
  ZoruAlertDescription,
  ZoruAlertTitle,
  ZoruBreadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  ZoruPageActions,
  ZoruPageDescription,
  ZoruPageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
} from "@/components/zoruui";

interface FbBreadcrumbProps {
  page: string;
  parent?: { label: string; href: string };
}

export function FbBreadcrumb({ page, parent }: FbBreadcrumbProps) {
  return (
    <ZoruBreadcrumb>
      <ZoruBreadcrumbList>
        <ZoruBreadcrumbItem>
          <ZoruBreadcrumbLink href="/dashboard">SabNode</ZoruBreadcrumbLink>
        </ZoruBreadcrumbItem>
        <ZoruBreadcrumbSeparator />
        <ZoruBreadcrumbItem>
          <ZoruBreadcrumbLink href="/dashboard/facebook">
            Meta Suite
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
    </ZoruBreadcrumb>
  );
}

interface FbHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}

export function FbHeader({
  title,
  description,
  actions,
  className,
}: FbHeaderProps) {
  return (
    <ZoruPageHeader className={className ?? "mt-5"}>
      <ZoruPageHeading>
        <ZoruPageTitle>{title}</ZoruPageTitle>
        {description && (
          <ZoruPageDescription>{description}</ZoruPageDescription>
        )}
      </ZoruPageHeading>
      {actions ? <ZoruPageActions>{actions}</ZoruPageActions> : null}
    </ZoruPageHeader>
  );
}

export function FbNoProject() {
  return (
    <ZoruAlert variant="destructive" className="mt-6">
      <CircleAlert />
      <ZoruAlertTitle>No project selected</ZoruAlertTitle>
      <ZoruAlertDescription>
        Please select a project from the main dashboard to manage this section.
      </ZoruAlertDescription>
    </ZoruAlert>
  );
}

export function FbErrorAlert({ message }: { message: string }) {
  return (
    <ZoruAlert variant="destructive" className="mt-6">
      <CircleAlert />
      <ZoruAlertTitle>Something went wrong</ZoruAlertTitle>
      <ZoruAlertDescription>{message}</ZoruAlertDescription>
    </ZoruAlert>
  );
}
