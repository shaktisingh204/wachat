"use client";

/**
 * /dashboard/facebook/commerce/products — catalog grid for the active
 * Facebook project. Fetches catalogs via getCatalogs, syncs via
 * syncCatalogs, and exposes a per-catalog drill-in to
 * /commerce/products/[catalogId]. Pure ZoruUI primitives — no clay,
 * no sync-button composite.
 */

import * as React from "react";
import { useEffect, useState, useTransition, useCallback } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ExternalLink,
  Lock,
  RefreshCw,
  ServerCog,
  ShoppingBag,
} from "lucide-react";
import type { WithId } from "mongodb";

import { getCatalogs, syncCatalogs } from "@/app/actions/catalog.actions";
import { getProjectById } from "@/app/actions/project.actions";
import type { Catalog } from "@/lib/definitions";
import { useProject } from "@/context/project-context";

import {
  ZoruAlert,
  ZoruAlertDescription,
  ZoruAlertTitle,
  ZoruButton,
  ZoruCard,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardHeader,
  ZoruCardTitle,
  ZoruEmptyState,
  ZoruSkeleton,
  useZoruToast,
} from "@/components/zoruui";

import {
  CommerceBreadcrumb,
  CommerceHeader,
  CommercePage,
} from "../../_components/commerce-shell";

function ProductsSkeleton() {
  return (
    <CommercePage>
      <ZoruSkeleton className="h-3 w-72" />
      <div className="mt-5 flex items-end justify-between">
        <div className="space-y-3">
          <ZoruSkeleton className="h-3 w-24" />
          <ZoruSkeleton className="h-8 w-72" />
          <ZoruSkeleton className="h-4 w-96" />
        </div>
        <ZoruSkeleton className="h-9 w-32" />
      </div>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <ZoruSkeleton key={i} className="h-44" />
        ))}
      </div>
    </CommercePage>
  );
}

export default function ProductsCatalogListPage() {
  const [catalogs, setCatalogs] = useState<WithId<Catalog>[]>([]);
  const [isSyncing, startSync] = useTransition();
  const [isLoading, startLoading] = useTransition();
  const { activeProject, activeProjectId, isLoadingProject } = useProject();
  const { toast } = useZoruToast();

  const fetchData = useCallback(() => {
    if (!activeProjectId) return;
    startLoading(async () => {
      // Touch the project record so it's hydrated client-side.
      await getProjectById(activeProjectId);
      const result = await getCatalogs(activeProjectId);
      if (result.error) {
        toast({
          title: "Could not load catalogs",
          description: result.error,
          variant: "destructive",
        });
        setCatalogs([]);
      } else {
        // Server returns Meta-shaped catalogs; cast to WithId<Catalog>
        // to match the original page's type expectation.
        setCatalogs((result.catalogs ?? []) as unknown as WithId<Catalog>[]);
      }
    });
  }, [activeProjectId, toast]);

  useEffect(() => {
    if (activeProjectId) fetchData();
  }, [activeProjectId, fetchData]);

  const handleSync = useCallback(() => {
    if (!activeProjectId) return;
    startSync(async () => {
      const result = await syncCatalogs(activeProjectId);
      if ((result as { error?: string })?.error) {
        toast({
          title: "Sync failed",
          description: (result as { error?: string }).error!,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Catalogs synced",
          description: "Latest catalogs pulled from Meta.",
          variant: "success",
        });
        fetchData();
      }
    });
  }, [activeProjectId, fetchData, toast]);

  if (isLoadingProject) {
    return <ProductsSkeleton />;
  }

  const hasCatalogAccess = activeProject?.hasCatalogManagement === true;
  const isFacebookProject =
    !!activeProject?.facebookPageId && !activeProject?.wabaId;

  return (
    <CommercePage>
      <CommerceBreadcrumb section="Commerce" pageLabel="Products" />
      <CommerceHeader
        eyebrow="Meta Suite › Commerce"
        title="Products & catalogs"
        description="Browse the catalogs powering your Facebook Shop and drill into each to manage products."
        actions={
          hasCatalogAccess && isFacebookProject ? (
            <ZoruButton
              variant="outline"
              size="sm"
              onClick={handleSync}
              disabled={isSyncing || isLoading}
            >
              <RefreshCw
                className={isSyncing ? "animate-spin" : undefined}
              />
              Sync with Meta
            </ZoruButton>
          ) : undefined
        }
      />

      {!activeProjectId ? (
        <ZoruAlert variant="destructive" className="mt-6">
          <AlertCircle className="h-4 w-4" />
          <ZoruAlertTitle>No project selected</ZoruAlertTitle>
          <ZoruAlertDescription>
            Pick a Facebook Page project from the Connections page to manage
            catalogs.
          </ZoruAlertDescription>
        </ZoruAlert>
      ) : !isFacebookProject ? (
        <ZoruAlert variant="destructive" className="mt-6">
          <AlertCircle className="h-4 w-4" />
          <ZoruAlertTitle>Invalid project type</ZoruAlertTitle>
          <ZoruAlertDescription>
            This section is for Facebook Page projects. Switch to a Facebook
            project to continue.
          </ZoruAlertDescription>
        </ZoruAlert>
      ) : !hasCatalogAccess ? (
        <ZoruCard className="mt-8">
          <ZoruCardHeader>
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zoru-surface-2 text-zoru-ink">
              <Lock className="h-5 w-5" />
            </div>
            <ZoruCardTitle>Catalog management locked</ZoruCardTitle>
            <ZoruCardDescription>
              This project was set up without catalog management permissions.
              Re-authorize to grant <code>catalog_management</code> and{" "}
              <code>business_management</code>.
            </ZoruCardDescription>
          </ZoruCardHeader>
          <ZoruCardContent>
            <ZoruButton asChild>
              <Link href="/dashboard/facebook/all-projects">
                Re-authorize project
              </Link>
            </ZoruButton>
          </ZoruCardContent>
        </ZoruCard>
      ) : isLoading && catalogs.length === 0 ? (
        <ProductsSkeleton />
      ) : catalogs.length === 0 ? (
        <div className="mt-8">
          <ZoruEmptyState
            icon={<ServerCog />}
            title="No catalogs found"
            description={
              "Create a catalog in Meta Commerce Manager, then click Sync with Meta to pull it in."
            }
            action={
              <ZoruButton asChild size="sm" variant="outline">
                <a
                  href="https://business.facebook.com/commerce_manager/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open Commerce Manager <ExternalLink />
                </a>
              </ZoruButton>
            }
          />
        </div>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {catalogs.map((catalog) => (
            <CatalogTile key={String(catalog._id ?? catalog.metaCatalogId)} catalog={catalog} />
          ))}
        </div>
      )}
    </CommercePage>
  );
}

function CatalogTile({ catalog }: { catalog: WithId<Catalog> }) {
  const id = catalog.metaCatalogId ?? (catalog as unknown as { id?: string }).id;
  return (
    <ZoruCard className="flex h-full flex-col">
      <ZoruCardHeader>
        <ZoruCardTitle className="text-base">{catalog.name}</ZoruCardTitle>
        <ZoruCardDescription className="break-all font-mono text-[11px]">
          ID: {id}
        </ZoruCardDescription>
      </ZoruCardHeader>
      <ZoruCardContent className="flex-1 text-xs text-zoru-ink-muted">
        {catalog.createdAt
          ? `Created ${new Date(catalog.createdAt).toLocaleDateString()}`
          : "No creation date available"}
      </ZoruCardContent>
      <div className="px-6 pb-6">
        <ZoruButton asChild size="sm" className="w-full">
          <Link href={`/dashboard/facebook/commerce/products/${id}`}>
            <ShoppingBag /> View products
          </Link>
        </ZoruButton>
      </div>
    </ZoruCard>
  );
}
