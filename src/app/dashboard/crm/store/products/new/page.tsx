/**
 * New product — `/dashboard/crm/store/products/new`.
 */

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { ProductForm } from '../_components/product-form';

export const dynamic = 'force-dynamic';

interface PageProps {
    searchParams: Promise<{ storefrontId?: string }>;
}

export default async function NewProductPage({ searchParams }: PageProps) {
    const sp = await searchParams;
    const storefrontId = sp.storefrontId ?? null;

    return (
        <EntityDetailShell
            eyebrow="PRODUCT"
            title="New product"
            back={{ href: '/dashboard/crm/store/products', label: 'Products' }}
        >
            <ProductForm defaultStorefrontId={storefrontId} />
        </EntityDetailShell>
    );
}
