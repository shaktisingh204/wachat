/**
 * New product — `/dashboard/crm/store/products/new`.
 */

import { Package } from 'lucide-react';

import { CrmPageHeader } from '../../../_components/crm-page-header';
import { ProductForm } from '../_components/product-form';

export const dynamic = 'force-dynamic';

interface PageProps {
    searchParams: Promise<{ storefrontId?: string }>;
}

export default async function NewProductPage({ searchParams }: PageProps) {
    const sp = await searchParams;
    const storefrontId = sp.storefrontId ?? null;

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                title="New product"
                subtitle="Add a product to a storefront's catalog."
                icon={Package}
                breadcrumbs={[
                    { label: 'CRM', href: '/dashboard/crm' },
                    { label: 'Store', href: '/dashboard/crm/store' },
                    {
                        label: 'Products',
                        href: '/dashboard/crm/store/products',
                    },
                    { label: 'New' },
                ]}
            />
            <ProductForm defaultStorefrontId={storefrontId} />
        </div>
    );
}
