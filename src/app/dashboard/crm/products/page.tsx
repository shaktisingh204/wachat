'use client';

import { ZoruAlert, ZoruAlertDescription, ZoruAlertTitle, ZoruButton, ZoruCard, ZoruSkeleton } from '@/components/zoruui';
import {
  useRouter } from 'next/navigation';
import { useEffect,
  useState,
  useTransition } from 'react';
import { AlertCircle,
  PlusCircle,
  ShoppingBag } from 'lucide-react';

import { getCrmProducts } from '@/app/actions/crm-products.actions';
import { getSession } from '@/app/actions/user.actions';
import { useT } from '@/lib/i18n/client';
import type { WithId,
  CrmProduct,
  User,
  Plan } from '@/lib/definitions';
import { CrmProductCard } from '@/components/wabasimplify/crm-product-card';

import Link from 'next/link';

import { CrmPageHeader } from '../_components/crm-page-header';

function PageSkeleton() {
  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex items-center justify-between">
        <ZoruSkeleton className="h-10 w-64" />
        <ZoruSkeleton className="h-10 w-32" />
      </div>
      <ZoruSkeleton className="h-4 w-96" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <ZoruSkeleton key={i} className="h-80 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}

export default function CrmProductsPage() {
  const { t } = useT();
  const router = useRouter();
  const [user, setUser] = useState<
    (Omit<User, 'password'> & { _id: string; plan?: WithId<Plan> | null }) | null
  >(null);
  const [products, setProducts] = useState<WithId<CrmProduct>[]>([]);
  const [isLoading, startLoading] = useTransition();

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

  if (isLoading) return <PageSkeleton />;

  if (!user) {
    return (
      <ZoruAlert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <ZoruAlertTitle>{t('crm.products.list.notLoggedIn.title')}</ZoruAlertTitle>
        <ZoruAlertDescription>{t('crm.products.list.notLoggedIn.description')}</ZoruAlertDescription>
      </ZoruAlert>
    );
  }

  const currency = user.plan?.currency || 'USD';

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title={t('crm.products.list.title')}
        subtitle={t('crm.products.list.subtitle')}
        icon={ShoppingBag}
        actions={
          <Link href="/dashboard/crm/products/new">
            <ZoruButton>
              <PlusCircle className="h-4 w-4" strokeWidth={1.75} />
              {t('crm.products.list.action.add')}
            </ZoruButton>
          </Link>
        }
      />

      {products.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {products.map((product) => (
            <CrmProductCard
              key={product._id.toString()}
              product={product}
              currency={currency}
              onEdit={() =>
                router.push(`/dashboard/crm/products/${product._id.toString()}/edit`)
              }
              onDelete={fetchData}
            />
          ))}
        </div>
      ) : (
        <ZoruCard className="border-dashed p-6">
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-accent">
              <ShoppingBag className="h-6 w-6 text-accent-foreground" strokeWidth={1.75} />
            </div>
            <h3 className="text-[15px] font-semibold text-zoru-ink">{t('crm.products.list.empty.title')}</h3>
            <p className="text-[12.5px] text-zoru-ink-muted">
              {t('crm.products.list.empty.subtitle')}
            </p>
          </div>
        </ZoruCard>
      )}
    </div>
  );
}
