"use client";

import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator, PageActions, PageDescription, PageEyebrow, PageHeader, PageHeading, PageTitle } from '@/components/sabcrm/20ui/compat';
/**
 * Local Meta Suite › Commerce shells.
 *
 * Each page composes:
 *   <CommercePage>
 *     <CommerceBreadcrumb section="Orders" />
 *     <CommerceHeader title="…" description="…" actions={…} />
 *     {children}
 *   </CommercePage>
 *
 * Pure ZoruUI primitives + neutral tokens — no clay, no @/components/ui.
 */

import * as React from "react";

export function CommercePage({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[1320px] px-6 pt-6 pb-10">
      {children}
    </div>
  );
}

export function CommerceBreadcrumb({
  section,
  parentLabel,
  parentHref,
  pageLabel,
}: {
  section: string;
  /** Optional intermediate crumb (e.g., catalog name). */
  parentLabel?: string;
  parentHref?: string;
  /** Final crumb label (defaults to section). */
  pageLabel?: string;
}) {
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
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          {parentLabel || pageLabel ? (
            <BreadcrumbLink href="/dashboard/facebook/commerce/shop">
              Commerce
            </BreadcrumbLink>
          ) : (
            <BreadcrumbPage>Commerce</BreadcrumbPage>
          )}
        </BreadcrumbItem>
        {parentLabel ? (
          <>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              {parentHref ? (
                <BreadcrumbLink href={parentHref}>
                  {section}
                </BreadcrumbLink>
              ) : (
                <BreadcrumbPage>{section}</BreadcrumbPage>
              )}
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{parentLabel}</BreadcrumbPage>
            </BreadcrumbItem>
          </>
        ) : (
          <>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{pageLabel ?? section}</BreadcrumbPage>
            </BreadcrumbItem>
          </>
        )}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

export function CommerceHeader({
  eyebrow = "Meta Suite",
  title,
  description,
  actions,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <PageHeader className="mt-5">
      <PageHeading>
        <PageEyebrow>{eyebrow}</PageEyebrow>
        <PageTitle>{title}</PageTitle>
        {description ? (
          <PageDescription>{description}</PageDescription>
        ) : null}
      </PageHeading>
      {actions ? <PageActions>{actions}</PageActions> : null}
    </PageHeader>
  );
}
