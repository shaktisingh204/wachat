import React, { Suspense } from 'react';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator, EmptyState, PageDescription, PageHeader, PageHeading, PageTitle } from '@/components/sabcrm/20ui';
import { Store } from 'lucide-react';
import { listApps, listInstallsForTenant } from '@/lib/marketplace';
import type { AppListFilter } from '@/lib/marketplace';
import { AppCardClient } from './app-card-client';
import { getCachedSession } from '@/lib/server-cache';
import { Loader2 } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'App Marketplace — SabNode',
  description: 'Browse and install apps that extend SabNode.',
};

interface PageProps {
  searchParams?: Promise<{
    q?: string;
    category?: string;
    pricingType?: string;
    page?: string;
  }>;
}

async function MarketplaceAppsData({ filter }: { filter: AppListFilter }) {
  const session = await getCachedSession();
  const userId = session?.user?._id?.toString() || '';

  let apps: Awaited<ReturnType<typeof listApps>>['apps'] = [];
  let total = 0;
  let installedAppIds = new Set<string>();
  let loadError: string | null = null;
  
  try {
    const [result, installs] = await Promise.all([
      listApps(filter),
      userId ? listInstallsForTenant(userId) : Promise.resolve([])
    ]);
    apps = result.apps;
    total = result.total;
    installedAppIds = new Set(installs.map(i => i.appId));
  } catch (err) {
    console.error('[dashboard/marketplace] listApps failed', err);
    loadError = 'Could not load the marketplace. Please try again later.';
  }

  return (
    <>
      <PageHeader>
        <PageHeading>
          <PageTitle>App Marketplace</PageTitle>
          <PageDescription>
            Extend SabNode with apps from our developer community
            {total > 0 ? ` — ${total} app${total === 1 ? '' : 's'} available` : ''}.
          </PageDescription>
        </PageHeading>
      </PageHeader>

      {loadError ? (
        <div className="rounded-md border border-[var(--st-danger)]/40 bg-[var(--st-danger)]/10 p-4 text-sm text-[var(--st-danger)]">
          {loadError}
        </div>
      ) : apps.length === 0 ? (
        <EmptyState
          icon={<Store />}
          title="No apps found"
          description={
            filter.q
              ? `Nothing matched "${filter.q}". Try a different search or clear filters.`
              : 'The marketplace is currently empty. Check back soon — new apps are on the way.'
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {apps.map((app) => (
            <AppCardClient key={app.appId} app={app} isInstalled={installedAppIds.has(app.appId)} />
          ))}
        </div>
      )}
    </>
  );
}

export default async function MarketplacePage({ searchParams }: PageProps) {
  const sp = (await searchParams) ?? {};
  const filter: AppListFilter = {
    q: sp.q,
    category: sp.category,
    pricingType: (sp.pricingType as AppListFilter['pricingType']) ?? undefined,
    page: sp.page ? Number(sp.page) : 1,
    limit: 24,
  };

  return (
    <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-6 px-6 pt-6 pb-10">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard">SabNode</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Marketplace</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <Suspense fallback={
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-[var(--st-text)]" />
        </div>
      }>
        <MarketplaceAppsData filter={filter} />
      </Suspense>
    </div>
  );
}
