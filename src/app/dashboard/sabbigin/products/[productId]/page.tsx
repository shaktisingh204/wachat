/**
 * SabBigin product detail — server shell.
 *
 * Loads the product via the existing `getCrmProductById` action, serialises
 * the lean fields, and hands them to the client detail/edit island.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

import {
    PageHeader,
    PageHeaderHeading,
    PageEyebrow,
    PageTitle,
    PageDescription,
    PageActions,
} from '@/components/sabcrm/20ui';
import { getCrmProductById } from '@/app/actions/crm-products.actions';

import { ProductDetailClient, type ProductDetail } from './_components/product-detail-client';

export const dynamic = 'force-dynamic';

const PRODUCTS_HREF = '/dashboard/sabbigin/products';

interface PageProps {
    params: Promise<{ productId: string }>;
}

export default async function SabbiginProductDetailPage({ params }: PageProps) {
    const { productId } = await params;

    const product = await getCrmProductById(productId);
    if (!product) notFound();

    const anyP = product as unknown as {
        price?: number;
        sellingPrice?: number;
        rate?: number;
        sku?: string;
        currency?: string;
        description?: string;
    };
    const price = anyP.price ?? anyP.sellingPrice ?? anyP.rate ?? 0;

    const detail: ProductDetail = {
        _id: String(product._id),
        name: product.name ?? '',
        sku: anyP.sku ?? '',
        price: Number.isFinite(price) ? Number(price) : 0,
        currency: anyP.currency ?? 'INR',
        description: anyP.description ?? '',
    };

    return (
        <div className="20ui flex w-full flex-col gap-5">
            <PageHeader>
                <PageHeaderHeading>
                    <PageEyebrow>SabBigin · Product</PageEyebrow>
                    <PageTitle>{detail.name || 'Product'}</PageTitle>
                    <PageDescription>
                        {detail.sku ? `SKU ${detail.sku}` : 'No SKU set'}
                    </PageDescription>
                </PageHeaderHeading>
                <PageActions>
                    <Link href={PRODUCTS_HREF} className="u-btn u-btn--secondary u-btn--sm">
                        <ArrowLeft size={13} aria-hidden="true" />
                        <span className="u-btn__label">Back to products</span>
                    </Link>
                </PageActions>
            </PageHeader>

            <ProductDetailClient initial={detail} />
        </div>
    );
}
