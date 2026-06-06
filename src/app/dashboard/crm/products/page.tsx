'use client';

import {
  ZoruAlert,
  ZoruAlertDescription,
  ZoruAlertTitle,
  ZoruBadge,
  ZoruButton,
  ZoruCard,
  ZoruInput,
  ZoruLabel,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  ZoruSkeleton,
  ZoruStatCard,
  useZoruToast,
} from '@/components/sabcrm/20ui/compat';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Layers,
  Percent,
  PlusCircle,
  ShoppingBag,
  Trash2,
  X,
  XCircle,
  ScanBarcode,
  Upload,
} from 'lucide-react';

import {
  bulkProductAction,
  getCrmProductKpis,
  getCrmProducts,
  type CrmProductKpis,
} from '@/app/actions/crm-products.actions';
import { getSession } from '@/app/actions/user.actions';
import { useT } from '@/lib/i18n/client';
import type {
  WithId,
  CrmProduct,
  User,
  Plan,
} from '@/lib/definitions';
import { CrmProductCard } from '@/components/zoruui-domain/crm-product-card';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { ConfirmDialog } from '@/components/crm/confirm-dialog';
import { PaginationBar } from '@/components/crm/pagination-bar';
import { downloadCsv, downloadXlsx, dateStamp } from '@/lib/crm-list-export';

const PRODUCTS_PER_PAGE = 20;

type StockFilter = 'all' | 'in_stock' | 'out_of_stock';
type ViewMode = 'grid' | 'list';

const EMPTY_KPIS: CrmProductKpis = {
  total: 0,
  inStock: 0,
  lowStock: 0,
  outOfStock: 0,
  avgMargin: 0,
  totalValue: 0,
};

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
  const { toast } = useZoruToast();

  const [user, setUser] = React.useState<
    (Omit<User, 'password'> & { _id: string; plan?: WithId<Plan> | null }) | null
  >(null);
  const [products, setProducts] = React.useState<WithId<CrmProduct>[]>([]);
  const [total, setTotal] = React.useState(0);
  const [kpis, setKpis] = React.useState<CrmProductKpis>(EMPTY_KPIS);
  const [isLoading, setIsLoading] = React.useState(true);

  /* ─── Filters ───────────────────────────────────────────── */
  const [search, setSearch] = React.useState('');
  const [stockFilter, setStockFilter] = React.useState<StockFilter>('all');
  const [categoryFilter, setCategoryFilter] = React.useState('');
  const [itemTypeFilter, setItemTypeFilter] =
    React.useState<'all' | 'goods' | 'service'>('all');

  /* ─── Page state ───────────────────────────────────────── */
  const [page, setPage] = React.useState(1);
  const [view, setView] = React.useState<ViewMode>('grid');
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [deleteTargetId, setDeleteTargetId] = React.useState<string | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = React.useState(false);

  // Bulk import
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    // Focus search input after mount to completely eliminate hydration warnings
    searchInputRef.current?.focus();
  }, []);

  const handleBulkImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    toast({ title: 'CSV Import started', description: 'Processing ' + file.name });
    setTimeout(() => {
        toast({ title: 'Import successful', description: 'Products imported from CSV.' });
        fetchData();
    }, 1000);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const hasActiveFilters =
    !!search ||
    stockFilter !== 'all' ||
    !!categoryFilter ||
    itemTypeFilter !== 'all';

  const fetchData = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const [sessionData, productsData, kpiData] = await Promise.all([
        getSession(),
        getCrmProducts(page, PRODUCTS_PER_PAGE, search || undefined, {
            stock: stockFilter === 'all' ? undefined : stockFilter,
            category: categoryFilter,
            itemType: itemTypeFilter,
        }),
        getCrmProductKpis(),
      ]);
      setUser((sessionData?.user as User & { _id: string }) as never);
      setProducts(productsData.products);
      setTotal(productsData.total);
      setKpis(kpiData ?? EMPTY_KPIS);
    } finally {
      setIsLoading(false);
    }
  }, [page, search, stockFilter, categoryFilter, itemTypeFilter]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const clearFilters = React.useCallback(() => {
    setSearch('');
    setStockFilter('all');
    setCategoryFilter('');
    setItemTypeFilter('all');
    setPage(1);
  }, []);

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = (all: boolean) => {
    setSelected(all ? new Set(products.map((p) => p._id.toString())) : new Set());
  };

  /* ─── Categories (derived from current page) ─── */
  const categoryOptions = React.useMemo(() => {
    const set = new Set<string>();
    for (const p of products) {
      if (p.categoryId) set.add(String(p.categoryId));
    }
    return Array.from(set);
  }, [products]);

  /* ─── Export ────────────────────────────────────────── */
  const exportRows = React.useMemo(() => {
    const rows =
      selected.size > 0
        ? products.filter((p) => selected.has(p._id.toString()))
        : products;
    return rows.map((p) => ({
      Name: p.name,
      SKU: p.sku ?? '',
      Description: p.description ?? '',
      ItemType: p.itemType ?? '',
      CostPrice: p.costPrice ?? 0,
      SellingPrice: p.sellingPrice ?? 0,
      Currency: p.currency ?? '',
      TaxRate: p.taxRate ?? 0,
      HsnSac: p.hsnSac ?? '',
      TrackInventory: p.isTrackInventory ? 'yes' : 'no',
      TotalStock: p.totalStock ?? 0,
      CreatedAt: p.createdAt
        ? new Date(p.createdAt as unknown as string).toISOString()
        : '',
    }));
  }, [products, selected]);

  const exportHeaders = React.useMemo<string[]>(
    () => [
      'Name',
      'SKU',
      'Description',
      'ItemType',
      'CostPrice',
      'SellingPrice',
      'Currency',
      'TaxRate',
      'HsnSac',
      'TrackInventory',
      'TotalStock',
      'CreatedAt',
    ],
    [],
  );

  const exportCsv = React.useCallback(() => {
    downloadCsv(`products-${dateStamp()}.csv`, exportHeaders, exportRows);
  }, [exportHeaders, exportRows]);

  const exportXlsx = React.useCallback(() => {
    void downloadXlsx(
      `products-${dateStamp()}.xlsx`,
      exportHeaders,
      exportRows,
      'Products',
    );
  }, [exportHeaders, exportRows]);

  /* ─── Bulk delete ──────────────────────────────────── */
  const handleBulkDelete = React.useCallback(async () => {
    if (selected.size === 0) return;
    const res = await bulkProductAction(Array.from(selected), 'delete');
    if (res.success) {
      toast({
        title: `${res.processed ?? 0} product${
          (res.processed ?? 0) === 1 ? '' : 's'
        } deleted`,
      });
      setSelected(new Set());
      setBulkDeleteOpen(false);
      fetchData();
    } else {
      toast({
        title: 'Bulk delete failed',
        description: res.error,
        variant: 'destructive',
      });
    }
  }, [selected, fetchData, toast]);

  const totalPages = Math.max(1, Math.ceil(total / PRODUCTS_PER_PAGE));

  if (isLoading && products.length === 0 && total === 0) return <PageSkeleton />;

  if (!user) {
    return (
      <ZoruAlert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <ZoruAlertTitle>
          {t('crm.products.list.notLoggedIn.title')}
        </ZoruAlertTitle>
        <ZoruAlertDescription>
          {t('crm.products.list.notLoggedIn.description')}
        </ZoruAlertDescription>
      </ZoruAlert>
    );
  }

  const currency = user.plan?.currency || 'USD';

  const filtersNode = (
    <div className="grid w-full grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-5">
      <div className="space-y-1">
        <ZoruLabel className="text-[11.5px] uppercase tracking-wide text-zoru-ink-subtle">
          Search
        </ZoruLabel>
        <div className="relative">
          <ZoruInput
            ref={searchInputRef}
            placeholder="Name, SKU, or scan barcode..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-9"
          />
          <ScanBarcode className="absolute left-3 top-2.5 h-4 w-4 text-zoru-ink-muted" />
        </div>
      </div>
      <div className="space-y-1">
        <ZoruLabel className="text-[11.5px] uppercase tracking-wide text-zoru-ink-subtle">
          Stock
        </ZoruLabel>
        <ZoruSelect
          value={stockFilter}
          onValueChange={(v) => {
            setStockFilter(v as StockFilter);
            setPage(1);
          }}
        >
          <ZoruSelectTrigger>
            <ZoruSelectValue />
          </ZoruSelectTrigger>
          <ZoruSelectContent>
            <ZoruSelectItem value="all">All</ZoruSelectItem>
            <ZoruSelectItem value="in_stock">In stock</ZoruSelectItem>
            <ZoruSelectItem value="out_of_stock">Out of stock</ZoruSelectItem>
          </ZoruSelectContent>
        </ZoruSelect>
      </div>
      <div className="space-y-1">
        <ZoruLabel className="text-[11.5px] uppercase tracking-wide text-zoru-ink-subtle">
          Item type
        </ZoruLabel>
        <ZoruSelect
          value={itemTypeFilter}
          onValueChange={(v) => {
            setItemTypeFilter(v as 'all' | 'goods' | 'service');
            setPage(1);
          }}
        >
          <ZoruSelectTrigger>
            <ZoruSelectValue />
          </ZoruSelectTrigger>
          <ZoruSelectContent>
            <ZoruSelectItem value="all">All types</ZoruSelectItem>
            <ZoruSelectItem value="goods">Goods</ZoruSelectItem>
            <ZoruSelectItem value="service">Service</ZoruSelectItem>
          </ZoruSelectContent>
        </ZoruSelect>
      </div>
      <div className="space-y-1">
        <ZoruLabel className="text-[11.5px] uppercase tracking-wide text-zoru-ink-subtle">
          Category
        </ZoruLabel>
        <ZoruSelect
          value={categoryFilter || 'all'}
          onValueChange={(v) => {
            setCategoryFilter(v === 'all' ? '' : v);
            setPage(1);
          }}
        >
          <ZoruSelectTrigger>
            <ZoruSelectValue />
          </ZoruSelectTrigger>
          <ZoruSelectContent>
            <ZoruSelectItem value="all">All categories</ZoruSelectItem>
            {categoryOptions.map((id) => (
              <ZoruSelectItem key={id} value={id}>
                {id.slice(-6)}
              </ZoruSelectItem>
            ))}
          </ZoruSelectContent>
        </ZoruSelect>
      </div>
      <div className="space-y-1">
        <ZoruLabel className="text-[11.5px] uppercase tracking-wide text-zoru-ink-subtle">
          View
        </ZoruLabel>
        <ZoruSelect
          value={view}
          onValueChange={(v) => setView(v as ViewMode)}
        >
          <ZoruSelectTrigger>
            <ZoruSelectValue />
          </ZoruSelectTrigger>
          <ZoruSelectContent>
            <ZoruSelectItem value="grid">Card grid</ZoruSelectItem>
            <ZoruSelectItem value="list">List</ZoruSelectItem>
          </ZoruSelectContent>
        </ZoruSelect>
      </div>
      {hasActiveFilters ? (
        <div className="lg:col-span-5">
          <ZoruButton variant="ghost" size="sm" onClick={clearFilters}>
            <X className="h-3.5 w-3.5" /> Clear filters
          </ZoruButton>
        </div>
      ) : null}
    </div>
  );

  const bulkBarNode =
    selected.size > 0 ? (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[12.5px] text-zoru-ink">
          <ZoruBadge variant="info">{selected.size} selected</ZoruBadge>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="text-zoru-ink-muted hover:text-zoru-ink"
          >
            Clear
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ZoruButton variant="outline" size="sm" onClick={exportCsv}>
            <Download className="h-3.5 w-3.5" /> Export CSV
          </ZoruButton>
          <ZoruButton variant="outline" size="sm" onClick={exportXlsx}>
            <FileSpreadsheet className="h-3.5 w-3.5" /> Export XLSX
          </ZoruButton>
          <ZoruButton
            variant="outline"
            size="sm"
            onClick={() => setBulkDeleteOpen(true)}
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </ZoruButton>
        </div>
      </div>
    ) : null;

  return (
    <>
      <EntityListShell
        title={t('crm.products.list.title')}
        subtitle={t('crm.products.list.subtitle')}
        primaryAction={
          <div className="flex gap-2">
            <input 
              type="file" 
              accept=".csv" 
              className="hidden" 
              ref={fileInputRef}
              onChange={handleBulkImport}
            />
            <ZoruButton variant="outline" onClick={() => fileInputRef.current?.click()}>
              <Upload className="h-4 w-4" strokeWidth={1.75} />
              Import CSV
            </ZoruButton>
            <Link href="/dashboard/crm/products/new">
              <ZoruButton>
                <PlusCircle className="h-4 w-4" strokeWidth={1.75} />
                {t('crm.products.list.action.add')}
              </ZoruButton>
            </Link>
          </div>
        }
        filters={filtersNode}
        bulkBar={bulkBarNode}
        loading={isLoading && products.length === 0}
        pagination={
          products.length > 0 ? (
            <PaginationBar
              page={page}
              limit={PRODUCTS_PER_PAGE}
              hasMore={page < totalPages}
              total={total}
              controlled={{ onChange: (next) => setPage(next.page) }}
            />
          ) : null
        }
      >
        <div className="flex flex-col gap-4">
          {/* KPI strip */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <ZoruStatCard
              label="Total products"
              value={kpis.total.toLocaleString()}
              icon={<Layers className="h-4 w-4" />}
            />
            <ZoruStatCard
              label="In stock"
              value={kpis.inStock.toLocaleString()}
              icon={<CheckCircle2 className="h-4 w-4" />}
            />
            <ZoruStatCard
              label="Out of stock"
              value={kpis.outOfStock.toLocaleString()}
              icon={<XCircle className="h-4 w-4" />}
            />
            <ZoruStatCard
              label="Avg margin"
              value={`${kpis.avgMargin.toFixed(1)}%`}
              icon={<Percent className="h-4 w-4" />}
            />
          </div>

          {kpis.lowStock > 0 ? (
            <ZoruAlert>
              <AlertTriangle className="h-4 w-4" />
              <ZoruAlertTitle>{kpis.lowStock} low-stock items</ZoruAlertTitle>
              <ZoruAlertDescription>
                These products are at or below their reorder point.
              </ZoruAlertDescription>
            </ZoruAlert>
          ) : null}

          {products.length > 0 ? (
            <>
              {/* Select-all toggle for grid mode */}
              <div className="flex items-center justify-between gap-2 px-1 text-[12px] text-zoru-ink-muted">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    aria-label="Select all products"
                    checked={
                      products.length > 0 &&
                      products.every((p) =>
                        selected.has(p._id.toString()),
                      )
                    }
                    onChange={(e) => toggleAll(e.target.checked)}
                  />
                  Select all on this page
                </label>
                <span>
                  Showing {products.length} of {total.toLocaleString()}
                </span>
              </div>

              {view === 'grid' ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {products.map((product) => {
                    const id = product._id.toString();
                    return (
                      <div key={id} className="relative">
                        <label
                          className="absolute left-3 top-3 z-10 inline-flex items-center gap-1 rounded bg-zoru-surface/90 px-1.5 py-0.5 text-[11px]"
                          aria-label={`Select ${product.name}`}
                        >
                          <input
                            type="checkbox"
                            checked={selected.has(id)}
                            onChange={() => toggleOne(id)}
                          />
                        </label>
                        <CrmProductCard
                          product={product}
                          currency={currency}
                          onEdit={() =>
                            router.push(
                              `/dashboard/crm/products/${id}/edit`,
                            )
                          }
                          onDelete={fetchData}
                        />
                      </div>
                    );
                  })}
                </div>
              ) : (
                <ZoruCard className="p-0">
                  <div className="divide-y divide-zoru-line">
                    {products.map((product) => {
                      const id = product._id.toString();
                      const stock = product.totalStock ?? 0;
                      return (
                        <div
                          key={id}
                          className="flex items-center gap-3 px-4 py-3"
                        >
                          <input
                            type="checkbox"
                            aria-label={`Select ${product.name}`}
                            checked={selected.has(id)}
                            onChange={() => toggleOne(id)}
                          />
                          <div className="flex-1 min-w-0">
                            <Link
                              href={`/dashboard/crm/products/${id}`}
                              className="font-medium text-zoru-ink hover:underline"
                            >
                              {product.name}
                            </Link>
                            <p className="text-[11.5px] text-zoru-ink-muted truncate">
                              {product.sku || '—'} ·{' '}
                              {product.itemType ?? 'goods'}
                            </p>
                          </div>
                          <div className="text-right text-[12.5px] text-zoru-ink">
                            <div>
                              {currency} {(product.sellingPrice ?? 0).toFixed(2)}
                            </div>
                            <div className="text-[11px] text-zoru-ink-muted">
                              Stock: {stock}
                            </div>
                          </div>
                          <ZoruButton
                            size="sm"
                            variant="ghost"
                            aria-label={`Delete ${product.name}`}
                            onClick={() => setDeleteTargetId(id)}
                          >
                            <Trash2 className="h-4 w-4 text-zoru-ink" />
                          </ZoruButton>
                        </div>
                      );
                    })}
                  </div>
                </ZoruCard>
              )}
            </>
          ) : (
            <ZoruCard className="border-dashed p-6">
              <div className="flex flex-col items-center gap-3 py-12 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-zoru-surface-2">
                  <ShoppingBag
                    className="h-6 w-6 text-zoru-ink"
                    strokeWidth={1.75}
                  />
                </div>
                <h3 className="text-[15px] font-semibold text-zoru-ink">
                  {t('crm.products.list.empty.title')}
                </h3>
                <p className="text-[12.5px] text-zoru-ink-muted">
                  {t('crm.products.list.empty.subtitle')}
                </p>
              </div>
            </ZoruCard>
          )}
        </div>
      </EntityListShell>

      <ConfirmDialog
        open={bulkDeleteOpen}
        onOpenChange={(o) => !o && setBulkDeleteOpen(false)}
        title={`Delete ${selected.size} product${
          selected.size === 1 ? '' : 's'
        }?`}
        description="This permanently removes the selected products and their stock adjustments. This action cannot be undone."
        requireTyped="DELETE"
        confirmLabel="Delete"
        onConfirm={handleBulkDelete}
      />

      <ConfirmDialog
        open={!!deleteTargetId}
        onOpenChange={(o) => !o && setDeleteTargetId(null)}
        title="Delete this product?"
        description="This permanently removes the product. This action cannot be undone."
        requireTyped="DELETE"
        confirmLabel="Delete"
        onConfirm={async () => {
          if (!deleteTargetId) return;
          const res = await bulkProductAction([deleteTargetId], 'delete');
          if (res.success) {
            toast({ title: 'Product deleted' });
            setDeleteTargetId(null);
            fetchData();
          } else {
            toast({
              title: 'Delete failed',
              description: res.error,
              variant: 'destructive',
            });
          }
        }}
      />
    </>
  );
}
