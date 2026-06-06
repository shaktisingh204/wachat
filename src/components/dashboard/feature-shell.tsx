'use client';

import * as React from 'react';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator, PageHeader, PageHeading, PageTitle, PageDescription, PageActions, Card, StatCard, EmptyState } from '@/components/sabcrm/20ui/compat';

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
          <BreadcrumbList>
            {breadcrumbs.map((crumb, idx) => (
              <React.Fragment key={idx}>
                <BreadcrumbItem>
                  {crumb.href ? (
                    <BreadcrumbLink href={crumb.href}>{crumb.label}</BreadcrumbLink>
                  ) : (
                    <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                  )}
                </BreadcrumbItem>
                {idx < breadcrumbs.length - 1 && <BreadcrumbSeparator />}
              </React.Fragment>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
      )}

      {/* Header */}
      <PageHeader bordered={false}>
        <PageHeading>
          <PageTitle>{title}</PageTitle>
          <PageDescription>{description}</PageDescription>
        </PageHeading>
        {actions && <PageActions>{actions}</PageActions>}
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
