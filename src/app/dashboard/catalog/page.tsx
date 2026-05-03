'use client';

/**
 * Wachat Catalog — rebuilt on Clay primitives.
 */

import * as React from 'react';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import type { WithId } from 'mongodb';

import {
  LuCircleAlert,
  LuExternalLink,
  LuGitBranch,
  LuLock,
  LuShoppingBag,
  LuArrowRight,
} from 'react-icons/lu';

import { getCatalogs } from '@/app/actions/catalog.actions';
import { getProjectById } from '@/app/actions/project.actions';
import type { Catalog } from '@/lib/definitions';
import { SyncCatalogsButton } from '@/components/wabasimplify/sync-catalogs-button';
import EmbeddedSignup from '@/components/wabasimplify/embedded-signup';
import { useProject } from '@/context/project-context';
import { PlaceHolderImages } from '@/lib/placeholder-images';

import { cn } from '@/lib/utils';
import { ClayBreadcrumbs, ClayButton, ClayCard } from '@/components/clay';

/* ── Individual catalog card ───────────────────────────────────── */

function WACatalogCard({
  catalog,
  index,
}: {
  catalog: WithId<Catalog>;
  index: number;
}) {
  const tints = [
    'from-[#FDE68A] to-[#B45309]',
    'from-[#C4B5FD] to-[#6D28D9]',
    'from-[#86EFAC] to-[#15803D]',
    'from-[#F9A8D4] to-[#BE185D]',
    'from-[#7DD3FC] to-[#0369A1]',
  ];
  const tint = tints[index % tints.length];

  return (
    <ClayCard padded={false} className="flex flex-col p-5">
      <div className="flex items-center gap-3">
        <span
          className={cn(
            'flex h-10 w-10 items-center justify-center rounded-[10px] bg-gradient-to-br text-white shadow-sm',
            tint,
          )}
        >
          <LuShoppingBag className="h-[18px] w-[18px]" strokeWidth={2.25} />
        </span>
        <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-foreground">
          {catalog.name}
        </span>
      </div>

      <div className="mt-5">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Meta catalog ID
        </div>
        <div className="mt-1 break-all font-mono text-[11.5px] text-muted-foreground tabular-nums">
          {catalog.metaCatalogId}
        </div>
      </div>

      <div className="mt-4 text-[11px] text-muted-foreground">
        Created {new Date(catalog.createdAt).toLocaleDateString()}
      </div>

      <div className="mt-auto pt-5">
        <Link
          href={`/dashboard/catalog/${catalog.metaCatalogId}`}
          className="block"
        >
          <ClayButton
            variant="obsidian"
            size="sm"
            leading={<LuShoppingBag className="h-3.5 w-3.5" strokeWidth={2} />}
            className="w-full justify-center"
          >
            View products
          </ClayButton>
        </Link>
      </div>
    </ClayCard>
  );
}

/* ── page ───────────────────────────────────────────────────────── */

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

  useEffect(() => {
    if (activeProjectId) fetchData();
  }, [activeProjectId, fetchData]);

  const hasCatalogAccess = activeProject?.hasCatalogManagement === true;
  const isWhatsAppProject = !!activeProject?.wabaId;

  const step1 = PlaceHolderImages.find((img) => img.id === 'catalog-step-1');
  const step2 = PlaceHolderImages.find((img) => img.id === 'catalog-step-2');
  const step3 = PlaceHolderImages.find((img) => img.id === 'catalog-step-3');
  const step6 = PlaceHolderImages.find((img) => img.id === 'catalog-step-6');

  const appId = process.env.NEXT_PUBLIC_META_ONBOARDING_APP_ID;
  const configId = process.env.NEXT_PUBLIC_META_ONBOARDING_CONFIG_ID;

  const header = (
    <>
      <ClayBreadcrumbs
        items={[
          { label: 'Wachat', href: '/home' },
          { label: activeProject?.name || 'Project', href: '/dashboard' },
          { label: 'Catalog' },
        ]}
      />
      <div className="flex items-center justify-between gap-6">
        <div className="min-w-0">
          <h1 className="text-[30px] font-semibold tracking-[-0.015em] text-foreground leading-[1.1]">
            Ecomm + Catalog
          </h1>
          <p className="mt-1.5 max-w-[720px] text-[13px] text-muted-foreground">
            Manage product catalogs that power WhatsApp interactive messages —
            single-product and multi-product carousels.
          </p>
        </div>
        {hasCatalogAccess && activeProjectId ? (
          <SyncCatalogsButton
            projectId={activeProjectId}
            onSyncComplete={fetchData}
          />
        ) : null}
      </div>
    </>
  );

  if (isLoadingProject) {
    return (
      <div className="clay-enter flex min-h-full flex-col gap-6">
        {header}
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-[220px] animate-pulse rounded-xl bg-muted"
            />
          ))}
        </div>
      </div>
    );
  }

  if (!activeProjectId) {
    return (
      <div className="clay-enter flex min-h-full flex-col gap-6">
        {header}
        <NoProjectCard onChoose={() => router.push('/dashboard')} />
      </div>
    );
  }

  if (!isWhatsAppProject) {
    return (
      <div className="clay-enter flex min-h-full flex-col gap-6">
        {header}
        <ClayCard padded={false} className="p-10 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
            <LuCircleAlert className="h-5 w-5" strokeWidth={1.5} />
          </div>
          <div className="mt-4 text-[15px] font-semibold text-foreground">
            Invalid project type
          </div>
          <div className="mt-1.5 max-w-[420px] mx-auto text-[12.5px] text-muted-foreground">
            This section is for WhatsApp projects. The selected project is not
            a WhatsApp project.
          </div>
        </ClayCard>
      </div>
    );
  }

  return (
    <div className="clay-enter flex min-h-full flex-col gap-6">
      {header}

      {!hasCatalogAccess ? (
        /* ── Locked: catalog management not authorized ── */
        <ClayCard padded={false} className="p-8">
          <div className="flex flex-col items-center gap-4 py-4 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-[18px] bg-gradient-to-br from-destructive to-[#BE123C] text-white shadow-md">
              <LuLock className="h-7 w-7" strokeWidth={2} />
            </span>
            <h2 className="text-[22px] font-semibold tracking-[-0.01em] text-foreground">
              Catalog management locked
            </h2>
            <p className="max-w-md text-[13px] text-muted-foreground leading-relaxed">
              This project was set up without catalog management permissions.
              Re-authorize the application with{' '}
              <Code>catalog_management</Code> and{' '}
              <Code>business_management</Code> scopes to unlock.
            </p>
            <div className="mt-2">
              {appId && configId ? (
                <EmbeddedSignup
                  appId={appId}
                  configId={configId}
                  includeCatalog={true}
                  state="whatsapp"
                  reauthorize={true}
                />
              ) : (
                <p className="text-[12.5px] text-destructive">
                  Admin has not configured the Facebook App ID.
                </p>
              )}
            </div>
          </div>
        </ClayCard>
      ) : catalogs.length > 0 ? (
        /* ── Catalogs loaded: grid ── */
        <div>
          <div className="mb-4 flex items-center justify-between">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {catalogs.length} {catalogs.length === 1 ? 'catalog' : 'catalogs'}
            </div>
          </div>
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {catalogs.map((c, i) => (
              <WACatalogCard key={c._id.toString()} catalog={c} index={i} />
            ))}
          </div>
        </div>
      ) : (
        /* ── First-run guide ── */
        <ClayCard padded={false} className="p-6">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-accent text-accent-foreground">
              <LuGitBranch className="h-4 w-4" strokeWidth={2} />
            </span>
            <div>
              <div className="text-[15px] font-semibold text-foreground leading-tight">
                Get started with catalogs
              </div>
              <div className="mt-0.5 text-[11.5px] text-muted-foreground">
                Create a catalog in Meta Commerce Manager, then sync it here.
              </div>
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-10">
            <GuideStep step="Step 1" title="Create a catalog" image={step1}>
              <ol className="list-inside list-decimal space-y-2 pl-4 text-[13px] text-muted-foreground">
                <li>
                  Open the{' '}
                  <a
                    href="https://business.facebook.com/commerce"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-medium text-accent-foreground hover:text-primary"
                  >
                    Meta Commerce Manager{' '}
                    <LuExternalLink className="h-3 w-3" />
                  </a>
                  .
                </li>
                <li>
                  Make sure you have the correct Business Manager account
                  selected.
                </li>
                <li>
                  Click <strong className="text-foreground">Add Catalog</strong>,
                  choose <strong className="text-foreground">E-commerce</strong>{' '}
                  as the type, and follow the prompts.
                </li>
              </ol>
            </GuideStep>

            <GuideStep step="Step 2" title="Assign partner" image={step2}>
              <ol className="list-inside list-decimal space-y-2 pl-4 text-[13px] text-muted-foreground">
                <li>
                  In Business Settings, go to{' '}
                  <strong className="text-foreground">
                    Data Sources → Catalogs
                  </strong>
                  .
                </li>
                <li>Select your newly created catalog.</li>
                <li>
                  Click{' '}
                  <strong className="text-foreground">Assign Partners</strong>.
                </li>
                <li>
                  Assign your BSP as a partner with Full Access permissions.
                </li>
              </ol>
            </GuideStep>

            <GuideStep
              step="Step 3"
              title="Add your first product (mandatory)"
              image={step2}
            >
              <ol className="list-inside list-decimal space-y-2 pl-4 text-[13px] text-muted-foreground">
                <li>
                  In your new catalog, go to the{' '}
                  <strong className="text-foreground">Items</strong> tab and
                  click <strong className="text-foreground">Add Items</strong>.
                </li>
                <li>
                  Choose the <strong className="text-foreground">Manual</strong>{' '}
                  option.
                </li>
                <li>
                  Fill in all required details for at least one product
                  (image, price, currency, availability, description).
                </li>
                <li className="font-medium text-foreground">
                  This step is mandatory to activate the catalog for WhatsApp.
                </li>
              </ol>
            </GuideStep>

            <GuideStep step="Step 4" title="Assign to WABA" image={step3}>
              <ol className="list-inside list-decimal space-y-2 pl-4 text-[13px] text-muted-foreground">
                <li>
                  Navigate to{' '}
                  <strong className="text-foreground">WhatsApp Manager</strong>{' '}
                  from your Business Suite.
                </li>
                <li>
                  Go to{' '}
                  <strong className="text-foreground">
                    Account tools → Catalog
                  </strong>
                  .
                </li>
                <li>
                  Click{' '}
                  <strong className="text-foreground">Choose a catalog</strong>.
                </li>
                <li>
                  Select the catalog you just created and click{' '}
                  <strong className="text-foreground">Connect catalog</strong>.
                </li>
              </ol>
            </GuideStep>

            {/* Step 5 — the big rose-tinted sync CTA */}
            <div className="flex flex-col items-center gap-3 rounded-[16px] border-2 border-dashed border-accent bg-accent/50 px-6 py-8 text-center">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-accent-foreground">
                Step 5
              </div>
              <h3 className="text-[22px] font-semibold tracking-[-0.01em] text-foreground">
                Sync your catalog
              </h3>
              <p className="max-w-xl text-[13px] text-muted-foreground">
                Once your catalog is created, has at least one product, and is
                connected to your WABA, return here and click sync.
              </p>
              <div className="mt-2">
                <SyncCatalogsButton
                  projectId={activeProjectId}
                  onSyncComplete={fetchData}
                />
              </div>
            </div>

            <GuideStep
              step="Step 6"
              title="Send WhatsApp catalog messages"
              image={step6}
              imageFirst
            >
              <p className="text-[13px] text-muted-foreground leading-relaxed">
                After a successful sync, reference your products inside
                interactive messages — Multi-Product and Single-Product
                Messages. Use the{' '}
                <strong className="text-foreground">Product Catalog</strong>{' '}
                template type to get started.
              </p>
            </GuideStep>
          </div>
        </ClayCard>
      )}

      <div className="h-6" />
    </div>
  );
}

/* ── helper components ──────────────────────────────────────────── */

function NoProjectCard({ onChoose }: { onChoose: () => void }) {
  return (
    <ClayCard padded={false} className="p-10 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
        <LuCircleAlert className="h-5 w-5" strokeWidth={1.5} />
      </div>
      <div className="mt-4 text-[15px] font-semibold text-foreground">
        No project selected
      </div>
      <div className="mt-1.5 text-[12.5px] text-muted-foreground">
        Please select a WhatsApp project from the main dashboard to manage its
        catalog.
      </div>
      <ClayButton
        variant="rose"
        size="md"
        onClick={onChoose}
        className="mt-5"
      >
        Choose a project
      </ClayButton>
    </ClayCard>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="inline-flex items-center rounded-[4px] border border-border bg-card px-1.5 py-0.5 font-mono text-[11px] text-accent-foreground">
      {children}
    </code>
  );
}

function GuideStep({
  step,
  title,
  image,
  imageFirst,
  children,
}: {
  step: string;
  title: string;
  image?: (typeof PlaceHolderImages)[number];
  imageFirst?: boolean;
  children: React.ReactNode;
}) {
  const imageBlock = image ? (
    <div className="overflow-hidden rounded-[14px] border border-border shadow-sm">
      <Image
        src={image.imageUrl}
        alt={image.description}
        width={600}
        height={400}
        className="w-full"
        data-ai-hint={image.imageHint}
      />
    </div>
  ) : null;

  return (
    <div className="grid items-center gap-6 md:grid-cols-2">
      {imageFirst ? imageBlock : null}
      <div>
        <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-accent-foreground">
          {step}
        </div>
        <h3 className="mb-3 text-[18px] font-semibold tracking-[-0.01em] text-foreground">
          {title}
        </h3>
        {children}
      </div>
      {!imageFirst ? imageBlock : null}
    </div>
  );
}
