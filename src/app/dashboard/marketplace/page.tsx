/**
 * App Marketplace — browse page.
 *
 * Renders a server-side cards grid of published apps. Filters live in the
 * URL search params so back/forward navigation works without state.
 */

import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">App Marketplace</h1>
        <p className="text-muted-foreground">
          Extend SabNode with apps from our developer community
          {total > 0 ? ` — ${total} app${total === 1 ? '' : 's'} available` : ''}.
        </p>
      </header>

      {loadError ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          {loadError}
        </div>
      ) : apps.length === 0 ? (
        <EmptyState query={filter.q} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {apps.map((app) => (
            <Link
              key={app.appId}
              href={`/dashboard/marketplace/${encodeURIComponent(app.appId)}`}
              className="group focus:outline-none"
            >
              <Card variant="interactive" className="h-full">
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      {app.manifest.iconUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={app.manifest.iconUrl}
                          alt=""
                          className="h-10 w-10 rounded-md border object-cover"
                        />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-md border bg-muted text-base font-semibold text-muted-foreground">
                          {app.manifest.name.slice(0, 1).toUpperCase()}
                        </div>
                      )}
                      <div className="flex flex-col">
                        <CardTitle className="text-base group-hover:text-primary">
                          {app.manifest.name}
                        </CardTitle>
                        <span className="text-xs text-muted-foreground">
                          by {app.manifest.publisher.name}
                        </span>
                      </div>
                    </div>
                    <PriceBadge pricing={app.manifest.pricing} />
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  {app.manifest.description ? (
                    <CardDescription className="line-clamp-3">
                      {app.manifest.description}
                    </CardDescription>
                  ) : (
                    <CardDescription className="text-muted-foreground/70 italic">
                      No description provided.
                    </CardDescription>
                  )}
                  <div className="flex flex-wrap gap-1.5">
                    {app.manifest.categories.slice(0, 3).map((cat) => (
                      <Badge key={cat} variant="secondary" className="text-[10px]">
                        {cat}
                      </Badge>
                    ))}
                  </div>
                  <div className="mt-auto flex items-center justify-between text-xs text-muted-foreground">
                    <span>v{app.manifest.version}</span>
                    <span>
                      {app.installCount.toLocaleString()} install
                      {app.installCount === 1 ? '' : 's'}
                    </span>
                  </div>
                </CardContent>
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

function EmptyState({ query }: { query?: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center gap-2 py-16 text-center">
        <h2 className="text-lg font-semibold">No apps found</h2>
        <p className="max-w-md text-sm text-muted-foreground">
          {query
            ? `Nothing matched "${query}". Try a different search or clear filters.`
            : 'The marketplace is currently empty. Check back soon — new apps are on the way.'}
        </p>
      </CardContent>
    </Card>
  );
}
