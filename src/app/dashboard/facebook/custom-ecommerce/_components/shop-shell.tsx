"use client";

import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator, Button, PageActions, PageDescription, PageEyebrow, PageHeader, PageHeading, PageTitle } from '@/components/sabcrm/20ui';
/**
 * Shared ui20-only chrome for the Custom E-commerce manage scope.
 *
 * - `ShopPage`: max-width container with neutral surface tokens.
 * - `ShopBreadcrumb`: SabNode › Meta Suite › Custom Shops › <shop> › <leaf>.
 * - `ShopHeader`: page-header with eyebrow + title + description + actions.
 * - `ShopSubNav`: route-driven sub-page nav using outline/default Ui20Buttons
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
          <BreadcrumbLink href="/dashboard/facebook/custom-ecommerce">
            Custom Shops
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        {leaf ? (
          <>
            <BreadcrumbItem>
              <BreadcrumbLink
                href={`/dashboard/facebook/custom-ecommerce/manage/${shopId}`}
              >
                {shopName}
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{leaf}</BreadcrumbPage>
            </BreadcrumbItem>
          </>
        ) : (
          <BreadcrumbItem>
            <BreadcrumbPage>{shopName}</BreadcrumbPage>
          </BreadcrumbItem>
        )}
      </BreadcrumbList>
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
      <PageHeading>
        {eyebrow ? <PageEyebrow>{eyebrow}</PageEyebrow> : null}
        <PageTitle>{title}</PageTitle>
        {description ? (
          <PageDescription>{description}</PageDescription>
        ) : null}
      </PageHeading>
      {actions ? <PageActions>{actions}</PageActions> : null}
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
