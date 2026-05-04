"use client";

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

import {
  ZoruBreadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  ZoruPageActions,
  ZoruPageDescription,
  ZoruPageEyebrow,
  ZoruPageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
} from "@/components/zoruui";

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
        <ZoruBreadcrumbSeparator />
        <ZoruBreadcrumbItem>
          {parentLabel || pageLabel ? (
            <ZoruBreadcrumbLink href="/dashboard/facebook/commerce/shop">
              Commerce
            </ZoruBreadcrumbLink>
          ) : (
            <ZoruBreadcrumbPage>Commerce</ZoruBreadcrumbPage>
          )}
        </ZoruBreadcrumbItem>
        {parentLabel ? (
          <>
            <ZoruBreadcrumbSeparator />
            <ZoruBreadcrumbItem>
              {parentHref ? (
                <ZoruBreadcrumbLink href={parentHref}>
                  {section}
                </ZoruBreadcrumbLink>
              ) : (
                <ZoruBreadcrumbPage>{section}</ZoruBreadcrumbPage>
              )}
            </ZoruBreadcrumbItem>
            <ZoruBreadcrumbSeparator />
            <ZoruBreadcrumbItem>
              <ZoruBreadcrumbPage>{parentLabel}</ZoruBreadcrumbPage>
            </ZoruBreadcrumbItem>
          </>
        ) : (
          <>
            <ZoruBreadcrumbSeparator />
            <ZoruBreadcrumbItem>
              <ZoruBreadcrumbPage>{pageLabel ?? section}</ZoruBreadcrumbPage>
            </ZoruBreadcrumbItem>
          </>
        )}
      </ZoruBreadcrumbList>
    </ZoruBreadcrumb>
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
    <ZoruPageHeader className="mt-5">
      <ZoruPageHeading>
        <ZoruPageEyebrow>{eyebrow}</ZoruPageEyebrow>
        <ZoruPageTitle>{title}</ZoruPageTitle>
        {description ? (
          <ZoruPageDescription>{description}</ZoruPageDescription>
        ) : null}
      </ZoruPageHeading>
      {actions ? <ZoruPageActions>{actions}</ZoruPageActions> : null}
    </ZoruPageHeader>
  );
}
