/**
 * Create item — `/dashboard/crm/products/new`.
 *
 * Server component: handles `?fromKind=product&fromId=` cross-doc
 * pre-fill (fetches the source item) and hands off to the shared
 * `<ItemForm>` (also used by Edit).
 *
 * Per CRM_REBUILD_PLAN §1D.3.
 */

import * as React from 'react';
import { getCrmProductById } from '@/app/actions/crm-products.actions';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { ZoruSkeleton, ZoruCard } from '@/components/zoruui';
import { ItemForm } from '../_components/item-form';

export const dynamic = 'force-dynamic';

interface SearchParams {
  fromKind?: string;
  fromId?: string;
  type?: string;
}

interface PageProps {
  searchParams: Promise<SearchParams>;
}

function ItemFormSkeleton() {
  return (
    <div className="space-y-6 w-full animate-pulse">
      {/* Basic Details Skeleton */}
      <ZoruCard className="p-6 space-y-4">
        <ZoruSkeleton className="h-6 w-32 rounded bg-zoru-surface-2 dark:bg-zoru-ink" />
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <ZoruSkeleton className="h-4 w-16 rounded bg-zoru-surface-2 dark:bg-zoru-ink" />
            <ZoruSkeleton className="h-10 w-full rounded bg-zoru-surface-2 dark:bg-zoru-ink" />
          </div>
          <div className="space-y-2">
            <ZoruSkeleton className="h-4 w-12 rounded bg-zoru-surface-2 dark:bg-zoru-ink" />
            <ZoruSkeleton className="h-10 w-full rounded bg-zoru-surface-2 dark:bg-zoru-ink" />
          </div>
        </div>
        <div className="space-y-2">
          <ZoruSkeleton className="h-4 w-20 rounded bg-zoru-surface-2 dark:bg-zoru-ink" />
          <ZoruSkeleton className="h-10 w-full rounded bg-zoru-surface-2 dark:bg-zoru-ink" />
        </div>
      </ZoruCard>

      {/* Pricing & Stock Skeleton */}
      <ZoruCard className="p-6 space-y-4">
        <ZoruSkeleton className="h-6 w-36 rounded bg-zoru-surface-2 dark:bg-zoru-ink" />
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <ZoruSkeleton className="h-4 w-24 rounded bg-zoru-surface-2 dark:bg-zoru-ink" />
            <ZoruSkeleton className="h-10 w-full rounded bg-zoru-surface-2 dark:bg-zoru-ink" />
          </div>
          <div className="space-y-2">
            <ZoruSkeleton className="h-4 w-20 rounded bg-zoru-surface-2 dark:bg-zoru-ink" />
            <ZoruSkeleton className="h-10 w-full rounded bg-zoru-surface-2 dark:bg-zoru-ink" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 items-center">
          <div className="flex items-center gap-2 h-10">
            <ZoruSkeleton className="h-4 w-4 rounded bg-zoru-surface-2 dark:bg-zoru-ink" />
            <ZoruSkeleton className="h-4 w-28 rounded bg-zoru-surface-2 dark:bg-zoru-ink" />
          </div>
          <div className="space-y-2">
            <ZoruSkeleton className="h-4 w-24 rounded bg-zoru-surface-2 dark:bg-zoru-ink" />
            <ZoruSkeleton className="h-10 w-full rounded bg-zoru-surface-2 dark:bg-zoru-ink" />
          </div>
        </div>
        <div className="space-y-2">
          <ZoruSkeleton className="h-4 w-40 rounded bg-zoru-surface-2 dark:bg-zoru-ink" />
          <ZoruSkeleton className="h-10 w-full rounded bg-zoru-surface-2 dark:bg-zoru-ink" />
        </div>
      </ZoruCard>

      {/* Supplier Information Skeleton */}
      <ZoruCard className="p-6 space-y-4">
        <ZoruSkeleton className="h-6 w-44 rounded bg-zoru-surface-2 dark:bg-zoru-ink" />
        <ZoruSkeleton className="h-4 w-64 rounded bg-zoru-surface-2 dark:bg-zoru-ink" />
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <ZoruSkeleton className="h-4 w-28 rounded bg-zoru-surface-2 dark:bg-zoru-ink" />
            <ZoruSkeleton className="h-10 w-full rounded bg-zoru-surface-2 dark:bg-zoru-ink" />
          </div>
          <div className="space-y-2">
            <ZoruSkeleton className="h-4 w-32 rounded bg-zoru-surface-2 dark:bg-zoru-ink" />
            <ZoruSkeleton className="h-10 w-full rounded bg-zoru-surface-2 dark:bg-zoru-ink" />
          </div>
        </div>
        <div className="space-y-2">
          <ZoruSkeleton className="h-4 w-32 rounded bg-zoru-surface-2 dark:bg-zoru-ink" />
          <ZoruSkeleton className="h-10 w-full rounded bg-zoru-surface-2 dark:bg-zoru-ink" />
        </div>
      </ZoruCard>

      {/* Actions Skeleton */}
      <div className="flex justify-end gap-2">
        <ZoruSkeleton className="h-10 w-24 rounded bg-zoru-surface-2 dark:bg-zoru-ink" />
        <ZoruSkeleton className="h-10 w-32 rounded bg-zoru-surface-2 dark:bg-zoru-ink" />
      </div>
    </div>
  );
}

interface ItemNewFormContainerProps {
  searchParams: SearchParams;
}

async function ItemNewFormContainer({ searchParams }: ItemNewFormContainerProps) {
  let initial = null;
  if (searchParams.fromKind === 'product' && searchParams.fromId) {
    const source = await getCrmProductById(searchParams.fromId);
    if (source) {
      const { _id: _omit, sku: sourceSku, ...rest } = source as {
        _id: unknown;
        sku?: string;
      } & Record<string, unknown>;
      void _omit;
      // Drop the id (so the action creates a new doc) and bump SKU so it
      // doesn't collide with the source.
      initial = {
        ...rest,
        sku: sourceSku ? `${sourceSku}-COPY` : '',
        name: `${(source.name as string) ?? 'Item'} (copy)`,
        images: rest.images ? JSON.parse(JSON.stringify(rest.images)) : [],
      } as never;
    }
  }

  return <ItemForm initial={initial} />;
}

export default async function NewItemPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const isDuplicate = sp.fromKind === 'product' && !!sp.fromId;

  return (
    <EntityDetailShell
      eyebrow="PRODUCT"
      title={isDuplicate ? 'Duplicate item' : 'New item'}
      back={{ href: '/dashboard/crm/products', label: 'Products' }}
    >
      <React.Suspense fallback={<ItemFormSkeleton />}>
        <ItemNewFormContainer searchParams={sp} />
      </React.Suspense>
    </EntityDetailShell>
  );
}
