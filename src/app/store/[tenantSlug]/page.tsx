import * as React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { getStorefrontHome, listStorefrontProducts } from '@/app/actions/storefront.actions';

export const dynamic = 'force-dynamic';

interface ProductDoc {
    _id: string;
    name?: string;
    slug?: string;
    price?: number;
    imageUrls?: string[];
    images?: string[];
}

interface CollectionDoc {
    _id: string;
    name: string;
    slug: string;
    imageUrl?: string;
}

interface StorefrontDoc {
    slug: string;
    displayName: string;
    description?: string;
    heroTitle?: string;
    heroSubtitle?: string;
    heroImageUrl?: string;
}

function productImage(p: ProductDoc): string | undefined {
    return p.imageUrls?.[0] ?? p.images?.[0];
}

export default async function StorefrontHomePage({
    params,
}: {
    params: Promise<{ tenantSlug: string }>;
}) {
    const { tenantSlug } = await params;
    const homeRes = await getStorefrontHome(tenantSlug);
    if (!homeRes.ok) notFound();
    const sf = homeRes.storefront as StorefrontDoc;
    const featuredProducts = homeRes.featuredProducts as ProductDoc[];
    const featuredCollections = homeRes.featuredCollections as CollectionDoc[];

    // Fall back to published catalog if no featured products are pinned.
    let products = featuredProducts;
    if (products.length === 0) {
        const listRes = await listStorefrontProducts(tenantSlug);
        if (listRes.ok) products = (listRes.items as ProductDoc[]).slice(0, 8);
    }

    return (
        <div>
            <section className="storefront-hero">
                <h1 className="text-3xl font-semibold">
                    {sf.heroTitle ?? `Welcome to ${sf.displayName}`}
                </h1>
                <p className="mt-2 opacity-90">
                    {sf.heroSubtitle ?? sf.description ?? 'Shop our latest collection.'}
                </p>
            </section>

            {featuredCollections.length > 0 && (
                <section className="mb-8">
                    <h2 className="mb-3 text-xl font-semibold">Collections</h2>
                    <div className="storefront-grid">
                        {featuredCollections.map((c) => (
                            <Link key={c._id} href={`/store/${sf.slug}?collection=${c.slug}`} className="storefront-card">
                                {c.imageUrl ? <img src={c.imageUrl} alt={c.name} /> : <div className="storefront-card-placeholder" />}
                                <div className="body"><h3>{c.name}</h3></div>
                            </Link>
                        ))}
                    </div>
                </section>
            )}

            <section>
                <h2 className="mb-3 text-xl font-semibold">Featured products</h2>
                {products.length === 0 ? (
                    <p className="opacity-70">No products published yet.</p>
                ) : (
                    <div className="storefront-grid">
                        {products.map((p) => (
                            <Link
                                key={p._id}
                                href={`/store/${sf.slug}/products/${p.slug ?? p._id}`}
                                className="storefront-card"
                            >
                                {productImage(p) ? <img src={productImage(p)} alt={p.name ?? ''} /> : <div />}
                                <div className="body">
                                    <h3>{p.name ?? 'Product'}</h3>
                                    {p.price != null && <div className="price">₹{p.price}</div>}
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}
