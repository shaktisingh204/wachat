'use client';

import * as React from 'react';
import { useCallback, useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { m, useReducedMotion } from 'motion/react';
import type { WithId } from 'mongodb';
import {
  ArrowRight,
  CircleAlert,
  ExternalLink,
  GitBranch,
  Lock,
  ShoppingBag,
  Package,
  Layers,
  Clock,
  TrendingUp,
  Search,
  XCircle,
  CheckCircle2,
} from 'lucide-react';

import { getCatalogs, getProductsForCatalog } from '@/app/actions/catalog.actions';
import { getProjectById } from '@/app/actions/project.actions';
import type { Catalog } from '@/lib/definitions';
import { SyncCatalogsButton } from '@/components/zoruui-domain/sync-catalogs-button';
import EmbeddedSignup from '@/components/zoruui-domain/embedded-signup';
import { useProject } from '@/context/project-context';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { fmtDate } from '@/lib/utils';

import {
  WaPage,
  PageHeader,
  WaButton,
  Section,
  EmptyState,
  StatusPill,
  MetricTile,
} from '@/components/wachat-ui';
import { EASE_OUT } from '@/components/dashboard-ui/module-theme';

type ProductLite = {
  id: string;
  name: string;
  price?: number;
  currency?: string;
  availability?: string;
  image_url?: string;
};

type CatalogWithStats = WithId<Catalog> & {
  stats?: { products: number; inStock: number; outOfStock: number; thumbs: string[] };
};

const seedHash = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h);
  return Math.abs(h);
};

function CatalogCard({ catalog, delay, stats }: {
  catalog: WithId<Catalog>;
  delay: number;
  stats?: { products: number; inStock: number; outOfStock: number; thumbs: string[] };
}) {
  const productCount = stats?.products ?? 0;
  const inStock = stats?.inStock ?? 0;
  const outOfStock = stats?.outOfStock ?? 0;
  const stockPct = productCount > 0 ? (inStock / productCount) * 100 : 0;
  const thumbs = stats?.thumbs ?? [];

  return (
    <m.li
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay, ease: EASE_OUT }}
      className="group flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white p-3.5 transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-[2px]"
      style={{ boxShadow: '0 0 0 1px transparent' }}
      onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 18px 40px -22px var(--mt-accent-glow)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 0 0 1px transparent'; }}
    >
      {/* Thumbnail mosaic */}
      <div className="grid h-24 grid-cols-4 gap-1 overflow-hidden rounded-lg bg-zinc-50">
        {thumbs.length > 0 ? (
          Array.from({ length: 4 }).map((_, i) => {
            const url = thumbs[i];
            return url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={url} alt="" className="h-full w-full object-cover" />
            ) : (
              <div key={i} className="flex h-full w-full items-center justify-center" style={{ background: 'linear-gradient(135deg, var(--mt-accent-soft), white)' }}>
                <ShoppingBag className="h-3.5 w-3.5" style={{ color: 'var(--mt-accent)' }} strokeWidth={2} />
              </div>
            );
          })
        ) : (
          <div className="col-span-4 flex items-center justify-center" style={{ background: 'linear-gradient(135deg, var(--mt-accent-soft), white)' }}>
            <ShoppingBag className="h-7 w-7" style={{ color: 'var(--mt-accent)' }} strokeWidth={1.5} />
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <h3 className="truncate text-[13.5px] font-semibold tracking-tight text-zinc-950">{catalog.name}</h3>
        <StatusPill tone="live">Synced</StatusPill>
      </div>

      <p className="mt-1.5 truncate font-mono text-[10px] text-zinc-500">{catalog.metaCatalogId}</p>

      <div className="mt-3 grid grid-cols-3 gap-2 border-t border-zinc-100 pt-3">
        <Stat label="Products" value={productCount.toLocaleString('en-IN')} />
        <Stat label="In stock" value={inStock.toLocaleString('en-IN')} accent />
        <Stat label="Out" value={outOfStock.toLocaleString('en-IN')} danger />
      </div>

      {productCount > 0 && (
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-zinc-100">
          <div className="h-full rounded-full" style={{ width: `${stockPct}%`, background: 'var(--mt-accent)' }} />
        </div>
      )}

      <p className="mt-2.5 text-[10.5px] text-zinc-500">
        <Clock className="mr-1 inline h-2.5 w-2.5" strokeWidth={2.25} />
        Synced {fmtDate(catalog.createdAt)}
      </p>

      <div className="mt-auto pt-3">
        <Link
          href={`/wachat/catalog/${catalog.metaCatalogId}`}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-full font-semibold transition-[transform,box-shadow,background-color] duration-150 active:scale-[0.97]"
          style={{
            height: 34, padding: '0 14px', fontSize: 12, color: '#fff',
            backgroundImage: 'linear-gradient(135deg, var(--mt-accent), color-mix(in oklch, var(--mt-accent) 55%, white))',
            boxShadow: '0 10px 24px -12px var(--mt-accent-glow)',
          }}
        >
          View products
          <ArrowRight className="h-3 w-3" strokeWidth={2.5} aria-hidden />
        </Link>
      </div>
    </m.li>
  );
}

function Stat({ label, value, accent, danger }: { label: string; value: string; accent?: boolean; danger?: boolean }) {
  return (
    <div>
      <p className="text-[9px] font-semibold uppercase tracking-wider text-zinc-500">{label}</p>
      <p className={`text-[12px] font-semibold tabular-nums ${accent ? 'text-emerald-700' : danger ? 'text-rose-600' : 'text-zinc-900'}`}>{value}</p>
    </div>
  );
}

export default function CatalogPage() {
  const router = useRouter();
  const [catalogs, setCatalogs] = useState<CatalogWithStats[]>([]);
  const [, startStatTransition] = useTransition();
  const { activeProject, activeProjectId, isLoadingProject } = useProject();
  const [search, setSearch] = useState('');
  const [stockFilter, setStockFilter] = useState<'all' | 'in-stock' | 'out-of-stock'>('all');

  const fetchData = useCallback(() => {
    if (!activeProjectId) return;
    getProjectById(activeProjectId).then(() => {
      getCatalogs(activeProjectId).then(async (raw) => {
        const list = (raw ?? []) as WithId<Catalog>[];
        setCatalogs(list);
        // hydrate stats per-catalog (best-effort, ignore errors)
        startStatTransition(async () => {
          const enriched = await Promise.all(list.map(async (c) => {
            try {
              const prods = (await getProductsForCatalog(c.metaCatalogId, activeProjectId)) as unknown as ProductLite[];
              const items = Array.isArray(prods) ? prods : [];
              const inStock = items.filter((p) => {
                const a = (p.availability ?? '').toLowerCase();
                return a === 'in_stock' || a === 'in stock' || a === 'available' || !a;
              }).length;
              const outOfStock = items.length - inStock;
              const thumbs = items
                .map((p) => p.image_url)
                .filter((u): u is string => Boolean(u))
                .slice(0, 4);
              return { ...c, stats: { products: items.length, inStock, outOfStock, thumbs } } as CatalogWithStats;
            } catch {
              return c as CatalogWithStats;
            }
          }));
          setCatalogs(enriched);
        });
      });
    });
  }, [activeProjectId]);

  useEffect(() => { if (activeProjectId) fetchData(); }, [activeProjectId, fetchData]);

  const hasCatalogAccess = activeProject?.hasCatalogManagement === true;
  const isWhatsAppProject = !!activeProject?.wabaId;

  const step1 = PlaceHolderImages.find((img) => img.id === 'catalog-step-1');
  const step2 = PlaceHolderImages.find((img) => img.id === 'catalog-step-2');
  const step3 = PlaceHolderImages.find((img) => img.id === 'catalog-step-3');
  const step6 = PlaceHolderImages.find((img) => img.id === 'catalog-step-6');

  const appId = process.env.NEXT_PUBLIC_META_ONBOARDING_APP_ID;
  const configId = process.env.NEXT_PUBLIC_META_ONBOARDING_CONFIG_ID;

  const totals = React.useMemo(() => {
    let products = 0, inStock = 0, outOfStock = 0;
    for (const c of catalogs) {
      if (c.stats) { products += c.stats.products; inStock += c.stats.inStock; outOfStock += c.stats.outOfStock; }
    }
    return { products, inStock, outOfStock };
  }, [catalogs]);

  const lastUpdated = catalogs.reduce((latest, c) => {
    const t = c.createdAt ? new Date(c.createdAt).getTime() : 0;
    return t > latest ? t : latest;
  }, 0);

  const filteredCatalogs = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return catalogs
      .filter((c) => q ? c.name.toLowerCase().includes(q) || (c.metaCatalogId || '').includes(q) : true)
      .filter((c) => {
        if (stockFilter === 'all') return true;
        if (!c.stats) return stockFilter === 'in-stock';
        if (stockFilter === 'in-stock') return c.stats.inStock > 0;
        return c.stats.outOfStock > 0;
      });
  }, [catalogs, search, stockFilter]);

  const header = (
    <PageHeader
      title="Catalog and commerce"
      description="Run product catalogs that power WhatsApp interactive messages, single-product and multi-product carousels."
      kicker="Wachat · commerce"
      eyebrowIcon={ShoppingBag}
      actions={hasCatalogAccess && activeProjectId ? <SyncCatalogsButton projectId={activeProjectId} onSyncComplete={fetchData} /> : undefined}
    />
  );

  if (isLoadingProject) {
    return (
      <WaPage>
        {header}
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-[260px] animate-pulse rounded-xl border border-zinc-200 bg-white" />
          ))}
        </div>
      </WaPage>
    );
  }

  if (!activeProjectId) {
    return (
      <WaPage>
        {header}
        <EmptyState
          icon={CircleAlert}
          title="No project selected"
          description="Pick a WhatsApp project from the main dashboard to manage its catalog."
          action={<WaButton onClick={() => router.push('/wachat')}>Choose a project</WaButton>}
        />
      </WaPage>
    );
  }

  if (!isWhatsAppProject) {
    return (
      <WaPage>
        {header}
        <EmptyState
          icon={CircleAlert}
          title="Invalid project type"
          description="This section is for WhatsApp projects. The selected project is not a WhatsApp project."
        />
      </WaPage>
    );
  }

  return (
    <WaPage>
      {header}

      {!hasCatalogAccess ? (
        <Section>
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <span className="grid h-14 w-14 place-items-center rounded-xl bg-rose-50">
              <Lock className="h-6 w-6 text-rose-600" strokeWidth={2} aria-hidden />
            </span>
            <h2 className="text-balance text-xl font-semibold tracking-tight text-zinc-950">Catalog management locked</h2>
            <p className="max-w-md text-[12.5px] leading-relaxed text-zinc-600">
              This project was set up without catalog management permissions. Re-authorize with
              {' '}<Code>catalog_management</Code> and <Code>business_management</Code> scopes to unlock.
            </p>
            <div className="mt-1">
              {appId && configId ? (
                <EmbeddedSignup appId={appId} configId={configId} includeCatalog state="whatsapp" reauthorize />
              ) : (
                <p className="text-[12.5px] text-rose-600">Admin has not configured the Facebook App ID.</p>
              )}
            </div>
          </div>
        </Section>
      ) : catalogs.length > 0 ? (
        <>
          {/* 6-tile KPI strip */}
          <section className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <MetricTile label="Total products" value={totals.products.toLocaleString('en-IN')} icon={Package} delay={0.02} />
            <MetricTile label="In stock" value={totals.inStock.toLocaleString('en-IN')} icon={CheckCircle2} delay={0.04} />
            <MetricTile label="Out of stock" value={totals.outOfStock.toLocaleString('en-IN')} icon={XCircle} delay={0.06} />
            <MetricTile label="Draft" value="0" icon={Layers} delay={0.08} />
            <MetricTile label="Catalogs" value={catalogs.length.toLocaleString('en-IN')} icon={ShoppingBag} delay={0.1} />
            <MetricTile
              label="Last updated"
              value={lastUpdated ? formatRelative(lastUpdated) : '-'}
              icon={TrendingUp}
              delay={0.12}
            />
          </section>

          {/* Filter rail */}
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div className="flex h-8 items-center gap-0.5 rounded-full border border-zinc-200 bg-white px-1">
              {(['all', 'in-stock', 'out-of-stock'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setStockFilter(p)}
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition-colors active:scale-[0.97] ${
                    stockFilter === p ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  {p === 'all' ? 'All stock' : p === 'in-stock' ? 'In stock' : 'Out of stock'}
                </button>
              ))}
            </div>
            <label className="ml-auto flex h-8 flex-1 items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 focus-within:border-zinc-400 sm:max-w-xs">
              <Search className="h-3.5 w-3.5 text-zinc-400" strokeWidth={2} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search catalogs"
                className="w-full bg-transparent text-[12.5px] text-zinc-900 placeholder:text-zinc-400 focus:outline-none"
              />
            </label>
          </div>

          <p className="mb-3 text-[11px] tabular-nums text-zinc-500">
            Showing {filteredCatalogs.length.toLocaleString('en-IN')} of {catalogs.length.toLocaleString('en-IN')} catalogs
          </p>

          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredCatalogs.map((c, i) => (
              <CatalogCard key={c._id.toString()} catalog={c} stats={c.stats} delay={0.02 + i * 0.03} />
            ))}
          </ul>
        </>
      ) : (
        <Section
          title={
            <span className="inline-flex items-center gap-2">
              <GitBranch className="h-4 w-4 text-zinc-500" strokeWidth={2.25} aria-hidden />
              Get started with catalogs
            </span>
          }
          description="Create a catalog in Meta Commerce Manager, then sync it here."
        >
          <div className="mt-2 flex flex-col gap-10">
            <GuideStep step="Step 1" title="Create a catalog" image={step1}>
              <ol className="list-inside list-decimal space-y-2 pl-4 text-[12.5px] text-zinc-600">
                <li>
                  Open the{' '}
                  <a href="https://business.facebook.com/commerce" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-zinc-900 hover:underline">
                    Meta Commerce Manager <ExternalLink className="h-3 w-3" />
                  </a>.
                </li>
                <li>Pick the right Business Manager account.</li>
                <li>Click <strong className="text-zinc-900">Add catalog</strong>, choose <strong className="text-zinc-900">E-commerce</strong>, and follow the prompts.</li>
              </ol>
            </GuideStep>

            <GuideStep step="Step 2" title="Assign partner" image={step2}>
              <ol className="list-inside list-decimal space-y-2 pl-4 text-[12.5px] text-zinc-600">
                <li>In Business Settings, go to <strong className="text-zinc-900">Data Sources, then Catalogs</strong>.</li>
                <li>Select the new catalog.</li>
                <li>Click <strong className="text-zinc-900">Assign partners</strong>.</li>
                <li>Assign your BSP with Full Access permissions.</li>
              </ol>
            </GuideStep>

            <GuideStep step="Step 3" title="Add your first product (mandatory)" image={step2}>
              <ol className="list-inside list-decimal space-y-2 pl-4 text-[12.5px] text-zinc-600">
                <li>In your new catalog, open the <strong className="text-zinc-900">Items</strong> tab and click <strong className="text-zinc-900">Add items</strong>.</li>
                <li>Choose the <strong className="text-zinc-900">Manual</strong> option.</li>
                <li>Fill in image, price, currency, availability, and description for at least one product.</li>
                <li className="text-zinc-900">This step is mandatory to activate the catalog for WhatsApp.</li>
              </ol>
            </GuideStep>

            <GuideStep step="Step 4" title="Assign to WABA" image={step3}>
              <ol className="list-inside list-decimal space-y-2 pl-4 text-[12.5px] text-zinc-600">
                <li>Open <strong className="text-zinc-900">WhatsApp Manager</strong> from Business Suite.</li>
                <li>Go to <strong className="text-zinc-900">Account tools, then Catalog</strong>.</li>
                <li>Click <strong className="text-zinc-900">Choose a catalog</strong>.</li>
                <li>Select the catalog and click <strong className="text-zinc-900">Connect catalog</strong>.</li>
              </ol>
            </GuideStep>

            <div className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-zinc-300 bg-zinc-50 px-6 py-8 text-center">
              <div className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-zinc-500">Step 5</div>
              <h3 className="text-balance text-xl font-semibold tracking-tight text-zinc-950">Sync your catalog</h3>
              <p className="max-w-xl text-[12.5px] text-zinc-600">
                Once the catalog has at least one product and is connected to your WABA, return here and click sync.
              </p>
              <div className="mt-1">
                <SyncCatalogsButton projectId={activeProjectId} onSyncComplete={fetchData} />
              </div>
            </div>

            <GuideStep step="Step 6" title="Send WhatsApp catalog messages" image={step6} imageFirst>
              <p className="text-[12.5px] leading-relaxed text-zinc-600">
                After a successful sync, reference your products inside interactive messages, both multi-product and single-product. Use the
                {' '}<strong className="text-zinc-900">Product catalog</strong> template type to get started.
                {' '}<ArrowRight className="ml-1 inline h-3 w-3" />
              </p>
            </GuideStep>
          </div>
        </Section>
      )}
    </WaPage>
  );
}

function formatRelative(t: number) {
  const ms = Date.now() - t;
  const m = Math.floor(ms / 60_000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="inline-flex items-center rounded-md border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 font-mono text-[11px] text-zinc-900">
      {children}
    </code>
  );
}

function GuideStep({
  step, title, image, imageFirst, children,
}: {
  step: string;
  title: string;
  image?: (typeof PlaceHolderImages)[number];
  imageFirst?: boolean;
  children: React.ReactNode;
}) {
  const reduce = useReducedMotion();
  const imageBlock = image ? (
    <m.div
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-10%' }}
      transition={{ duration: reduce ? 0 : 0.45, ease: EASE_OUT }}
      className="overflow-hidden rounded-xl border border-zinc-200 shadow-[0_18px_40px_-22px_var(--mt-accent-glow)]"
    >
      <Image src={image.imageUrl} alt={image.description} width={600} height={400} className="w-full" />
    </m.div>
  ) : null;

  return (
    <div className="grid items-center gap-5 md:grid-cols-2">
      {imageFirst && imageBlock}
      <m.div
        initial={{ opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-10%' }}
        transition={{ duration: reduce ? 0 : 0.45, delay: reduce ? 0 : 0.05, ease: EASE_OUT }}
      >
        <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: 'var(--mt-accent)' }}>{step}</div>
        <h3 className="mb-2 text-[18px] font-semibold tracking-tight text-zinc-950">{title}</h3>
        {children}
      </m.div>
      {!imageFirst && imageBlock}
    </div>
  );
}
