'use client';

import * as React from 'react';
import { useCallback, useEffect, useState, useTransition } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { m, useReducedMotion } from 'motion/react';
import {
  Edit,
  Package,
  PlusCircle,
  ShoppingBag,
  Trash2,
} from 'lucide-react';

import {
  getProductsForCatalog,
  deleteProductFromCatalog,
  listProductSets,
} from '@/app/actions/catalog.actions';
import type { ProductSet } from '@/lib/definitions';
import { useProject } from '@/context/project-context';
import { CreateCollectionDialog } from '@/components/zoruui-domain/create-collection-dialog';
import { DeleteCollectionButton } from '@/components/zoruui-domain/delete-collection-button';

import {
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
  ZoruAlertDialogTrigger,
  useZoruToast,
} from '@/components/zoruui';
import {
  WaPage,
  PageHeader,
  WaButton,
  Section,
  EmptyState,
  StatusPill,
  type StatusTone,
} from '@/components/wachat-ui';
import { EASE_OUT } from '@/components/dashboard-ui/module-theme';

type Product = {
  id: string;
  name: string;
  price?: number;
  currency?: string;
  inventory?: number;
  availability?: string;
  retailer_id?: string;
  image_url?: string;
};

const availabilityTone = (a?: string): StatusTone => {
  const s = (a ?? '').toLowerCase();
  if (s === 'in_stock' || s === 'in stock' || s === 'available') return 'live';
  if (s === 'out_of_stock' || s === 'out of stock') return 'failed';
  if (s === 'preorder' || s === 'pre_order') return 'queued';
  return 'draft';
};

function ProductCard({
  product, catalogId, onDelete, delay,
}: {
  product: Product;
  catalogId: string;
  onDelete: (id: string) => void;
  delay: number;
}) {
  const fmtPrice = (p?: number, c?: string) =>
    p && c ? new Intl.NumberFormat('en-US', { style: 'currency', currency: c }).format(p / 100) : '-';

  return (
    <m.li
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: EASE_OUT }}
      className="group overflow-hidden rounded-2xl border border-zinc-200 bg-white transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-[2px]"
      style={{ boxShadow: '0 0 0 1px transparent' }}
      onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 18px 40px -22px var(--mt-accent-glow)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 0 0 1px transparent'; }}
    >
      <div className="relative aspect-square overflow-hidden bg-zinc-50">
        {product.image_url ? (
          <Image
            src={product.image_url}
            alt={product.name}
            fill
            sizes="(min-width: 1024px) 280px, 50vw"
            className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center" style={{ background: 'linear-gradient(135deg, var(--mt-accent-soft), white)' }}>
            <ShoppingBag className="h-10 w-10" strokeWidth={1.5} style={{ color: 'var(--mt-accent)' }} aria-hidden />
          </div>
        )}
        {product.availability && (
          <span className="absolute left-3 top-3">
            <StatusPill tone={availabilityTone(product.availability)}>{product.availability.replace(/_/g, ' ')}</StatusPill>
          </span>
        )}
      </div>
      <div className="p-4">
        <h3 className="truncate text-[14px] font-semibold tracking-tight text-zinc-950" title={product.name}>{product.name}</h3>
        <div className="mt-1 flex items-baseline justify-between gap-3">
          <p className="text-[15px] font-semibold tabular-nums text-zinc-900">{fmtPrice(product.price, product.currency)}</p>
          {product.inventory !== undefined && (
            <p className="text-[11px] text-zinc-500 tabular-nums">{product.inventory.toLocaleString('en-IN')} in stock</p>
          )}
        </div>
        {product.retailer_id && (
          <p className="mt-2 truncate font-mono text-[10.5px] text-zinc-500">SKU {product.retailer_id}</p>
        )}
      </div>
      <div className="flex items-center justify-end gap-0.5 border-t border-zinc-100 px-2 py-1.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
        <Link
          href={`/wachat/catalog/${catalogId}/${product.id}/edit`}
          aria-label="Edit"
          className="grid h-7 w-7 place-items-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 active:scale-[0.94]"
        >
          <Edit className="h-3.5 w-3.5" strokeWidth={2.25} />
        </Link>
        <ZoruAlertDialog>
          <ZoruAlertDialogTrigger asChild>
            <button
              type="button"
              aria-label="Delete"
              className="grid h-7 w-7 place-items-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-rose-600 active:scale-[0.94]"
            >
              <Trash2 className="h-3.5 w-3.5" strokeWidth={2.25} />
            </button>
          </ZoruAlertDialogTrigger>
          <ZoruAlertDialogContent>
            <ZoruAlertDialogHeader>
              <ZoruAlertDialogTitle>Delete this product?</ZoruAlertDialogTitle>
              <ZoruAlertDialogDescription>
                This permanently removes "{product.name}" from your catalog.
              </ZoruAlertDialogDescription>
            </ZoruAlertDialogHeader>
            <ZoruAlertDialogFooter>
              <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
              <ZoruAlertDialogAction destructive onClick={() => onDelete(product.id)}>Delete</ZoruAlertDialogAction>
            </ZoruAlertDialogFooter>
          </ZoruAlertDialogContent>
        </ZoruAlertDialog>
      </div>
    </m.li>
  );
}

export default function CatalogProductsPage() {
  const reduce = useReducedMotion();
  const params = useParams();
  const catalogId = params.catalogId as string;
  const { activeProjectId } = useProject();
  const { toast } = useZoruToast();

  const [tab, setTab] = useState<'products' | 'collections'>('products');
  const [products, setProducts] = useState<Product[]>([]);
  const [collections, setCollections] = useState<ProductSet[]>([]);
  const [isLoading, startLoading] = useTransition();

  const fetchData = useCallback(() => {
    if (activeProjectId && catalogId) {
      startLoading(async () => {
        const [productsData, collectionsData] = await Promise.all([
          getProductsForCatalog(catalogId, activeProjectId),
          listProductSets(catalogId, activeProjectId),
        ]);
        setProducts(productsData as unknown as Product[]);
        setCollections(collectionsData as unknown as ProductSet[]);
      });
    }
  }, [activeProjectId, catalogId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDeleteProduct = async (productId: string) => {
    if (!activeProjectId) return;
    const result = await deleteProductFromCatalog(productId, activeProjectId);
    if (result.success) {
      toast({ title: 'Product deleted' });
      fetchData();
    } else {
      toast({ title: 'Error', description: result.error, variant: 'destructive' });
    }
  };

  return (
    <WaPage>
      <PageHeader
        title="Catalog management"
        description="Manage products and collections inside this catalog."
        kicker="Wachat · catalog"
        eyebrowIcon={ShoppingBag}
        backHref="/wachat/catalog"
        actions={
          <WaButton
            href={`/wachat/catalog/new?catalogId=${catalogId}`}
            leftIcon={PlusCircle}
          >
            Add product
          </WaButton>
        }
      />

      {/* tab pills */}
      <div className="mb-6 flex flex-wrap gap-1 rounded-full border border-zinc-200 bg-white p-1">
        {(['products', 'collections'] as const).map((id) => {
          const active = tab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className="relative inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition-colors duration-150 active:scale-[0.97]"
            >
              {active && (
                <m.span
                  layoutId="catalog-tab"
                  className="absolute inset-0 rounded-full"
                  style={{ background: 'var(--mt-accent)' }}
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
              <span className={`relative z-10 inline-flex items-center gap-1.5 ${active ? 'text-white' : 'text-zinc-600'}`}>
                {id === 'products' ? <ShoppingBag className="h-3 w-3" /> : <Package className="h-3 w-3" />}
                {id === 'products' ? 'Products' : 'Collections'}
                <span className={`rounded-full px-1.5 text-[10px] font-bold tabular-nums ${active ? 'bg-white/20' : 'bg-zinc-100 text-zinc-500'}`}>
                  {id === 'products' ? products.length : collections.length}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {isLoading && products.length === 0 && collections.length === 0 ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="animate-pulse overflow-hidden rounded-2xl border border-zinc-200 bg-white">
              <div className="aspect-square bg-zinc-100" />
              <div className="p-4">
                <div className="h-3 w-3/4 rounded-full bg-zinc-100" />
                <div className="mt-2 h-3 w-1/2 rounded-full bg-zinc-100" />
              </div>
            </div>
          ))}
        </div>
      ) : tab === 'products' ? (
        products.length === 0 ? (
          <EmptyState
            icon={ShoppingBag}
            title="No products yet"
            description="Add your first product to start sending catalog messages on WhatsApp."
            action={<WaButton href={`/wachat/catalog/new?catalogId=${catalogId}`} leftIcon={PlusCircle}>Add product</WaButton>}
          />
        ) : (
          <ul className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {products.map((p, i) => (
              <ProductCard key={p.id} product={p} catalogId={catalogId} onDelete={handleDeleteProduct} delay={reduce ? 0 : 0.03 + i * 0.03} />
            ))}
          </ul>
        )
      ) : (
        // Collections
        <Section
          title="Collections"
          description="Group products into sets for ads and promotions."
          action={
            activeProjectId ? (
              <CreateCollectionDialog projectId={activeProjectId} catalogId={catalogId} onCollectionCreated={fetchData} />
            ) : null
          }
          padded={false}
        >
          {collections.length === 0 ? (
            <div className="p-5">
              <EmptyState
                icon={Package}
                title="No collections yet"
                description="Group products into themed sets for catalog ads."
              />
            </div>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {collections.map((set, i) => (
                <m.li
                  key={set.id}
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: reduce ? 0 : 0.3, delay: reduce ? 0 : i * 0.04, ease: EASE_OUT }}
                  className="flex items-center justify-between gap-3 px-5 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-semibold text-zinc-900">{set.name}</p>
                    <p className="mt-0.5 text-[11.5px] text-zinc-500 tabular-nums">{set.product_count.toLocaleString('en-IN')} products</p>
                  </div>
                  {activeProjectId && (
                    <DeleteCollectionButton setId={set.id} setName={set.name} projectId={activeProjectId} onDeleted={fetchData} />
                  )}
                </m.li>
              ))}
            </ul>
          )}
        </Section>
      )}
    </WaPage>
  );
}
