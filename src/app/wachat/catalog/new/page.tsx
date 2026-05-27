'use client';

import { ArrowLeft, ShoppingBag } from 'lucide-react';
import { useSearchParams } from 'next/navigation';

import { ProductForm } from '@/components/zoruui-domain/product-form';
import { WaPage, PageHeader, WaButton } from '@/components/wachat-ui';

export default function NewProductPage() {
  const searchParams = useSearchParams();
  const catalogId = searchParams.get('catalogId');
  const backHref = catalogId ? `/wachat/catalog/${catalogId}` : '/wachat/catalog';

  return (
    <WaPage>
      <PageHeader
        title="Add a product"
        description="Fill in the details to add a new product to your catalog."
        kicker="Wachat · catalog"
        eyebrowIcon={ShoppingBag}
        backHref={backHref}
        actions={
          <WaButton href={backHref} variant="outline" size="sm" leftIcon={ArrowLeft}>
            Back to products
          </WaButton>
        }
      />
      <ProductForm />
    </WaPage>
  );
}
