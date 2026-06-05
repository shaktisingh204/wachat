'use client';
import { fmtDate } from "@/lib/utils";

import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  CardDescription,
  EmptyState,
  Separator,
  Skeleton,
} from '@/components/sabcrm/20ui';
import { WachatPage } from '@/app/wachat/_components/wachat-page';
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
import { SyncCatalogsButton } from '@/components/zoruui-domain/sync-catalogs-button';
import EmbeddedSignup from '@/components/zoruui-domain/embedded-signup';
import { useProject } from '@/context/project-context';
import { PlaceHolderImages } from '@/lib/placeholder-images';

/**
 * Wachat Catalog -- catalog list + Meta Commerce setup guide.
 */

import * as React from 'react';

const BREADCRUMB = [
  { label: 'SabNode', href: '/dashboard' },
  { label: 'WaChat', href: '/wachat' },
  { label: 'Catalog' },
];

function WACatalogCard({ catalog }: { catalog: WithId<Catalog> }) {
  return (
    <Card padding="none" className="flex flex-col p-5">
      <div className="flex items-center gap-3">
        <span
          className="flex h-10 w-10 items-center justify-center"
          style={{
            borderRadius: 'var(--st-radius)',
            background: 'var(--st-bg-secondary)',
            color: 'var(--st-text)',
          }}
          aria-hidden="true"
        >
          <ShoppingBag className="h-[18px] w-[18px]" />
        </span>
        <span className="min-w-0 flex-1 truncate text-[15px] text-[color:var(--st-text)]">
          {catalog.name}
        </span>
      </div>

      <div className="mt-5">
        <div className="text-[10px] uppercase tracking-wide text-[color:var(--st-text-tertiary)]">
          Meta catalog ID
        </div>
        <div className="mt-1 break-all font-mono text-[11.5px] tabular-nums text-[color:var(--st-text-secondary)]">
          {catalog.metaCatalogId}
        </div>
      </div>

      <div className="mt-4 text-[11px] text-[color:var(--st-text-tertiary)]">
        Created {fmtDate(catalog.createdAt)}
      </div>

      <div className="mt-auto pt-5">
        <Link
          href={`/wachat/catalog/${catalog.metaCatalogId}`}
          className="u-btn u-btn--secondary u-btn--md u-btn--block"
        >
          <ShoppingBag className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="u-btn__label">View products</span>
        </Link>
      </div>
    </Card>
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

  const actions =
    hasCatalogAccess && activeProjectId ? (
      <SyncCatalogsButton projectId={activeProjectId} onSyncComplete={fetchData} />
    ) : null;

  if (isLoadingProject) {
    return (
      <WachatPage
        breadcrumb={BREADCRUMB}
        title="Ecomm + catalog"
        description="Manage product catalogs that power WhatsApp interactive messages -- single-product and multi-product carousels."
        width="wide"
      >
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} height={220} radius="var(--st-radius-lg)" />
          ))}
        </div>
      </WachatPage>
    );
  }

  if (!activeProjectId) {
    return (
      <WachatPage
        breadcrumb={BREADCRUMB}
        title="Ecomm + catalog"
        description="Manage product catalogs that power WhatsApp interactive messages -- single-product and multi-product carousels."
        width="wide"
      >
        <EmptyState
          icon={CircleAlert}
          title="No project selected"
          description="Please select a WhatsApp project from the main dashboard to manage its catalog."
          action={
            <Button variant="primary" onClick={() => router.push('/wachat')}>
              Choose a project
            </Button>
          }
        />
      </WachatPage>
    );
  }

  if (!isWhatsAppProject) {
    return (
      <WachatPage
        breadcrumb={BREADCRUMB}
        title="Ecomm + catalog"
        description="Manage product catalogs that power WhatsApp interactive messages -- single-product and multi-product carousels."
        width="wide"
      >
        <EmptyState
          icon={CircleAlert}
          title="Invalid project type"
          description="This section is for WhatsApp projects. The selected project is not a WhatsApp project."
        />
      </WachatPage>
    );
  }

  return (
    <WachatPage
      breadcrumb={BREADCRUMB}
      title="Ecomm + catalog"
      description="Manage product catalogs that power WhatsApp interactive messages -- single-product and multi-product carousels."
      actions={actions}
      width="wide"
    >
      {!hasCatalogAccess ? (
        <Card padding="lg">
          <CardBody>
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <span
                className="flex h-16 w-16 items-center justify-center"
                style={{
                  borderRadius: 'var(--st-radius-lg)',
                  background: 'color-mix(in oklab, var(--st-danger) 10%, transparent)',
                  color: 'var(--st-danger)',
                }}
                aria-hidden="true"
              >
                <Lock className="h-7 w-7" />
              </span>
              <h2 className="text-[22px] tracking-[-0.01em] text-[color:var(--st-text)]">
                Catalog management locked
              </h2>
              <p className="max-w-md text-sm leading-relaxed text-[color:var(--st-text-secondary)]">
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
                  <Alert tone="danger" title="Admin has not configured the Facebook App ID." />
                )}
              </div>
            </div>
          </CardBody>
        </Card>
      ) : catalogs.length > 0 ? (
        <div>
          <div className="mb-4 flex items-center justify-between">
            <Badge tone="neutral" kind="subtle">
              {catalogs.length} {catalogs.length === 1 ? 'catalog' : 'catalogs'}
            </Badge>
          </div>
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {catalogs.map((c) => (
              <WACatalogCard key={c._id.toString()} catalog={c} />
            ))}
          </div>
        </div>
      ) : (
        <Card>
          <CardBody>
            <div className="flex items-center gap-2.5">
              <span
                className="flex h-8 w-8 items-center justify-center"
                style={{
                  borderRadius: 'var(--st-radius)',
                  background: 'var(--st-bg-secondary)',
                  color: 'var(--st-text)',
                }}
                aria-hidden="true"
              >
                <GitBranch className="h-4 w-4" />
              </span>
              <div>
                <div className="text-[15px] leading-tight text-[color:var(--st-text)]">
                  Get started with catalogs
                </div>
                <div className="mt-0.5 text-[11.5px] text-[color:var(--st-text-secondary)]">
                  Create a catalog in Meta Commerce Manager, then sync it here.
                </div>
              </div>
            </div>

            <div className="mt-8 flex flex-col gap-10">
              <GuideStep step="Step 1" title="Create a catalog" image={step1}>
                <ol className="list-inside list-decimal space-y-2 pl-4 text-sm text-[color:var(--st-text-secondary)]">
                  <li>
                    Open the{' '}
                    <a
                      href="https://business.facebook.com/commerce"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[color:var(--st-text)] hover:underline"
                    >
                      Meta Commerce Manager <ExternalLink className="h-3 w-3" aria-hidden="true" />
                    </a>
                    .
                  </li>
                  <li>Make sure you have the correct Business Manager account selected.</li>
                  <li>
                    Click <Strong>Add Catalog</Strong>, choose <Strong>E-commerce</Strong> as the
                    type, and follow the prompts.
                  </li>
                </ol>
              </GuideStep>

              <GuideStep step="Step 2" title="Assign partner" image={step2}>
                <ol className="list-inside list-decimal space-y-2 pl-4 text-sm text-[color:var(--st-text-secondary)]">
                  <li>
                    In Business Settings, go to <Strong>Data Sources &rarr; Catalogs</Strong>.
                  </li>
                  <li>Select your newly created catalog.</li>
                  <li>
                    Click <Strong>Assign Partners</Strong>.
                  </li>
                  <li>Assign your BSP as a partner with Full Access permissions.</li>
                </ol>
              </GuideStep>

              <GuideStep
                step="Step 3"
                title="Add your first product (mandatory)"
                image={step2}
              >
                <ol className="list-inside list-decimal space-y-2 pl-4 text-sm text-[color:var(--st-text-secondary)]">
                  <li>
                    In your new catalog, go to the <Strong>Items</Strong> tab and click{' '}
                    <Strong>Add Items</Strong>.
                  </li>
                  <li>
                    Choose the <Strong>Manual</Strong> option.
                  </li>
                  <li>
                    Fill in all required details for at least one product (image, price, currency,
                    availability, description).
                  </li>
                  <li className="text-[color:var(--st-text)]">
                    This step is mandatory to activate the catalog for WhatsApp.
                  </li>
                </ol>
              </GuideStep>

              <GuideStep step="Step 4" title="Assign to WABA" image={step3}>
                <ol className="list-inside list-decimal space-y-2 pl-4 text-sm text-[color:var(--st-text-secondary)]">
                  <li>
                    Navigate to <Strong>WhatsApp Manager</Strong> from your Business Suite.
                  </li>
                  <li>
                    Go to <Strong>Account tools &rarr; Catalog</Strong>.
                  </li>
                  <li>
                    Click <Strong>Choose a catalog</Strong>.
                  </li>
                  <li>
                    Select the catalog you just created and click <Strong>Connect catalog</Strong>.
                  </li>
                </ol>
              </GuideStep>

              <Card variant="outlined" padding="lg">
                <CardBody>
                  <div className="flex flex-col items-center gap-3 text-center">
                    <Badge tone="neutral" kind="subtle">Step 5</Badge>
                    <h3 className="text-[22px] tracking-[-0.01em] text-[color:var(--st-text)]">
                      Sync your catalog
                    </h3>
                    <p className="max-w-xl text-sm text-[color:var(--st-text-secondary)]">
                      Once your catalog is created, has at least one product, and is connected to your
                      WABA, return here and click sync.
                    </p>
                    <div className="mt-2">
                      <SyncCatalogsButton projectId={activeProjectId} onSyncComplete={fetchData} />
                    </div>
                  </div>
                </CardBody>
              </Card>

              <GuideStep
                step="Step 6"
                title="Send WhatsApp catalog messages"
                image={step6}
                imageFirst
              >
                <p className="text-sm leading-relaxed text-[color:var(--st-text-secondary)]">
                  After a successful sync, reference your products inside interactive messages --
                  multi-product and single-product messages. Use the{' '}
                  <Strong>Product Catalog</Strong> template type to get started.{' '}
                  <ArrowRight className="ml-1 inline h-3 w-3" aria-hidden="true" />
                </p>
              </GuideStep>
            </div>
          </CardBody>
        </Card>
      )}
    </WachatPage>
  );
}

function Strong({ children }: { children: React.ReactNode }) {
  return <strong className="text-[color:var(--st-text)]">{children}</strong>;
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="inline-flex items-center rounded px-1.5 py-0.5 font-mono text-[11px] border border-[color:var(--st-border)] bg-[color:var(--st-bg)] text-[color:var(--st-text)]">
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
    <div className="overflow-hidden rounded-[var(--st-radius-lg)] border border-[color:var(--st-border)] shadow-[var(--st-shadow-sm)]">
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
        <div className="mb-1.5 text-[10px] uppercase tracking-wide text-[color:var(--st-text-tertiary)]">
          {step}
        </div>
        <h3 className="mb-3 text-[18px] tracking-[-0.01em] text-[color:var(--st-text)]">
          {title}
        </h3>
        {children}
      </div>
      {!imageFirst ? imageBlock : null}
    </div>
  );
}
