/**
 * Edit product — `/dashboard/crm/store/products/[id]/edit`.
 */

import { notFound } from 'next/navigation';
import { Package } from 'lucide-react';

import { CrmPageHeader } from '../../../../_components/crm-page-header';
import { ProductForm } from '../../_components/product-form';
import { getProductById } from '@/app/actions/crm-store.actions';

export const dynamic = 'force-dynamic';

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
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                title={`Edit · ${title}`}
                subtitle="Update product details, pricing and inventory."
                icon={Package}
                breadcrumbs={[
                    { label: 'CRM', href: '/dashboard/crm' },
                    { label: 'Store', href: '/dashboard/crm/store' },
                    {
                        label: 'Products',
                        href: '/dashboard/crm/store/products',
                    },
                    {
                        label: title,
                        href: `/dashboard/crm/store/products/${id}`,
                    },
                    { label: 'Edit' },
                ]}
            />
            <ProductForm initial={product} productId={id} />
        </div>
    );
}
