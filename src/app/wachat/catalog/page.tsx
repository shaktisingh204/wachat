'use client';

import * as React from 'react';
import { useCallback, useEffect, useState } from 'react';
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
} from 'lucide-react';

import { getCatalogs } from '@/app/actions/catalog.actions';
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
} from '@/components/wachat-ui';
import { EASE_OUT } from '@/components/dashboard-ui/module-theme';

/**
 * Catalog list + Meta Commerce Manager setup guide. Reuses
 * existing `getCatalogs` + sync server actions.
 */

function CatalogCard({ catalog, delay }: { catalog: WithId<Catalog>; delay: number }) {
  return (
    <m.li
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: EASE_OUT }}
      className="group flex flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white p-5 transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-[2px]"
      style={{ boxShadow: '0 0 0 1px transparent' }}
      onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 18px 40px -22px var(--mt-accent-glow)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 0 0 1px transparent'; }}
    >
      <div className="flex items-center justify-between gap-3">
        <span
          className="grid h-11 w-11 place-items-center rounded-xl text-white"
          style={{ backgroundImage: 'linear-gradient(135deg, var(--mt-accent), color-mix(in oklch, var(--mt-accent) 55%, white))' }}
        >
          <ShoppingBag className="h-5 w-5" strokeWidth={2} aria-hidden />
        </span>
        <StatusPill tone="live">Synced</StatusPill>
      </div>
      <h3 className="mt-4 truncate text-[15px] font-semibold tracking-tight text-zinc-950">{catalog.name}</h3>
      <p className="mt-3 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-zinc-500">Meta catalog ID</p>
      <p className="mt-0.5 break-all font-mono text-[11.5px] tabular-nums text-zinc-500">{catalog.metaCatalogId}</p>
      <p className="mt-3 text-[11.5px] text-zinc-500">Created {fmtDate(catalog.createdAt)}</p>
      <div className="mt-auto pt-5">
        <Link
          href={`/wachat/catalog/${catalog.metaCatalogId}`}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-full font-semibold transition-[transform,box-shadow,background-color] duration-150 active:scale-[0.97]"
          style={{
            height: 40, padding: '0 16px', fontSize: 13, color: '#fff',
            backgroundImage: 'linear-gradient(135deg, var(--mt-accent), color-mix(in oklch, var(--mt-accent) 55%, white))',
            boxShadow: '0 12px 28px -12px var(--mt-accent-glow)',
          }}
        >
          View products
          <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
        </Link>
      </div>
    </m.li>
  );
}

export default function CatalogPage() {
  const router = useRouter();
  const [catalogs, setCatalogs] = useState<WithId<Catalog>[]>([]);
  const { activeProject, activeProjectId, isLoadingProject } = useProject();

  const fetchData = useCallback(() => {
    if (!activeProjectId) return;
    getProjectById(activeProjectId).then(() => {
      getCatalogs(activeProjectId).then(setCatalogs as any);
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
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-[220px] animate-pulse rounded-2xl border border-zinc-200 bg-white" />
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
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <span className="grid h-16 w-16 place-items-center rounded-2xl bg-rose-50">
              <Lock className="h-7 w-7 text-rose-600" strokeWidth={2} aria-hidden />
            </span>
            <h2 className="text-balance text-2xl font-semibold tracking-tight text-zinc-950">Catalog management locked</h2>
            <p className="max-w-md text-[13.5px] leading-relaxed text-zinc-600">
              This project was set up without catalog management permissions. Re-authorize with
              {' '}<Code>catalog_management</Code> and <Code>business_management</Code> scopes to unlock.
            </p>
            <div className="mt-2">
              {appId && configId ? (
                <EmbeddedSignup appId={appId} configId={configId} includeCatalog state="whatsapp" reauthorize />
              ) : (
                <p className="text-[12.5px] text-rose-600">Admin has not configured the Facebook App ID.</p>
              )}
            </div>
          </div>
        </Section>
      ) : catalogs.length > 0 ? (
        <section>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
              {catalogs.length === 1 ? 'Catalog' : 'Catalogs'}
            </h2>
            <span className="text-[11px] tabular-nums text-zinc-400">{catalogs.length.toLocaleString('en-IN')} total</span>
          </div>
          <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {catalogs.map((c, i) => (
              <CatalogCard key={c._id.toString()} catalog={c} delay={0.03 + i * 0.04} />
            ))}
          </ul>
        </section>
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
          <div className="mt-2 flex flex-col gap-12">
            <GuideStep step="Step 1" title="Create a catalog" image={step1}>
              <ol className="list-inside list-decimal space-y-2 pl-4 text-[13.5px] text-zinc-600">
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
              <ol className="list-inside list-decimal space-y-2 pl-4 text-[13.5px] text-zinc-600">
                <li>In Business Settings, go to <strong className="text-zinc-900">Data Sources, then Catalogs</strong>.</li>
                <li>Select the new catalog.</li>
                <li>Click <strong className="text-zinc-900">Assign partners</strong>.</li>
                <li>Assign your BSP with Full Access permissions.</li>
              </ol>
            </GuideStep>

            <GuideStep step="Step 3" title="Add your first product (mandatory)" image={step2}>
              <ol className="list-inside list-decimal space-y-2 pl-4 text-[13.5px] text-zinc-600">
                <li>In your new catalog, open the <strong className="text-zinc-900">Items</strong> tab and click <strong className="text-zinc-900">Add items</strong>.</li>
                <li>Choose the <strong className="text-zinc-900">Manual</strong> option.</li>
                <li>Fill in image, price, currency, availability, and description for at least one product.</li>
                <li className="text-zinc-900">This step is mandatory to activate the catalog for WhatsApp.</li>
              </ol>
            </GuideStep>

            <GuideStep step="Step 4" title="Assign to WABA" image={step3}>
              <ol className="list-inside list-decimal space-y-2 pl-4 text-[13.5px] text-zinc-600">
                <li>Open <strong className="text-zinc-900">WhatsApp Manager</strong> from Business Suite.</li>
                <li>Go to <strong className="text-zinc-900">Account tools, then Catalog</strong>.</li>
                <li>Click <strong className="text-zinc-900">Choose a catalog</strong>.</li>
                <li>Select the catalog and click <strong className="text-zinc-900">Connect catalog</strong>.</li>
              </ol>
            </GuideStep>

            <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-zinc-300 bg-zinc-50 px-6 py-10 text-center">
              <div className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-zinc-500">Step 5</div>
              <h3 className="text-balance text-2xl font-semibold tracking-tight text-zinc-950">Sync your catalog</h3>
              <p className="max-w-xl text-[13.5px] text-zinc-600">
                Once the catalog has at least one product and is connected to your WABA, return here and click sync.
              </p>
              <div className="mt-2">
                <SyncCatalogsButton projectId={activeProjectId} onSyncComplete={fetchData} />
              </div>
            </div>

            <GuideStep step="Step 6" title="Send WhatsApp catalog messages" image={step6} imageFirst>
              <p className="text-[13.5px] leading-relaxed text-zinc-600">
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

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="inline-flex items-center rounded-md border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 font-mono text-[11.5px] text-zinc-900">
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
      className="overflow-hidden rounded-2xl border border-zinc-200 shadow-[0_18px_40px_-22px_var(--mt-accent-glow)]"
    >
      <Image src={image.imageUrl} alt={image.description} width={600} height={400} className="w-full" />
    </m.div>
  ) : null;

  return (
    <div className="grid items-center gap-6 md:grid-cols-2">
      {imageFirst && imageBlock}
      <m.div
        initial={{ opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-10%' }}
        transition={{ duration: reduce ? 0 : 0.45, delay: reduce ? 0 : 0.05, ease: EASE_OUT }}
      >
        <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.12em]" style={{ color: 'var(--mt-accent)' }}>{step}</div>
        <h3 className="mb-3 text-[20px] font-semibold tracking-tight text-zinc-950">{title}</h3>
        {children}
      </m.div>
      {!imageFirst && imageBlock}
    </div>
  );
}
