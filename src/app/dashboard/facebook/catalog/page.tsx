'use client';

import {
  Alert,
  ZoruAlertDescription,
  ZoruAlertTitle,
  Badge,
  Breadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  Button,
  Card,
  EmptyState,
  Input,
  Skeleton,
  useZoruToast,
} from '@/components/sabcrm/20ui/compat';
import {
  useCallback,
  useEffect,
  useState,
  useTransition } from 'react';
import Link from 'next/link';
import { AlertCircle,
  Package,
  RefreshCw,
  ShoppingBag } from 'lucide-react';

import { useProject } from '@/context/project-context';
import { getCatalogs,
  syncCatalogs } from '@/app/actions/catalog.actions';
import type { MetaSuiteCatalog } from '@/lib/rust-client/meta-suite';

/**
 * /dashboard/facebook/catalog — Meta Business catalogs index.
 *
 * Lists product catalogs owned by the connected Meta Business via the
 * `meta-suite` Rust crate. Each row links into the existing
 * `/dashboard/facebook/commerce/products/[catalogId]` detail page.
 */

import * as React from 'react';

export default function FacebookCatalogPage(): React.JSX.Element {
  const { activeProject } = useProject();
  const projectId = activeProject?._id?.toString() ?? '';
  const { toast } = useZoruToast();

  const [catalogs, setCatalogs] = useState<MetaSuiteCatalog[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [loading, startLoading] = useTransition();
  const [syncing, startSyncing] = useTransition();

  const refresh = useCallback(() => {
    if (!projectId) return;
    startLoading(async () => {
      const res = await getCatalogs(projectId);
      if (res.error) {
        setError(res.error);
        setCatalogs([]);
        return;
      }
      setError(null);
      setCatalogs((res.catalogs ?? []) as unknown as MetaSuiteCatalog[]);
    });
  }, [projectId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const onSync = () => {
    if (!projectId) return;
    startSyncing(async () => {
      const res = await syncCatalogs(projectId);
      if (!res.success) {
        toast({
          title: 'Sync failed',
          description: res.error ?? 'Unknown error',
          variant: 'destructive',
        });
        return;
      }
      toast({
        title: 'Catalogs synced',
        description: res.message ?? 'Catalog list refreshed from Meta.',
      });
      refresh();
    });
  };

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return catalogs;
    return catalogs.filter((c) => c.name.toLowerCase().includes(q));
  }, [catalogs, search]);

  if (!projectId) {
    return (
      <div className="p-6">
        <EmptyState
          icon={<ShoppingBag />}
          title="No project selected"
          description="Pick a Facebook page / project to see its catalogs."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-4 px-6 pt-6 pb-10">
      <Breadcrumb>
        <ZoruBreadcrumbList>
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard">Dashboard</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard/facebook">Meta Suite</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbPage>Catalogs</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </Breadcrumb>

      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl text-zoru-ink">Catalogs</h1>
          <p className="mt-1 text-sm text-zoru-ink-muted">
            Product catalogs owned by the connected Meta Business. Backed by{' '}
            <code>meta-suite</code>.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={refresh} disabled={loading || syncing}>
            <RefreshCw
              className={loading ? 'mr-2 h-4 w-4 animate-spin' : 'mr-2 h-4 w-4'}
            />
            Refresh
          </Button>
          <Button onClick={onSync} disabled={syncing}>
            <RefreshCw
              className={syncing ? 'mr-2 h-4 w-4 animate-spin' : 'mr-2 h-4 w-4'}
            />
            {syncing ? 'Syncing…' : 'Sync from Meta'}
          </Button>
        </div>
      </header>

      {error && (
        <Alert variant="destructive">
          <AlertCircle />
          <ZoruAlertTitle>Could not load catalogs</ZoruAlertTitle>
          <ZoruAlertDescription>{error}</ZoruAlertDescription>
        </Alert>
      )}

      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Filter catalogs by name…"
      />

      {loading && catalogs.length === 0 ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<ShoppingBag />}
          title={catalogs.length === 0 ? 'No catalogs found' : 'No matches'}
          description={
            catalogs.length === 0
              ? 'Click "Sync from Meta" to import catalogs owned by this Business.'
              : 'Try a different search term.'
          }
          action={
            catalogs.length === 0 ? (
              <Button onClick={onSync} disabled={syncing}>
                <RefreshCw
                  className={syncing ? 'mr-2 h-4 w-4 animate-spin' : 'mr-2 h-4 w-4'}
                />
                Sync from Meta
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => (
            <Card key={c.id} className="flex flex-col gap-3 p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="line-clamp-1 text-base text-zoru-ink">{c.name}</p>
                  <p className="font-mono text-[11px] text-zoru-ink-muted">{c.id}</p>
                </div>
                <Badge variant="ghost">
                  <Package className="mr-1 h-3 w-3" />
                  {c.product_count ?? 0}
                </Badge>
              </div>
              <footer className="flex justify-end border-t border-zoru-line pt-3">
                <Button asChild size="sm">
                  <Link
                    href={`/dashboard/facebook/commerce/products/${encodeURIComponent(c.id)}`}
                  >
                    Open products
                  </Link>
                </Button>
              </footer>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
