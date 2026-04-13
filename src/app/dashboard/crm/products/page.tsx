'use client';

import { useEffect, useState, useTransition } from 'react';
import { AlertCircle, PlusCircle, ShoppingBag } from 'lucide-react';

import { getCrmProducts } from '@/app/actions/crm-products.actions';
import { getSession } from '@/app/actions/user.actions';
import type { WithId, CrmProduct, User, Plan } from '@/lib/definitions';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CrmProductDialog } from '@/components/wabasimplify/crm-product-dialog';
import { CrmProductCard } from '@/components/wabasimplify/crm-product-card';

import { ClayButton, ClayCard } from '@/components/clay';
import { CrmPageHeader } from '../_components/crm-page-header';

function PageSkeleton() {
  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-10 w-32" />
      </div>
      <Skeleton className="h-4 w-96" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-80 w-full rounded-clay-lg" />
        ))}
      </div>
    </div>
  );
}

export default function CrmProductsPage() {
  const [user, setUser] = useState<
    (Omit<User, 'password'> & { _id: string; plan?: WithId<Plan> | null }) | null
  >(null);
  const [products, setProducts] = useState<WithId<CrmProduct>[]>([]);
  const [isLoading, startLoading] = useTransition();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<WithId<CrmProduct> | null>(null);

  const fetchData = () => {
    startLoading(async () => {
      const [sessionData, productsData] = await Promise.all([
        getSession(),
        getCrmProducts(),
      ]);
      setUser(sessionData?.user as any);
      setProducts(productsData.products);
    });
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenDialog = (product: WithId<CrmProduct> | null) => {
    setEditingProduct(product);
    setIsDialogOpen(true);
  };

  if (isLoading) return <PageSkeleton />;

  if (!user) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Not Logged In</AlertTitle>
        <AlertDescription>Please log in to manage your CRM products.</AlertDescription>
      </Alert>
    );
  }

  const currency = user.plan?.currency || 'USD';

  return (
    <>
      <CrmProductDialog
        isOpen={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        currency={currency}
        product={editingProduct}
        onSuccess={fetchData}
      />
      <div className="flex w-full flex-col gap-6">
        <CrmPageHeader
          title="Product Catalog"
          subtitle="Manage products for your CRM and sales pipeline."
          icon={ShoppingBag}
          actions={
            <ClayButton
              variant="obsidian"
              leading={<PlusCircle className="h-4 w-4" strokeWidth={1.75} />}
              onClick={() => handleOpenDialog(null)}
            >
              Add Product
            </ClayButton>
          }
        />

        {products.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {products.map((product) => (
              <CrmProductCard
                key={product._id.toString()}
                product={product}
                currency={currency}
                onEdit={() => handleOpenDialog(product)}
                onDelete={fetchData}
              />
            ))}
          </div>
        ) : (
          <ClayCard variant="outline" className="border-dashed">
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-clay-md bg-clay-rose-soft">
                <ShoppingBag className="h-6 w-6 text-clay-rose-ink" strokeWidth={1.75} />
              </div>
              <h3 className="text-[15px] font-semibold text-clay-ink">No Products Yet</h3>
              <p className="text-[12.5px] text-clay-ink-muted">
                Click &ldquo;Add Product&rdquo; to get started.
              </p>
            </div>
          </ClayCard>
        )}
      </div>
    </>
  );
}
