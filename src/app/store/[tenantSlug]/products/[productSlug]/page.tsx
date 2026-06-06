import * as React from 'react';
import { notFound } from 'next/navigation';

import { getStorefrontProduct } from '@/app/actions/storefront.actions';
import { AddToCartButton } from '../../_components/add-to-cart-button';

export const dynamic = 'force-dynamic';

interface ProductDoc {
    _id: string;
    name?: string;
    slug?: string;
    sku?: string;
    description?: string;
    price?: number;
    salePrice?: number;
    imageUrls?: string[];
    images?: string[];
    variants?: Array<{ id: string; name: string; priceDelta?: number }>;
}

interface StorefrontDoc {
    _id: string;
    slug: string;
    currency?: string;
}

export default async function ProductDetailPage({
    params,
}: {
    params: Promise<{ tenantSlug: string; productSlug: string }>;
}) {
    const { tenantSlug, productSlug } = await params;
    const res = await getStorefrontProduct(tenantSlug, productSlug);
    if (!res.ok) notFound();
    const p = res.product as ProductDoc;
    const sf = res.storefront as StorefrontDoc;
    const images = (p.imageUrls ?? p.images ?? []);

    return (
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
            <div className="flex flex-col gap-3">
                {images.length > 0 ? (
                    <>
                        <img src={images[0]} alt={p.name ?? ''} className="w-full rounded-xl" />
                        {images.length > 1 && (
                            <div className="grid grid-cols-4 gap-2">
                                {images.slice(1).map((src, i) => (
                                    <img key={i} src={src} alt="" className="rounded-md" />
                                ))}
                            </div>
                        )}
                    </>
                ) : (
                    <div className="aspect-square w-full rounded-xl bg-[var(--st-bg-muted)]" />
                )}
            </div>
            <div>
                <h1 className="text-3xl font-semibold">{p.name ?? 'Product'}</h1>
                {p.sku && <p className="mt-1 text-sm opacity-70">SKU: {p.sku}</p>}
                <div className="mt-4 text-2xl font-semibold">
                    {sf.currency ?? '₹'} {p.salePrice ?? p.price ?? 0}
                </div>
                {p.description && <p className="mt-4 leading-relaxed opacity-80">{p.description}</p>}

                <div className="mt-6">
                    <AddToCartButton
                        tenantSlug={tenantSlug}
                        productId={p._id}
                        name={p.name ?? 'Product'}
                        unitPrice={p.salePrice ?? p.price ?? 0}
                        imageUrl={images[0]}
                    />
                </div>
            </div>
        </div>
    );
}
