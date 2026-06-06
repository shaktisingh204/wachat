"use client";

import { Alert, AlertDescription, AlertTitle, Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator, PageActions, PageDescription, PageHeader, PageHeading, PageTitle } from '@/components/sabcrm/20ui/compat';
import {
  CircleAlert } from "lucide-react";

/**
 * Shared chrome for Meta Suite ZoruUI pages.
 *
 * - <FbBreadcrumb> renders SabNode › Meta Suite › <section>.
 * - <FbHeader> renders PageHeader with eyebrow / title / description /
 *   actions slot.
 * - <FbNoProject> is the canonical empty state for "No project selected".
 *
 * All Phase 4 pages use these to keep page-headers consistent.
 */

import * as React from "react";

interface FbBreadcrumbProps {
  page: string;
  parent?: { label: string; href: string };
}

export function FbBreadcrumb({ page, parent }: FbBreadcrumbProps) {
  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink href="/dashboard">SabNode</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbLink href="/dashboard/facebook">
            Meta Suite
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

export function FbNoProject() {
  return (
    <Alert variant="destructive" className="mt-6">
      <CircleAlert />
      <AlertTitle>No project selected</AlertTitle>
      <AlertDescription>
        Please select a project from the main dashboard to manage this section.
      </AlertDescription>
    </Alert>
  );
}

export function FbErrorAlert({ message }: { message: string }) {
  return (
    <Alert variant="destructive" className="mt-6">
      <CircleAlert />
      <AlertTitle>Something went wrong</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}
