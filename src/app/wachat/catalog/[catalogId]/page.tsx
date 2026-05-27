'use client';

import * as React from 'react';
import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
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
  CheckCircle2,
  XCircle,
  TrendingUp,
  Tag,
  Clock,
  Search,
  Filter,
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
  MetricTile,
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
  category?: string;
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
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay, ease: EASE_OUT }}
      className="group overflow-hidden rounded-xl border border-zinc-200 bg-white transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-[2px] hover:scale-[1.02]"
      style={{ boxShadow: '0 0 0 1px transparent' }}
      onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 14px 32px -18px var(--mt-accent-glow)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 0 0 1px transparent'; }}
    >
      <div className="relative aspect-square overflow-hidden bg-zinc-50">
        {product.image_url ? (
          <Image
            src={product.image_url}
            alt={product.name}
            fill
            sizes="(min-width: 1024px) 240px, 50vw"
            className="object-cover transition-transform duration-300 group-hover:scale-[1.05]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center" style={{ background: 'linear-gradient(135deg, var(--mt-accent-soft), white)' }}>
            <ShoppingBag className="h-9 w-9" strokeWidth={1.5} style={{ color: 'var(--mt-accent)' }} aria-hidden />
          </div>
        )}
        {product.availability && (
          <span className="absolute left-2 top-2">
            <StatusPill tone={availabilityTone(product.availability)}>{product.availability.replace(/_/g, ' ')}</StatusPill>
          </span>
        )}
        {product.category && (
          <span className="absolute right-2 top-2 rounded-full bg-black/70 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">
            {product.category}
          </span>
        )}
      </div>
      <div className="p-2.5">
        <h3 className="truncate text-[12.5px] font-semibold tracking-tight text-zinc-950" title={product.name}>{product.name}</h3>
        <div className="mt-1 flex items-baseline justify-between gap-2">
          <p className="text-[13px] font-semibold tabular-nums text-zinc-900">{fmtPrice(product.price, product.currency)}</p>
          {product.inventory !== undefined && (
            <p className="text-[10px] tabular-nums text-zinc-500">{product.inventory.toLocaleString('en-IN')} in stock</p>
          )}
        </div>
        {product.retailer_id && (
          <p className="mt-1 truncate font-mono text-[10px] text-zinc-500">SKU {product.retailer_id}</p>
        )}
      </div>
      <div className="flex items-center justify-end gap-0.5 border-t border-zinc-100 px-1.5 py-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
        <Link
          href={`/wachat/catalog/${catalogId}/${product.id}/edit`}
          aria-label="Edit"
          className="grid h-6 w-6 place-items-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 active:scale-[0.94]"
        >
          <Edit className="h-3 w-3" strokeWidth={2.25} />
        </Link>
        <ZoruAlertDialog>
          <ZoruAlertDialogTrigger asChild>
            <button
              type="button"
              aria-label="Delete"
              className="grid h-6 w-6 place-items-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-rose-600 active:scale-[0.94]"
            >
              <Trash2 className="h-3 w-3" strokeWidth={2.25} />
            </button>
          </ZoruAlertDialogTrigger>
          <ZoruAlertDialogContent>
            <ZoruAlertDialogHeader>
              <ZoruAlertDialogTitle>Delete this product?</ZoruAlertDialogTitle>
              <ZoruAlertDialogDescription>
                This permanently removes &ldquo;{product.name}&rdquo; from your catalog.
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
  const [search, setSearch] = useState('');
  const [availability, setAvailability] = useState<'all' | 'in_stock' | 'out_of_stock'>('all');
  const [category, setCategory] = useState<string>('all');

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
    if (result.success) { toast({ title: 'Product deleted' }); fetchData(); }
    else { toast({ title: 'Error', description: result.error, variant: 'destructive' }); }
  };

  const stats = useMemo(() => {
    const total = products.length;
    let inStock = 0, outOfStock = 0, priced = 0, priceSum = 0;
    const catMap = new Map<string, number>();
    for (const p of products) {
      const a = (p.availability ?? '').toLowerCase();
      if (a === 'in_stock' || a === 'in stock' || a === 'available' || !a) inStock++;
      else if (a === 'out_of_stock' || a === 'out of stock') outOfStock++;
      if (typeof p.price === 'number') { priced++; priceSum += p.price / 100; }
      if (p.category) catMap.set(p.category, (catMap.get(p.category) || 0) + 1);
    }
    const avgPrice = priced > 0 ? priceSum / priced : 0;
    let topCategory = '-'; let topCount = -1;
    for (const [k, v] of catMap) if (v > topCount) { topCategory = k; topCount = v; }
    return { total, inStock, outOfStock, avgPrice, topCategory };
  }, [products]);

  const categoryOptions = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => { if (p.category) set.add(p.category); });
    return ['all', ...Array.from(set).sort()];
  }, [products]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products
      .filter((p) => q ? p.name.toLowerCase().includes(q) || (p.retailer_id ?? '').toLowerCase().includes(q) : true)
      .filter((p) => {
        if (availability === 'all') return true;
        const a = (p.availability ?? 'in_stock').toLowerCase();
        return availability === 'in_stock'
          ? (a === 'in_stock' || a === 'in stock' || a === 'available' || !a)
          : (a === 'out_of_stock' || a === 'out of stock');
      })
      .filter((p) => category === 'all' ? true : p.category === category);
  }, [products, search, availability, category]);

  const currency = products.find((p) => p.currency)?.currency ?? 'USD';
  const avgPriceLabel = stats.avgPrice
    ? new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(stats.avgPrice)
    : '-';

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

      {/* 6-tile KPI strip */}
      <section className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <MetricTile label="Products" value={stats.total.toLocaleString('en-IN')} icon={Package} delay={0.02} />
        <MetricTile label="In stock" value={stats.inStock.toLocaleString('en-IN')} icon={CheckCircle2} delay={0.04} />
        <MetricTile label="Out of stock" value={stats.outOfStock.toLocaleString('en-IN')} icon={XCircle} delay={0.06} />
        <MetricTile label="Avg price" value={avgPriceLabel} icon={TrendingUp} delay={0.08} />
        <MetricTile label="Top category" value={stats.topCategory} icon={Tag} delay={0.1} />
        <MetricTile label="Collections" value={collections.length.toLocaleString('en-IN')} icon={Package} delay={0.12} />
      </section>

      {/* tab pills */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-0.5 rounded-full border border-zinc-200 bg-white p-0.5">
          {(['products', 'collections'] as const).map((id) => {
            const active = tab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className="relative inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11.5px] font-semibold transition-colors duration-150 active:scale-[0.97]"
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

        {tab === 'products' && (
          <>
            <div className="flex h-8 items-center gap-0.5 rounded-full border border-zinc-200 bg-white px-1">
              {(['all', 'in_stock', 'out_of_stock'] as const).map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setAvailability(a)}
                  className={`rounded-full px-2.5 py-0.5 text-[10.5px] font-semibold transition-colors active:scale-[0.97] ${
                    availability === a ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  {a === 'all' ? 'All' : a === 'in_stock' ? 'In stock' : 'Out'}
                </button>
              ))}
            </div>
            {categoryOptions.length > 1 && (
              <label className="flex h-8 items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-2.5">
                <Filter className="h-3 w-3 text-zinc-400" strokeWidth={2.25} />
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="bg-transparent text-[11px] font-semibold text-zinc-700 focus:outline-none"
                  aria-label="Filter by category"
                >
                  {categoryOptions.map((c) => (
                    <option key={c} value={c}>{c === 'all' ? 'All categories' : c}</option>
                  ))}
                </select>
              </label>
            )}
            <label className="ml-auto flex h-8 flex-1 items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 focus-within:border-zinc-400 sm:max-w-xs">
              <Search className="h-3 w-3 text-zinc-400" strokeWidth={2} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or SKU"
                className="w-full bg-transparent text-[12px] text-zinc-900 placeholder:text-zinc-400 focus:outline-none"
              />
            </label>
          </>
        )}
      </div>

      {isLoading && products.length === 0 && collections.length === 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="animate-pulse overflow-hidden rounded-xl border border-zinc-200 bg-white">
              <div className="aspect-square bg-zinc-100" />
              <div className="p-2.5">
                <div className="h-2.5 w-3/4 rounded-full bg-zinc-100" />
                <div className="mt-1.5 h-2.5 w-1/2 rounded-full bg-zinc-100" />
              </div>
            </div>
          ))}
        </div>
      ) : tab === 'products' ? (
        filtered.length === 0 ? (
          <EmptyState
            icon={ShoppingBag}
            title={products.length === 0 ? 'No products yet' : 'No products match your filter'}
            description={products.length === 0 ? 'Add your first product to start sending catalog messages on WhatsApp.' : 'Try clearing the search or availability filter.'}
            action={products.length === 0 ? <WaButton href={`/wachat/catalog/new?catalogId=${catalogId}`} leftIcon={PlusCircle}>Add product</WaButton> : undefined}
          />
        ) : (
          <>
            <p className="mb-2 text-[11px] tabular-nums text-zinc-500">
              Showing {filtered.length.toLocaleString('en-IN')} of {products.length.toLocaleString('en-IN')} products
            </p>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
              {filtered.map((p, i) => (
                <ProductCard key={p.id} product={p} catalogId={catalogId} onDelete={handleDeleteProduct} delay={reduce ? 0 : Math.min(0.02 + i * 0.02, 0.3)} />
              ))}
            </ul>
          </>
        )
      ) : (
        <Section
          title="Collections"
          description={`${collections.length} collection${collections.length === 1 ? '' : 's'} · group products into sets for ads and promotions.`}
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
                  transition={{ duration: reduce ? 0 : 0.25, delay: reduce ? 0 : i * 0.03, ease: EASE_OUT }}
                  className="flex items-center gap-3 px-4 py-2.5"
                >
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg" style={{ background: 'var(--mt-accent-soft)' }}>
                    <Package className="h-3.5 w-3.5" strokeWidth={2} style={{ color: 'var(--mt-accent)' }} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12.5px] font-semibold text-zinc-900">{set.name}</p>
                    <p className="mt-0.5 inline-flex items-center gap-1.5 text-[11px] text-zinc-500 tabular-nums">
                      <span>{set.product_count.toLocaleString('en-IN')} products</span>
                      <span className="text-zinc-300">·</span>
                      <span className="inline-flex items-center gap-1"><Clock className="h-2.5 w-2.5" strokeWidth={2.25} /> active</span>
                    </p>
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
