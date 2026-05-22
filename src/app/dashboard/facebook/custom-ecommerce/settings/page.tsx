'use client';

import {
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
} from '@/components/zoruui';
import {
  useEffect,
  useState } from 'react';
import Link from 'next/link';
import { Cog,
  Store } from 'lucide-react';

import { useProject } from '@/context/project-context';
import { getEcommShops } from '@/app/actions/custom-ecommerce.actions';
import type { EcommShop } from '@/lib/definitions';
import type { WithId } from 'mongodb';

/**
 * /dashboard/facebook/custom-ecommerce/settings — workspace-level
 * Custom Shops settings landing. Lists every shop in the active project
 * and links into the per-shop settings page where the heavy form lives.
 */

import * as React from 'react';

export default function CustomEcommerceSettingsPage(): React.JSX.Element {
  const { activeProject } = useProject();
  const projectId = activeProject?._id?.toString() ?? '';

  const [shops, setShops] = useState<WithId<EcommShop>[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!projectId) return;
    (async () => {
      const list = await getEcommShops(projectId);
      setShops(list);
      setLoaded(true);
    })();
  }, [projectId]);

  if (!projectId) {
    return (
      <div className="p-6">
        <ZoruEmptyState
          icon={<Cog />}
          title="No project selected"
          description="Pick a project to manage its Custom Shops settings."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-4 px-6 pt-6 pb-10">
      <ZoruBreadcrumb>
        <ZoruBreadcrumbList>
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard">Dashboard</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard/facebook/custom-ecommerce">
              Custom Shops
            </ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbPage>Settings</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </ZoruBreadcrumb>

      <header>
        <h1 className="text-2xl text-zoru-ink">Custom Shops settings</h1>
        <p className="mt-1 text-sm text-zoru-ink-muted">
          Pick a shop to edit its basics, payment, abandoned-cart settings,
          persistent menu, and custom domain.
        </p>
      </header>

      {loaded && shops.length === 0 ? (
        <ZoruEmptyState
          icon={<Store />}
          title="No shops yet"
          description="Create a shop on the Custom Shops dashboard before configuring settings."
          action={
            <ZoruButton asChild>
              <Link href="/dashboard/facebook/custom-ecommerce">Open Custom Shops</Link>
            </ZoruButton>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {shops.map((s) => {
            const id = s._id.toString();
            const slug = (s as unknown as { slug?: string }).slug ?? '';
            return (
              <ZoruCard key={id} className="flex flex-col gap-3 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="line-clamp-1 text-base text-zoru-ink">{s.name}</p>
                    {slug ? (
                      <p className="font-mono text-[11px] text-zoru-ink-muted">/{slug}</p>
                    ) : null}
                  </div>
                  <ZoruBadge variant="ghost">
                    {(s as unknown as { isPublished?: boolean }).isPublished
                      ? 'live'
                      : 'draft'}
                  </ZoruBadge>
                </div>
                <footer className="flex justify-end border-t border-zoru-line pt-3">
                  <ZoruButton asChild size="sm">
                    <Link
                      href={`/dashboard/facebook/custom-ecommerce/manage/${id}/settings`}
                    >
                      <Cog className="mr-2 h-4 w-4" />
                      Configure
                    </Link>
                  </ZoruButton>
                </footer>
              </ZoruCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
