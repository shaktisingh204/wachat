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
} from '@/components/zoruui';
import {
  ArrowLeft } from 'lucide-react';
import { useSearchParams } from 'next/navigation';

import { ProductForm } from '@/components/wabasimplify/product-form';

import Link from 'next/link';

export default function NewProductPage() {
  const searchParams = useSearchParams();
  const catalogId = searchParams.get('catalogId');
  const backHref = catalogId ? `/wachat/catalog/${catalogId}` : '/wachat/catalog';

  return (
    <div className="space-y-6">
      <ZoruBreadcrumb>
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
            <ZoruBreadcrumbPage>New product</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </ZoruBreadcrumb>

      <ZoruPageHeader>
        <ZoruPageHeading>
          <ZoruPageTitle>Add new product</ZoruPageTitle>
          <ZoruPageDescription>
            Fill in the details to add a new product to your catalog.
          </ZoruPageDescription>
        </ZoruPageHeading>
      </ZoruPageHeader>

      <ZoruButton variant="ghost" size="sm" asChild className="-ml-2">
        <Link href={backHref}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Back to products
        </Link>
      </ZoruButton>

      <ProductForm />
    </div>
  );
}
