/**
 * Edit item — `/dashboard/crm/products/[productId]/edit`.
 *
 * Server component: fetches the item via `getCrmProductById` (dual-impl),
 * then renders the shared `<ItemForm>` pre-loaded with values. Mirrors
 * the new page but in edit mode.
 *
 * Per CRM_REBUILD_PLAN §1D.3.
 */

import * as React from 'react';
import { notFound } from 'next/navigation';

import { getCrmProductById } from '@/app/actions/crm-products.actions';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { ItemForm } from '../../_components/item-form';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ productId: string }>;
}

function ProductEditSkeleton() {
  return (
    <div className="space-y-6 w-full animate-pulse">
      {/* Basic Details Skeleton */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-6 space-y-4">
        <div className="h-6 w-32 bg-zinc-200 dark:bg-zinc-800 rounded" />
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="h-4 w-16 bg-zinc-200 dark:bg-zinc-800 rounded" />
            <div className="h-10 w-full bg-zinc-100 dark:bg-zinc-900 rounded-lg border border-zinc-200/50 dark:border-zinc-800/50" />
          </div>
          <div className="space-y-2">
            <div className="h-4 w-12 bg-zinc-200 dark:bg-zinc-800 rounded" />
            <div className="h-10 w-full bg-zinc-100 dark:bg-zinc-900 rounded-lg border border-zinc-200/50 dark:border-zinc-800/50" />
          </div>
        </div>

        <div className="space-y-2">
          <div className="h-4 w-20 bg-zinc-200 dark:bg-zinc-800 rounded" />
          <div className="h-10 w-full bg-zinc-100 dark:bg-zinc-900 rounded-lg border border-zinc-200/50 dark:border-zinc-800/50" />
        </div>
      </div>

      {/* Pricing & Stock Skeleton */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-6 space-y-4">
        <div className="h-6 w-36 bg-zinc-200 dark:bg-zinc-800 rounded" />
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="h-4 w-24 bg-zinc-200 dark:bg-zinc-800 rounded" />
            <div className="h-10 w-full bg-zinc-100 dark:bg-zinc-900 rounded-lg border border-zinc-200/50 dark:border-zinc-800/50" />
          </div>
          <div className="space-y-2">
            <div className="h-4 w-20 bg-zinc-200 dark:bg-zinc-800 rounded" />
            <div className="h-10 w-full bg-zinc-100 dark:bg-zinc-900 rounded-lg border border-zinc-200/50 dark:border-zinc-800/50" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 items-center">
          <div className="flex items-center gap-2 py-2">
            <div className="h-4 w-4 bg-zinc-200 dark:bg-zinc-800 rounded" />
            <div className="h-4 w-28 bg-zinc-200 dark:bg-zinc-800 rounded" />
          </div>
          <div className="space-y-2">
            <div className="h-4 w-24 bg-zinc-200 dark:bg-zinc-800 rounded" />
            <div className="h-10 w-full bg-zinc-100 dark:bg-zinc-900 rounded-lg border border-zinc-200/50 dark:border-zinc-800/50" />
          </div>
        </div>
        
        <div className="space-y-2">
          <div className="h-4 w-48 bg-zinc-200 dark:bg-zinc-800 rounded" />
          <div className="h-10 w-full bg-zinc-100 dark:bg-zinc-900 rounded-lg border border-zinc-200/50 dark:border-zinc-800/50" />
        </div>
      </div>

      {/* Supplier Information Skeleton */}
      <div className="rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-950/50 p-6 space-y-4">
        <div className="h-6 w-44 bg-zinc-200 dark:bg-zinc-800 rounded" />
        <div className="h-4 w-64 bg-zinc-100 dark:bg-zinc-900 rounded" />
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="h-4 w-28 bg-zinc-200 dark:bg-zinc-800 rounded" />
            <div className="h-10 w-full bg-zinc-100 dark:bg-zinc-900 rounded-lg border border-zinc-200/50 dark:border-zinc-800/50" />
          </div>
          <div className="space-y-2">
            <div className="h-4 w-32 bg-zinc-200 dark:bg-zinc-800 rounded" />
            <div className="h-10 w-full bg-zinc-100 dark:bg-zinc-900 rounded-lg border border-zinc-200/50 dark:border-zinc-800/50" />
          </div>
        </div>
        <div className="space-y-2">
          <div className="h-4 w-32 bg-zinc-200 dark:bg-zinc-800 rounded" />
          <div className="h-10 w-full bg-zinc-100 dark:bg-zinc-900 rounded-lg border border-zinc-200/50 dark:border-zinc-800/50" />
        </div>
      </div>

      {/* Buttons Skeleton */}
      <div className="flex justify-end gap-2">
        <div className="h-10 w-24 bg-zinc-200 dark:bg-zinc-800 rounded-lg" />
        <div className="h-10 w-32 bg-zinc-200 dark:bg-zinc-800 rounded-lg" />
      </div>
    </div>
  );
}

interface ItemEditFormContainerProps {
  productId: string;
}

async function ItemEditFormContainer({ productId }: ItemEditFormContainerProps) {
  const product = await getCrmProductById(productId);
  if (!product) notFound();

  return <ItemForm initial={product} />;
}

export default async function EditItemPage({ params }: PageProps) {
  const { productId } = await params;

  return (
    <EntityDetailShell
      eyebrow="PRODUCT"
      title="Edit Product"
      back={{ href: `/dashboard/crm/products/${productId}`, label: 'Back to product' }}
    >
      <React.Suspense fallback={<ProductEditSkeleton />}>
        <ItemEditFormContainer productId={productId} />
      </React.Suspense>
    </EntityDetailShell>
  );
}
