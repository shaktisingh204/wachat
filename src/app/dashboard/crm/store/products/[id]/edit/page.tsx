/**
 * Edit product — `/dashboard/crm/store/products/[id]/edit`.
 */

import { notFound } from 'next/navigation';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { ProductForm } from '../../_components/product-form';
import { getProductById } from '@/app/actions/crm-store.actions';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/crm/store/products';

export default async function EditProductPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const product = await getProductById(id);
    if (!product) notFound();
    const title = (product.title as string) || `Product ${id.slice(-6)}`;

    return (
        <EntityDetailShell
            eyebrow="PRODUCT"
            title={`Edit · ${title}`}
            back={{ href: `${BASE}/${id}`, label: 'Back to product' }}
        >
            <ProductForm initial={product} productId={id} />
        </EntityDetailShell>
    );
}
