"use client";

import {
  Breadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  Button,
  ZoruPageActions,
  ZoruPageDescription,
  ZoruPageEyebrow,
  PageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
} from '@/components/sabcrm/20ui/compat';
/**
 * Shared zoru-only chrome for the Custom E-commerce manage scope.
 *
 * - `ShopPage`: max-width container with neutral surface tokens.
 * - `ShopBreadcrumb`: SabNode › Meta Suite › Custom Shops › <shop> › <leaf>.
 * - `ShopHeader`: page-header with eyebrow + title + description + actions.
 * - `ShopSubNav`: route-driven sub-page nav using outline/default ZoruButtons
 *   (NOT tabs — per the design directive).
 */

import * as React from "react";
import Link from "next/link";

export function ShopPage({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[1320px] px-6 pt-6 pb-10">
      {children}
    </div>
  );
}

interface ShopBreadcrumbProps {
  shopId: string;
  shopName: string;
  leaf?: string;
}

export function ShopBreadcrumb({
  shopId,
  shopName,
  leaf,
}: ShopBreadcrumbProps) {
  return (
    <Breadcrumb>
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
          <ZoruBreadcrumbLink href="/dashboard/facebook/custom-ecommerce">
            Custom Shops
          </ZoruBreadcrumbLink>
        </ZoruBreadcrumbItem>
        <ZoruBreadcrumbSeparator />
        {leaf ? (
          <>
            <ZoruBreadcrumbItem>
              <ZoruBreadcrumbLink
                href={`/dashboard/facebook/custom-ecommerce/manage/${shopId}`}
              >
                {shopName}
              </ZoruBreadcrumbLink>
            </ZoruBreadcrumbItem>
            <ZoruBreadcrumbSeparator />
            <ZoruBreadcrumbItem>
              <ZoruBreadcrumbPage>{leaf}</ZoruBreadcrumbPage>
            </ZoruBreadcrumbItem>
          </>
        ) : (
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbPage>{shopName}</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        )}
      </ZoruBreadcrumbList>
    </Breadcrumb>
  );
}

interface ShopHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}

export function ShopHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: ShopHeaderProps) {
  return (
    <PageHeader className={className}>
      <ZoruPageHeading>
        {eyebrow ? <ZoruPageEyebrow>{eyebrow}</ZoruPageEyebrow> : null}
        <ZoruPageTitle>{title}</ZoruPageTitle>
        {description ? (
          <ZoruPageDescription>{description}</ZoruPageDescription>
        ) : null}
      </ZoruPageHeading>
      {actions ? <ZoruPageActions>{actions}</ZoruPageActions> : null}
    </PageHeader>
  );
}

export interface ShopSubNavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface ShopSubNavProps {
  items: ShopSubNavItem[];
  pathname: string;
  basePath: string;
}

export function ShopSubNav({ items, pathname, basePath }: ShopSubNavProps) {
  return (
    <nav
      aria-label="Shop sections"
      className="mt-6 flex flex-wrap items-center gap-2 border-b border-[var(--st-border)] pb-4"
    >
      {items.map((item) => {
        const href = `${basePath}${item.href}`;
        // Pathname matches when it equals the leaf or starts with it (nested
        // routes like /flow-builder/docs).
        const isActive =
          pathname === href || pathname.startsWith(`${href}/`);
        const Icon = item.icon;
        return (
          <Button
            key={item.href}
            asChild
            size="sm"
            variant={isActive ? "default" : "outline"}
          >
            <Link href={href}>
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          </Button>
        );
      })}
    </nav>
  );
}
