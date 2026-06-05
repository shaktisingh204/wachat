'use client';

import { ArrowLeft } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

import { Button } from '@/components/sabcrm/20ui';
import { WachatPage } from '@/app/wachat/_components/wachat-page';
import { ProductForm } from '@/components/zoruui-domain/product-form';

export default function NewProductPage() {
  const searchParams = useSearchParams();
  const catalogId = searchParams.get('catalogId');
  const backHref = catalogId ? `/wachat/catalog/${catalogId}` : '/wachat/catalog';

  return (
    <WachatPage
      breadcrumb={[
        { label: 'SabNode', href: '/dashboard' },
        { label: 'WaChat', href: '/wachat' },
        { label: 'Catalog', href: backHref },
        { label: 'New product' },
      ]}
      title="Add new product"
      description="Fill in the details to add a new product to your catalog."
      width="narrow"
    >
      <div className="space-y-6">
        <Link href={backHref}>
          <Button variant="ghost" size="sm" iconLeft={ArrowLeft} className="-ml-2">
            Back to products
          </Button>
        </Link>

        <ProductForm />
      </div>
    </WachatPage>
  );
}
