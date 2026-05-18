/**
 * Edit item — `/dashboard/crm/products/[productId]/edit`.
 *
 * Server component: fetches the item via `getCrmProductById` (dual-impl),
 * then renders the shared `<ItemForm>` pre-loaded with values. Mirrors
 * the new page but in edit mode.
 *
 * Per CRM_REBUILD_PLAN §1D.3.
 */

import { notFound } from 'next/navigation';
import { Package } from 'lucide-react';

import { getCrmProductById } from '@/app/actions/crm-products.actions';

import { CrmPageHeader } from '../../../_components/crm-page-header';
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
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title={`Edit ${product.name}`}
        subtitle="Update item details, pricing and inventory."
        icon={Package}
        breadcrumbs={[
          { label: 'CRM', href: '/dashboard/crm' },
          { label: 'Inventory', href: '/dashboard/crm/inventory' },
          { label: 'Items', href: '/dashboard/crm/products' },
          {
            label: product.name,
            href: `/dashboard/crm/products/${productId}`,
          },
          { label: 'Edit' },
        ]}
      />
      <ItemForm initial={product} />
    </div>
  );
}
