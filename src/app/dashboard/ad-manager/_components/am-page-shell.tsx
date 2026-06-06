"use client";

import { Alert, AlertDescription, AlertTitle, Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator, PageActions, PageDescription, PageHeader, PageHeading, PageTitle } from '@/components/sabcrm/20ui';
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
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink href="/dashboard">SabNode</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbLink href="/dashboard/ad-manager">
            Ad Manager
          </BreadcrumbLink>
        </BreadcrumbItem>
        {parent && (
          <>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href={parent.href}>
                {parent.label}
              </BreadcrumbLink>
            </BreadcrumbItem>
          </>
        )}
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>{page}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
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
      <PageHeading>
        <PageTitle>{title}</PageTitle>
        {description && (
          <PageDescription>{description}</PageDescription>
        )}
      </PageHeading>
      {actions ? <PageActions>{actions}</PageActions> : null}
    </PageHeader>
  );
}

export function AmNoProject() {
  return (
    <Alert variant="destructive" className="mt-6">
      <CircleAlert />
      <AlertTitle>No project selected</AlertTitle>
      <AlertDescription>
        Please select a project from the main dashboard to manage ad campaigns.
      </AlertDescription>
    </Alert>
  );
}

export function AmErrorAlert({ message }: { message: string }) {
  return (
    <Alert variant="destructive" className="mt-6">
      <CircleAlert />
      <AlertTitle>Something went wrong</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}
