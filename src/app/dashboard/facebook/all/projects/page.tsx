"use client";

import {
  ZoruAlert,
  ZoruAlertDescription,
  ZoruAlertTitle,
  ZoruBadge,
  ZoruBreadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  ZoruButton,
  ZoruCard,
  ZoruEmptyState,
  ZoruPageDescription,
  ZoruPageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  ZoruSkeleton,
} from '@/components/zoruui';
import {
  useCallback,
  useEffect,
  useState,
  useTransition } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  RefreshCw,
  Sparkles,
  Wrench,
  XCircle,
  } from "lucide-react";

import { getProjects } from "@/app/actions/project.actions";
import type { Project,
  WithId } from "@/lib/definitions";

/**
 * /dashboard/facebook/all/projects — Project ↔ Facebook connection list.
 *
 * Rebuilt on ZoruUI primitives. Same `getProjects` server action and the
 * same OAuth entrypoint (`/api/auth/meta-suite/login`) as
 * `/dashboard/facebook/all-projects` — visual layer is pure zoru, neutral
 * palette, no rainbow accents.
 */

import * as React from "react";

import { ManualSetupDialog } from "../../_components/manual-setup-dialog";
import { FacebookGlyph } from "../../_components/icons";

/* ── skeleton ────────────────────────────────────────────────────── */

function ProjectsSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[1320px] px-6 pt-6 pb-10">
      <ZoruSkeleton className="h-3 w-48" />
      <div className="mt-5 flex items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <ZoruSkeleton className="h-3 w-24" />
          <ZoruSkeleton className="h-7 w-72" />
          <ZoruSkeleton className="h-3 w-96" />
        </div>
        <div className="flex gap-2">
          <ZoruSkeleton className="h-9 w-28" />
          <ZoruSkeleton className="h-9 w-32" />
        </div>
      </div>
      <div className="mt-6 flex flex-col gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <ZoruSkeleton key={i} className="h-28 w-full" />
        ))}
      </div>
    </div>
  );
}

/* ── connection card ─────────────────────────────────────────────── */

function ProjectConnectionCard({
  project,
  appId,
}: {
  project: WithId<Project>;
  appId: string | undefined;
}) {
  const isConnected = !!(project.adAccountId && project.facebookPageId);
  return (
    <ZoruCard className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--zoru-radius-sm)] bg-zoru-surface-2 text-zoru-ink">
          <FacebookGlyph className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-[14px] text-zoru-ink">{project.name}</p>
          <p className="mt-0.5 truncate text-[11.5px] text-zoru-ink-muted">
            WABA ID: {project.wabaId || "—"}
          </p>
          <div className="mt-2 inline-flex items-center gap-1.5">
            {isConnected ? (
              <ZoruBadge variant="outline" className="gap-1">
                <CheckCircle2 className="h-3 w-3 text-zoru-success" />
                Connected
              </ZoruBadge>
            ) : (
              <ZoruBadge variant="secondary" className="gap-1">
                <XCircle className="h-3 w-3 text-zoru-ink-subtle" />
                Not connected
              </ZoruBadge>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 self-end sm:self-auto">
        {appId ? (
          <ZoruButton asChild size="sm">
            <a
              href={`/api/auth/meta-suite/login?projectId=${encodeURIComponent(
                project._id.toString(),
              )}${isConnected ? "&reauthorize=true" : ""}`}
            >
              <FacebookGlyph className="h-4 w-4" />
              {isConnected ? "Reconnect" : "Connect"}
            </a>
          </ZoruButton>
        ) : (
          <span className="text-[12px] text-zoru-danger">
            Facebook integration not configured.
          </span>
        )}
      </div>
    </ZoruCard>
  );
}

/* ── page ────────────────────────────────────────────────────────── */

export default function AllProjectsPage() {
  const [projects, setProjects] = useState<WithId<Project>[]>([]);
  const [isLoading, startLoading] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(() => {
    startLoading(async () => {
      try {
        const result = await getProjects();
        const list = Array.isArray(result)
          ? result
          : result && Array.isArray((result as any).projects)
            ? (result as any).projects
            : [];
        setProjects(list);
        setError(null);
      } catch (e) {
        console.error("[AllProjectsPage] failed to fetch projects:", e);
        setError("Failed to load projects.");
        setProjects([]);
      }
    });
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const appId = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID;
  const configId = process.env.NEXT_PUBLIC_FACEBOOK_CONFIG_ID;

  if (isLoading && projects.length === 0) return <ProjectsSkeleton />;

  return (
    <div className="mx-auto w-full max-w-[1320px] px-6 pt-6 pb-10">
      <ZoruBreadcrumb>
        <ZoruBreadcrumbList>
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard">SabNode</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard/facebook">
              Meta Suite
            </ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbPage>All connections</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </ZoruBreadcrumb>

      <ZoruPageHeader className="mt-5" bordered={false}>
        <ZoruPageHeading>
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-zoru-ink-subtle">
            Project connections
          </p>
          <ZoruPageTitle>All project connections</ZoruPageTitle>
          <ZoruPageDescription>
            Connect each project to Facebook to enable Click-to-WhatsApp ads,
            Messenger inbox and the rest of Meta Suite.
          </ZoruPageDescription>
        </ZoruPageHeading>
        <div className="flex flex-wrap items-center gap-2">
          <ZoruButton variant="outline" size="sm" onClick={fetchData}>
            <RefreshCw /> Refresh
          </ZoruButton>
          <ManualSetupDialog onSuccess={fetchData} />
        </div>
      </ZoruPageHeader>

      {!appId || !configId ? (
        <div className="mt-5">
          <ZoruAlert variant="warning">
            <AlertCircle />
            <ZoruAlertTitle>Facebook integration not configured</ZoruAlertTitle>
            <ZoruAlertDescription>
              An admin still needs to set the Facebook App ID and Config ID
              before projects can be connected.
            </ZoruAlertDescription>
          </ZoruAlert>
        </div>
      ) : null}

      {error ? (
        <div className="mt-5">
          <ZoruAlert variant="destructive">
            <AlertCircle />
            <ZoruAlertTitle>Could not load projects</ZoruAlertTitle>
            <ZoruAlertDescription>{error}</ZoruAlertDescription>
          </ZoruAlert>
        </div>
      ) : null}

      {projects.length > 0 ? (
        <div className="mt-6 flex flex-col gap-3">
          {projects.map((project) => (
            <ProjectConnectionCard
              key={project._id.toString()}
              project={project}
              appId={appId}
            />
          ))}
        </div>
      ) : (
        <div className="mt-6">
          <ZoruEmptyState
            icon={<Wrench />}
            title="No projects yet"
            description="Create a project before connecting Facebook. Projects group together a WhatsApp number, a Facebook Page and an Ad account."
            action={
              <ZoruButton asChild>
                <Link href="/dashboard">
                  Open dashboard <ArrowRight />
                </Link>
              </ZoruButton>
            }
          />
        </div>
      )}

      {/* ── footer hint ── */}
      <div className="mt-8">
        <ZoruCard className="flex flex-col gap-2 p-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-[var(--zoru-radius-sm)] bg-zoru-surface-2 text-zoru-ink-muted">
              <Sparkles className="h-3.5 w-3.5" />
            </span>
            <div>
              <p className="text-[13px] text-zoru-ink">Connect for full Meta Suite</p>
              <p className="mt-0.5 text-[12px] text-zoru-ink-muted">
                Once connected, you can send broadcasts, manage Messenger,
                schedule posts and run Click-to-WhatsApp ads.
              </p>
            </div>
          </div>
          <ZoruButton asChild variant="outline" size="sm">
            <Link href="/dashboard/facebook/all-projects">
              View connected pages
            </Link>
          </ZoruButton>
        </ZoruCard>
      </div>
    </div>
  );
}
