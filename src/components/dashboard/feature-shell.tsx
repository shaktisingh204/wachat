'use client';

import * as React from 'react';
import {
  Breadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  PageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  ZoruPageDescription,
  ZoruPageActions,
  Card,
  StatCard,
  EmptyState,
} from '@/components/sabcrm/20ui/compat';

interface FeatureShellProps {
  title: string;
  description: string;
  breadcrumbs: { label: string; href?: string }[];
  actions?: React.ReactNode;
  stats?: { label: string; value: string | number; icon?: React.ReactNode; hint?: string }[];
  children: React.ReactNode;
}

export function FeatureShell({
  title,
  description,
  breadcrumbs,
  actions,
  stats,
  children,
}: FeatureShellProps) {
  return (
    <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-6 px-6 pt-6 pb-10">
      {/* Breadcrumb */}
      {breadcrumbs.length > 0 && (
        <Breadcrumb>
          <ZoruBreadcrumbList>
            {breadcrumbs.map((crumb, idx) => (
              <React.Fragment key={idx}>
                <ZoruBreadcrumbItem>
                  {crumb.href ? (
                    <ZoruBreadcrumbLink href={crumb.href}>{crumb.label}</ZoruBreadcrumbLink>
                  ) : (
                    <ZoruBreadcrumbPage>{crumb.label}</ZoruBreadcrumbPage>
                  )}
                </ZoruBreadcrumbItem>
                {idx < breadcrumbs.length - 1 && <ZoruBreadcrumbSeparator />}
              </React.Fragment>
            ))}
          </ZoruBreadcrumbList>
        </Breadcrumb>
      )}

      {/* Header */}
      <PageHeader bordered={false}>
        <ZoruPageHeading>
          <ZoruPageTitle>{title}</ZoruPageTitle>
          <ZoruPageDescription>{description}</ZoruPageDescription>
        </ZoruPageHeading>
        {actions && <ZoruPageActions>{actions}</ZoruPageActions>}
      </PageHeader>

      {/* Stats */}
      {stats && stats.length > 0 && (
        <div className={`grid grid-cols-2 gap-3 sm:grid-cols-${Math.min(stats.length, 4)}`}>
          {stats.map((stat, idx) => (
            <StatCard
              key={idx}
              label={stat.label}
              value={String(stat.value)}
              icon={stat.icon}
            />
          ))}
        </div>
      )}

      {/* Main Content */}
      <div className="flex flex-col gap-4">
        {children}
      </div>
    </div>
  );
}
