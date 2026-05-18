/**
 * Create item — `/dashboard/crm/products/new`.
 *
 * Server component: handles `?fromKind=product&fromId=` cross-doc
 * pre-fill (fetches the source item) and hands off to the shared
 * `<ItemForm>` (also used by Edit).
 *
 * Per CRM_REBUILD_PLAN §1D.3.
 */

import { Package } from 'lucide-react';

import { getCrmProductById } from '@/app/actions/crm-products.actions';

import { CrmPageHeader } from '../../_components/crm-page-header';
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

export default async function NewItemPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  // ?fromKind=product&fromId=<id> duplicates an existing item.
  let initial = null;
  if (sp.fromKind === 'product' && sp.fromId) {
    const source = await getCrmProductById(sp.fromId);
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
      } as never;
    }
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title={initial ? 'Duplicate item' : 'New item'}
        subtitle="Add a new product, service, or bundle to inventory."
        icon={Package}
        breadcrumbs={[
          { label: 'CRM', href: '/dashboard/crm' },
          { label: 'Inventory', href: '/dashboard/crm/inventory' },
          { label: 'Items', href: '/dashboard/crm/products' },
          { label: initial ? 'Duplicate' : 'New' },
        ]}
      />
      <ItemForm initial={initial} />
    </div>
  );
}
