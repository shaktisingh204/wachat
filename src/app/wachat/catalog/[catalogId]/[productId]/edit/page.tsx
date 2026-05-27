'use client';

import {
  Breadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  Button,
  ZoruPageDescription,
  PageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  Skeleton,
} from '@/components/zoruui';
import {
  useEffect,
  useState,
  useTransition } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import type { WithId } from 'mongodb';

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

  if (isLoading || !product) {
    return <Skeleton className="h-96 w-full" />;
  }

  const backHref = `/wachat/catalog/${catalogId}`;

  return (
    <div className="space-y-6">
      <Breadcrumb>
        <ZoruBreadcrumbList>
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard">SabNode</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/wachat">WaChat</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href={backHref}>Catalog</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbPage>Edit product</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </Breadcrumb>

      <PageHeader>
        <ZoruPageHeading>
          <ZoruPageTitle>Edit product: {product.name}</ZoruPageTitle>
          <ZoruPageDescription>Modify the details for this product.</ZoruPageDescription>
        </ZoruPageHeading>
      </PageHeader>

      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link href={backHref}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Back to products
        </Link>
      </Button>

      <ProductForm product={product} />
    </div>
  );
}
