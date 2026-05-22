import {
  Badge,
  Breadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  Card,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardHeader,
  ZoruCardTitle,
  EmptyState,
  ZoruPageDescription,
  PageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
} from '@/components/zoruui';
/**
 * App Marketplace — browse page.
 *
 * Renders a server-side cards grid of published apps. Filters live in the
 * URL search params so back/forward navigation works without state.
 */

import Link from 'next/link';

import { Store } from 'lucide-react';
import { listApps } from '@/lib/marketplace';
import type { AppListFilter, AppPricing } from '@/lib/marketplace';

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

export default async function MarketplacePage({ searchParams }: PageProps) {
  const sp = (await searchParams) ?? {};
  const filter: AppListFilter = {
    q: sp.q,
    category: sp.category,
    pricingType: (sp.pricingType as AppListFilter['pricingType']) ?? undefined,
    page: sp.page ? Number(sp.page) : 1,
    limit: 24,
  };

  let apps: Awaited<ReturnType<typeof listApps>>['apps'] = [];
  let total = 0;
  let loadError: string | null = null;
  try {
    const result = await listApps(filter);
    apps = result.apps;
    total = result.total;
  } catch (err) {
    console.error('[dashboard/marketplace] listApps failed', err);
    loadError = 'Could not load the marketplace. Please try again later.';
  }

  return (
    <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-6 px-6 pt-6 pb-10">
      <Breadcrumb>
        <ZoruBreadcrumbList>
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard">SabNode</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbPage>Marketplace</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </Breadcrumb>

      <PageHeader>
        <ZoruPageHeading>
          <ZoruPageTitle>App Marketplace</ZoruPageTitle>
          <ZoruPageDescription>
            Extend SabNode with apps from our developer community
            {total > 0 ? ` — ${total} app${total === 1 ? '' : 's'} available` : ''}.
          </ZoruPageDescription>
        </ZoruPageHeading>
      </PageHeader>

      {loadError ? (
        <div className="rounded-md border border-zoru-danger/40 bg-zoru-danger/10 p-4 text-sm text-zoru-danger-ink">
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
            <Link
              key={app.appId}
              href={`/dashboard/marketplace/${encodeURIComponent(app.appId)}`}
              className="group focus:outline-none"
            >
              <Card interactive className="h-full">
                <ZoruCardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      {app.manifest.iconUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={app.manifest.iconUrl}
                          alt=""
                          className="h-10 w-10 rounded-md border border-zoru-line object-cover"
                        />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-md border border-zoru-line bg-zoru-surface-2 text-base font-semibold text-zoru-ink-muted">
                          {app.manifest.name.slice(0, 1).toUpperCase()}
                        </div>
                      )}
                      <div className="flex flex-col">
                        <ZoruCardTitle className="text-base">
                          {app.manifest.name}
                        </ZoruCardTitle>
                        <span className="text-xs text-zoru-ink-muted">
                          by {app.manifest.publisher.name}
                        </span>
                      </div>
                    </div>
                    <PriceBadge pricing={app.manifest.pricing} />
                  </div>
                </ZoruCardHeader>
                <ZoruCardContent className="flex flex-col gap-3">
                  {app.manifest.description ? (
                    <ZoruCardDescription className="line-clamp-3">
                      {app.manifest.description}
                    </ZoruCardDescription>
                  ) : (
                    <ZoruCardDescription className="italic text-zoru-ink-muted">
                      No description provided.
                    </ZoruCardDescription>
                  )}
                  <div className="flex flex-wrap gap-1.5">
                    {app.manifest.categories.slice(0, 3).map((cat) => (
                      <Badge key={cat} variant="secondary" className="text-[10px]">
                        {cat}
                      </Badge>
                    ))}
                  </div>
                  <div className="mt-auto flex items-center justify-between text-xs text-zoru-ink-muted">
                    <span>v{app.manifest.version}</span>
                    <span>
                      {app.installCount.toLocaleString()} install
                      {app.installCount === 1 ? '' : 's'}
                    </span>
                  </div>
                </ZoruCardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function PriceBadge({ pricing }: { pricing: AppPricing }) {
  if (pricing.type === 'free') {
    return <Badge variant="secondary">Free</Badge>;
  }
  const label =
    pricing.type === 'subscription'
      ? 'Subscription'
      : pricing.type === 'one-time'
        ? 'One-time'
        : 'Usage-based';
  const formatted =
    pricing.amount !== undefined && pricing.currency
      ? `${pricing.currency} ${(pricing.amount / 100).toFixed(2)}`
      : null;
  return (
    <Badge variant="outline" className="whitespace-nowrap">
      {formatted ? `${formatted} · ${label}` : label}
    </Badge>
  );
}
