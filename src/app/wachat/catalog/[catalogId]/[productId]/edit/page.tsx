'use client';

import { Skeleton } from '@/components/sabcrm/20ui';
import {
  useEffect,
  useState,
  useTransition } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import type { WithId } from 'mongodb';

import WachatPage from '@/app/wachat/_components/wachat-page';
import { ProductForm } from '@/components/zoruui-domain/product-form';
import { useProject } from '@/context/project-context';
import { getProductsForCatalog } from '@/app/actions/catalog.actions';
import type { Product } from '@/lib/definitions';

export default function EditProductPage() {
  const params = useParams();
  const { activeProjectId } = useProject();
  const productId = params.productId as string;
  const catalogId = params.catalogId as string;

  const [product, setProduct] = useState<WithId<Product> | null>(null);
  const [isLoading, startLoading] = useTransition();

  useEffect(() => {
    if (productId && activeProjectId) {
      startLoading(async () => {
        const products = await getProductsForCatalog(catalogId, activeProjectId);
        const found = (products as any).products?.find(
          (p: any) => p.id === productId,
        );
        if (found) setProduct(found as any);
      });
    }
  }, [productId, catalogId, activeProjectId]);

  const backHref = `/wachat/catalog/${catalogId}`;

  if (isLoading || !product) {
    return (
      <WachatPage
        breadcrumb={[
          { label: 'SabNode', href: '/dashboard' },
          { label: 'WaChat', href: '/wachat' },
          { label: 'Catalog', href: backHref },
          { label: 'Edit product' },
        ]}
        title="Edit product"
        description="Modify the details for this product."
        width="narrow"
      >
        <Skeleton className="h-96 w-full" />
      </WachatPage>
    );
  }

  return (
    <WachatPage
      breadcrumb={[
        { label: 'SabNode', href: '/dashboard' },
        { label: 'WaChat', href: '/wachat' },
        { label: 'Catalog', href: backHref },
        { label: 'Edit product' },
      ]}
      title={`Edit product: ${product.name}`}
      description="Modify the details for this product."
      width="narrow"
    >
      <Link
        href={backHref}
        className="-ml-1 inline-flex items-center gap-1 text-sm font-medium text-[var(--st-text-secondary)]"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to products
      </Link>

      <ProductForm product={product} />
    </WachatPage>
  );
}
