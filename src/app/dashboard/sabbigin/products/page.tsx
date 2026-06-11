/**
 * SabBigin products list — now editable.
 *
 * Reads via the existing `getCrmProducts` server action, serialises each doc
 * into a plain `ProductRow`, and hands the list to the client island, which
 * owns the create/edit Modal (posting through the lean SabBigin product
 * actions). No links into the hidden full-CRM module.
 */

import type { WithId } from 'mongodb';

import {
    PageHeader,
    PageHeaderHeading,
    PageEyebrow,
    PageTitle,
    PageDescription,
} from '@/components/sabcrm/20ui';
import { getCrmProducts } from '@/app/actions/crm-products.actions';
import type { CrmProduct } from '@/lib/definitions';

import { ProductsClient, type ProductRow } from './_components/products-client';

export const dynamic = 'force-dynamic';

interface SearchParams {
    page?: string;
    q?: string;
}

interface PageProps {
    searchParams: Promise<SearchParams>;
}

/** Coerce a heterogeneous CRM product doc into the lean SabBigin row. */
function toRow(p: WithId<CrmProduct>): ProductRow {
    const anyP = p as unknown as {
        price?: number;
        sellingPrice?: number;
        rate?: number;
        sku?: string;
        currency?: string;
        description?: string;
    };
    const price = anyP.price ?? anyP.sellingPrice ?? anyP.rate ?? 0;
    return {
        _id: String(p._id),
        name: p.name ?? 'Product',
        sku: anyP.sku ?? '',
        price: Number.isFinite(price) ? Number(price) : 0,
        currency: anyP.currency ?? 'INR',
        description: anyP.description ?? '',
    };
}

export default async function SabbiginProductsPage({ searchParams }: PageProps) {
    const sp = await searchParams;
    const page = Math.max(1, Number(sp.page) || 1);
    const q = (sp.q ?? '').trim();

    const { products, total } = await getCrmProducts(page, 100, q || undefined);
    const rows = products.map(toRow);

    return (
        <div className="20ui flex w-full flex-col gap-5">
            <PageHeader>
                <PageHeaderHeading>
                    <PageEyebrow>SabBigin</PageEyebrow>
                    <PageTitle>Products</PageTitle>
                    <PageDescription>
                        {total.toLocaleString()} product{total === 1 ? '' : 's'} in your catalogue.
                    </PageDescription>
                </PageHeaderHeading>
            </PageHeader>

            <ProductsClient products={rows} />
        </div>
    );
}
