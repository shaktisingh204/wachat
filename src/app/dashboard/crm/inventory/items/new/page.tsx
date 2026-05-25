/**
 * Create item — `/dashboard/crm/inventory/items/new`.
 *
 * Server component: handles `?fromKind=product&fromId=` cross-doc
 * pre-fill (fetches the source item) and hands off to the shared
 * `<ItemForm>` (also used by Edit).
 *
 * Per CRM_REBUILD_PLAN §1D.3.
 */

import { getCrmProductById } from '@/app/actions/crm-products.actions';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { ItemForm } from '../_components/item-form';
import type { CrmProduct } from '@/lib/definitions';
import type { WithId } from 'mongodb';

export const dynamic = 'force-dynamic';

async function fetchWithTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  let timeoutId: NodeJS.Timeout;
  const timeoutPromise = new Promise<T>((resolve) => {
    timeoutId = setTimeout(() => {
      console.warn('MongoDB fetch timeout exceeded');
      resolve(fallback);
    }, ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
}


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
  let initial: WithId<CrmProduct> | null = null;
  if (sp.fromKind === 'product' && sp.fromId) {
    const source = await fetchWithTimeout(getCrmProductById(sp.fromId), 8000, null);
    if (source) {
      const { _id: _omit, sku: sourceSku, ...rest } = source;
      void _omit;
      // Drop the id (so the action creates a new doc) and bump SKU so it
      // doesn't collide with the source.
      initial = {
        ...rest,
        sku: sourceSku ? `${sourceSku}-COPY` : '',
        name: `${source.name ?? 'Item'} (copy)`,
      } as unknown as WithId<CrmProduct>;
    }
  }

  return (
    <EntityDetailShell
      eyebrow="INVENTORY ITEM"
      title={initial ? 'Duplicate item' : 'New item'}
      back={{ href: '/dashboard/crm/inventory/items', label: 'Items' }}
    >
      <ItemForm initial={initial} />
    </EntityDetailShell>
  );
}
