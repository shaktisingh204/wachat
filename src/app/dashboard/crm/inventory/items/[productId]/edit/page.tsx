/**
 * Edit item — `/dashboard/crm/inventory/items/[productId]/edit`.
 *
 * Server component: fetches the item via `getCrmProductById` (dual-impl),
 * then renders the shared `<ItemForm>` pre-loaded with values. Mirrors
 * the new page but in edit mode.
 *
 * Per CRM_REBUILD_PLAN §1D.3.
 */

import { notFound } from 'next/navigation';

import { getCrmProductById } from '@/app/actions/crm-products.actions';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { ItemForm } from '../../_components/item-form';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ productId: string }>;
}

export default async function EditItemPage({ params }: PageProps) {
  const { productId } = await params;
  const product = await getCrmProductById(productId);
  if (!product) notFound();

  return (
    <EntityDetailShell
      eyebrow="INVENTORY ITEM"
      title={`Edit ${product.name}`}
      back={{ href: `/dashboard/crm/inventory/items/${productId}`, label: 'Back to item' }}
    >
      <ItemForm initial={product} />
    </EntityDetailShell>
  );
}
