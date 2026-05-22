'use client';

import {
  Breadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  Button,
  Card,
  EmptyState,
  ZoruPageDescription,
  PageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  Skeleton,
} from '@/components/zoruui';
import {
  useCallback,
  useEffect,
  useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
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
import { SyncCatalogsButton } from '@/components/wabasimplify/sync-catalogs-button';
import EmbeddedSignup from '@/components/wabasimplify/embedded-signup';
import { useProject } from '@/context/project-context';
import { PlaceHolderImages } from '@/lib/placeholder-images';

/**
 * Wachat Catalog — catalog list + Meta Commerce setup guide.
 */

import * as React from 'react';

function WACatalogCard({ catalog }: { catalog: WithId<Catalog> }) {
  return (
    <ZoruCard className="flex flex-col p-5">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-[var(--zoru-radius)] bg-zoru-surface-2 text-zoru-ink">
          <ShoppingBag className="h-[18px] w-[18px]" />
        </span>
        <span className="min-w-0 flex-1 truncate text-[15px] text-zoru-ink">
          {catalog.name}
        </span>
      </div>

      <div className="mt-5">
        <div className="text-[10px] uppercase tracking-wide text-zoru-ink-muted">
          Meta catalog ID
        </div>
        <div className="mt-1 break-all font-mono text-[11.5px] tabular-nums text-zoru-ink-muted">
          {catalog.metaCatalogId}
        </div>
      </div>

      <div className="mt-4 text-[11px] text-zoru-ink-muted">
        Created {new Date(catalog.createdAt).toLocaleDateString()}
      </div>

      <div className="mt-auto pt-5">
        <ZoruButton asChild block>
          <Link href={`/wachat/catalog/${catalog.metaCatalogId}`}>
            <ShoppingBag className="h-3.5 w-3.5" />
            View products
          </Link>
        </ZoruButton>
      </div>
    </ZoruCard>
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
            <ZoruBreadcrumbPage>Catalog</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </ZoruBreadcrumb>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <ZoruPageHeader>
          <ZoruPageHeading>
            <ZoruPageTitle>Ecomm + catalog</ZoruPageTitle>
            <ZoruPageDescription>
              Manage product catalogs that power WhatsApp interactive messages — single-product and
              multi-product carousels.
            </ZoruPageDescription>
          </ZoruPageHeading>
        </ZoruPageHeader>
        {hasCatalogAccess && activeProjectId ? (
          <SyncCatalogsButton projectId={activeProjectId} onSyncComplete={fetchData} />
        ) : null}
      </div>
    </>
  );

  if (isLoadingProject) {
    return (
      <div className="flex min-h-full flex-col gap-6">
        {header}
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <ZoruSkeleton key={i} className="h-[220px]" />
          ))}
        </div>
      </div>
    );
  }

  if (!activeProjectId) {
    return (
      <div className="flex min-h-full flex-col gap-6">
        {header}
        <ZoruEmptyState
          icon={<CircleAlert className="h-10 w-10" />}
          title="No project selected"
          description="Please select a WhatsApp project from the main dashboard to manage its catalog."
          action={<ZoruButton onClick={() => router.push('/wachat')}>Choose a project</ZoruButton>}
        />
      </div>
    );
  }

  if (!isWhatsAppProject) {
    return (
      <div className="flex min-h-full flex-col gap-6">
        {header}
        <ZoruEmptyState
          icon={<CircleAlert className="h-10 w-10" />}
          title="Invalid project type"
          description="This section is for WhatsApp projects. The selected project is not a WhatsApp project."
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col gap-6">
      {header}

      {!hasCatalogAccess ? (
        <ZoruCard className="p-8">
          <div className="flex flex-col items-center gap-4 py-4 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-[var(--zoru-radius-lg)] bg-zoru-danger/10 text-zoru-danger-ink">
              <Lock className="h-7 w-7" />
            </span>
            <h2 className="text-[22px] tracking-[-0.01em] text-zoru-ink">
              Catalog management locked
            </h2>
            <p className="max-w-md text-sm leading-relaxed text-zoru-ink-muted">
              This project was set up without catalog management permissions. Re-authorize the
              application with <Code>catalog_management</Code> and{' '}
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
                <p className="text-[12.5px] text-zoru-danger-ink">
                  Admin has not configured the Facebook App ID.
                </p>
              )}
            </div>
          </div>
        </ZoruCard>
      ) : catalogs.length > 0 ? (
        <div>
          <div className="mb-4 flex items-center justify-between">
            <div className="text-[11px] uppercase tracking-wide text-zoru-ink-muted">
              {catalogs.length} {catalogs.length === 1 ? 'catalog' : 'catalogs'}
            </div>
          </div>
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {catalogs.map((c) => (
              <WACatalogCard key={c._id.toString()} catalog={c} />
            ))}
          </div>
        </div>
      ) : (
        <ZoruCard className="p-6">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-[var(--zoru-radius-sm)] bg-zoru-surface-2 text-zoru-ink">
              <GitBranch className="h-4 w-4" />
            </span>
            <div>
              <div className="text-[15px] leading-tight text-zoru-ink">
                Get started with catalogs
              </div>
              <div className="mt-0.5 text-[11.5px] text-zoru-ink-muted">
                Create a catalog in Meta Commerce Manager, then sync it here.
              </div>
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-10">
            <GuideStep step="Step 1" title="Create a catalog" image={step1}>
              <ol className="list-inside list-decimal space-y-2 pl-4 text-sm text-zoru-ink-muted">
                <li>
                  Open the{' '}
                  <a
                    href="https://business.facebook.com/commerce"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-zoru-ink hover:underline"
                  >
                    Meta Commerce Manager <ExternalLink className="h-3 w-3" />
                  </a>
                  .
                </li>
                <li>Make sure you have the correct Business Manager account selected.</li>
                <li>
                  Click <strong className="text-zoru-ink">Add Catalog</strong>, choose{' '}
                  <strong className="text-zoru-ink">E-commerce</strong> as the type, and follow the
                  prompts.
                </li>
              </ol>
            </GuideStep>

            <GuideStep step="Step 2" title="Assign partner" image={step2}>
              <ol className="list-inside list-decimal space-y-2 pl-4 text-sm text-zoru-ink-muted">
                <li>
                  In Business Settings, go to{' '}
                  <strong className="text-zoru-ink">Data Sources → Catalogs</strong>.
                </li>
                <li>Select your newly created catalog.</li>
                <li>
                  Click <strong className="text-zoru-ink">Assign Partners</strong>.
                </li>
                <li>Assign your BSP as a partner with Full Access permissions.</li>
              </ol>
            </GuideStep>

            <GuideStep
              step="Step 3"
              title="Add your first product (mandatory)"
              image={step2}
            >
              <ol className="list-inside list-decimal space-y-2 pl-4 text-sm text-zoru-ink-muted">
                <li>
                  In your new catalog, go to the <strong className="text-zoru-ink">Items</strong>{' '}
                  tab and click <strong className="text-zoru-ink">Add Items</strong>.
                </li>
                <li>
                  Choose the <strong className="text-zoru-ink">Manual</strong> option.
                </li>
                <li>
                  Fill in all required details for at least one product (image, price, currency,
                  availability, description).
                </li>
                <li className="text-zoru-ink">
                  This step is mandatory to activate the catalog for WhatsApp.
                </li>
              </ol>
            </GuideStep>

            <GuideStep step="Step 4" title="Assign to WABA" image={step3}>
              <ol className="list-inside list-decimal space-y-2 pl-4 text-sm text-zoru-ink-muted">
                <li>
                  Navigate to <strong className="text-zoru-ink">WhatsApp Manager</strong> from your
                  Business Suite.
                </li>
                <li>
                  Go to <strong className="text-zoru-ink">Account tools → Catalog</strong>.
                </li>
                <li>
                  Click <strong className="text-zoru-ink">Choose a catalog</strong>.
                </li>
                <li>
                  Select the catalog you just created and click{' '}
                  <strong className="text-zoru-ink">Connect catalog</strong>.
                </li>
              </ol>
            </GuideStep>

            <div className="flex flex-col items-center gap-3 rounded-[var(--zoru-radius-lg)] border-2 border-dashed border-zoru-line-strong bg-zoru-surface px-6 py-8 text-center">
              <div className="text-[11px] uppercase tracking-wide text-zoru-ink-muted">Step 5</div>
              <h3 className="text-[22px] tracking-[-0.01em] text-zoru-ink">Sync your catalog</h3>
              <p className="max-w-xl text-sm text-zoru-ink-muted">
                Once your catalog is created, has at least one product, and is connected to your
                WABA, return here and click sync.
              </p>
              <div className="mt-2">
                <SyncCatalogsButton projectId={activeProjectId} onSyncComplete={fetchData} />
              </div>
            </div>

            <GuideStep
              step="Step 6"
              title="Send WhatsApp catalog messages"
              image={step6}
              imageFirst
            >
              <p className="text-sm leading-relaxed text-zoru-ink-muted">
                After a successful sync, reference your products inside interactive messages —
                multi-product and single-product messages. Use the{' '}
                <strong className="text-zoru-ink">Product Catalog</strong> template type to get
                started. <ArrowRight className="ml-1 inline h-3 w-3" />
              </p>
            </GuideStep>
          </div>
        </ZoruCard>
      )}
    </div>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="inline-flex items-center rounded-[4px] border border-zoru-line bg-zoru-surface px-1.5 py-0.5 font-mono text-[11px] text-zoru-ink">
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
    <div className="overflow-hidden rounded-[var(--zoru-radius-lg)] border border-zoru-line shadow-[var(--zoru-shadow-sm)]">
      <Image
        src={image.imageUrl}
        alt={image.description}
        width={600}
        height={400}
        className="w-full"
      />
    </div>
  ) : null;

  return (
    <div className="grid items-center gap-6 md:grid-cols-2">
      {imageFirst ? imageBlock : null}
      <div>
        <div className="mb-1.5 text-[10px] uppercase tracking-wide text-zoru-ink-muted">
          {step}
        </div>
        <h3 className="mb-3 text-[18px] tracking-[-0.01em] text-zoru-ink">{title}</h3>
        {children}
      </div>
      {!imageFirst ? imageBlock : null}
    </div>
  );
}
