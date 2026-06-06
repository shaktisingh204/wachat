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
      <div className="rounded-xl border border-[var(--st-border)] dark:border-[var(--st-border)] bg-white dark:bg-[var(--st-text)] p-6 space-y-4">
        <div className="h-6 w-32 bg-[var(--st-bg-muted)] dark:bg-[var(--st-text)] rounded" />
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="h-4 w-16 bg-[var(--st-bg-muted)] dark:bg-[var(--st-text)] rounded" />
            <div className="h-10 w-full bg-[var(--st-bg-muted)] dark:bg-[var(--st-text)] rounded-lg border border-[var(--st-border)]/50 dark:border-[var(--st-border)]/50" />
          </div>
          <div className="space-y-2">
            <div className="h-4 w-12 bg-[var(--st-bg-muted)] dark:bg-[var(--st-text)] rounded" />
            <div className="h-10 w-full bg-[var(--st-bg-muted)] dark:bg-[var(--st-text)] rounded-lg border border-[var(--st-border)]/50 dark:border-[var(--st-border)]/50" />
          </div>
        </div>

        <div className="space-y-2">
          <div className="h-4 w-20 bg-[var(--st-bg-muted)] dark:bg-[var(--st-text)] rounded" />
          <div className="h-10 w-full bg-[var(--st-bg-muted)] dark:bg-[var(--st-text)] rounded-lg border border-[var(--st-border)]/50 dark:border-[var(--st-border)]/50" />
        </div>
      </div>

      {/* Pricing & Stock Skeleton */}
      <div className="rounded-xl border border-[var(--st-border)] dark:border-[var(--st-border)] bg-white dark:bg-[var(--st-text)] p-6 space-y-4">
        <div className="h-6 w-36 bg-[var(--st-bg-muted)] dark:bg-[var(--st-text)] rounded" />
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="h-4 w-24 bg-[var(--st-bg-muted)] dark:bg-[var(--st-text)] rounded" />
            <div className="h-10 w-full bg-[var(--st-bg-muted)] dark:bg-[var(--st-text)] rounded-lg border border-[var(--st-border)]/50 dark:border-[var(--st-border)]/50" />
          </div>
          <div className="space-y-2">
            <div className="h-4 w-20 bg-[var(--st-bg-muted)] dark:bg-[var(--st-text)] rounded" />
            <div className="h-10 w-full bg-[var(--st-bg-muted)] dark:bg-[var(--st-text)] rounded-lg border border-[var(--st-border)]/50 dark:border-[var(--st-border)]/50" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 items-center">
          <div className="flex items-center gap-2 py-2">
            <div className="h-4 w-4 bg-[var(--st-bg-muted)] dark:bg-[var(--st-text)] rounded" />
            <div className="h-4 w-28 bg-[var(--st-bg-muted)] dark:bg-[var(--st-text)] rounded" />
          </div>
          <div className="space-y-2">
            <div className="h-4 w-24 bg-[var(--st-bg-muted)] dark:bg-[var(--st-text)] rounded" />
            <div className="h-10 w-full bg-[var(--st-bg-muted)] dark:bg-[var(--st-text)] rounded-lg border border-[var(--st-border)]/50 dark:border-[var(--st-border)]/50" />
          </div>
        </div>
        
        <div className="space-y-2">
          <div className="h-4 w-48 bg-[var(--st-bg-muted)] dark:bg-[var(--st-text)] rounded" />
          <div className="h-10 w-full bg-[var(--st-bg-muted)] dark:bg-[var(--st-text)] rounded-lg border border-[var(--st-border)]/50 dark:border-[var(--st-border)]/50" />
        </div>
      </div>

      {/* Supplier Information Skeleton */}
      <div className="rounded-xl border border-dashed border-[var(--st-border)] dark:border-[var(--st-border)] bg-white/50 dark:bg-[var(--st-text)]/50 p-6 space-y-4">
        <div className="h-6 w-44 bg-[var(--st-bg-muted)] dark:bg-[var(--st-text)] rounded" />
        <div className="h-4 w-64 bg-[var(--st-bg-muted)] dark:bg-[var(--st-text)] rounded" />
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="h-4 w-28 bg-[var(--st-bg-muted)] dark:bg-[var(--st-text)] rounded" />
            <div className="h-10 w-full bg-[var(--st-bg-muted)] dark:bg-[var(--st-text)] rounded-lg border border-[var(--st-border)]/50 dark:border-[var(--st-border)]/50" />
          </div>
          <div className="space-y-2">
            <div className="h-4 w-32 bg-[var(--st-bg-muted)] dark:bg-[var(--st-text)] rounded" />
            <div className="h-10 w-full bg-[var(--st-bg-muted)] dark:bg-[var(--st-text)] rounded-lg border border-[var(--st-border)]/50 dark:border-[var(--st-border)]/50" />
          </div>
        </div>
        <div className="space-y-2">
          <div className="h-4 w-32 bg-[var(--st-bg-muted)] dark:bg-[var(--st-text)] rounded" />
          <div className="h-10 w-full bg-[var(--st-bg-muted)] dark:bg-[var(--st-text)] rounded-lg border border-[var(--st-border)]/50 dark:border-[var(--st-border)]/50" />
        </div>
      </div>

      {/* Buttons Skeleton */}
      <div className="flex justify-end gap-2">
        <div className="h-10 w-24 bg-[var(--st-bg-muted)] dark:bg-[var(--st-text)] rounded-lg" />
        <div className="h-10 w-32 bg-[var(--st-bg-muted)] dark:bg-[var(--st-text)] rounded-lg" />
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
