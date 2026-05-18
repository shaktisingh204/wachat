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
  ZoruInput,
  ZoruLabel,
  ZoruPageDescription,
  ZoruPageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  ZoruSeparator,
  ZoruSkeleton,
  useZoruToast,
} from '@/components/zoruui';
import {
  useEffect,
  useState,
  useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Copy,
  RefreshCw,
  Settings as SettingsIcon,
  ShieldCheck,
  XCircle,
  } from "lucide-react";

import { getProjectById } from "@/app/actions/project.actions";
import type { Project,
  WithId } from "@/lib/definitions";

/**
 * /dashboard/facebook/settings — page-level settings (Meta connection).
 *
 * Rebuilt on ZoruUI primitives. Same `getProjectById` server action — the
 * read-only IDs and reconnect button keep the original data flow.
 */

import * as React from "react";

import { NoProjectState } from "../_components/no-project-state";
import { FacebookGlyph, InstagramGlyph, WhatsAppGlyph } from "../_components/icons";

/* ── skeleton ────────────────────────────────────────────────────── */

function SettingsSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[1320px] px-6 pt-6 pb-10">
      <ZoruSkeleton className="h-3 w-48" />
      <div className="mt-5 flex flex-col gap-2">
        <ZoruSkeleton className="h-3 w-24" />
        <ZoruSkeleton className="h-7 w-72" />
        <ZoruSkeleton className="h-3 w-96" />
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <ZoruSkeleton className="h-72 w-full lg:col-span-2" />
        <ZoruSkeleton className="h-72 w-full" />
      </div>
    </div>
  );
}

/* ── readonly field ──────────────────────────────────────────────── */

function ReadonlyField({
  id,
  label,
  value,
  hint,
  copyable = false,
  monospace = false,
}: {
  id: string;
  label: string;
  value: string | null | undefined;
  hint?: string;
  copyable?: boolean;
  monospace?: boolean;
}) {
  const { toast } = useZoruToast();
  const safe = value || "—";

  const copy = () => {
    if (!value) return;
    navigator.clipboard.writeText(value);
    toast({
      title: "Copied",
      description: `${label} copied to clipboard.`,
      variant: "success",
    });
  };

  return (
    <div className="grid gap-1.5">
      <ZoruLabel htmlFor={id} className="text-[11.5px] uppercase tracking-wide text-zoru-ink-subtle">
        {label}
      </ZoruLabel>
      <div className="flex gap-2">
        <ZoruInput
          id={id}
          value={safe}
          readOnly
          className={monospace ? "font-mono text-[12.5px]" : ""}
        />
        {copyable && value ? (
          <ZoruButton
            type="button"
            variant="outline"
            size="icon"
            aria-label={`Copy ${label}`}
            onClick={copy}
          >
            <Copy />
          </ZoruButton>
        ) : null}
      </div>
      {hint ? (
        <p className="text-[11px] text-zoru-ink-muted">{hint}</p>
      ) : null}
    </div>
  );
}

/* ── page ────────────────────────────────────────────────────────── */

export default function FacebookSettingsPage() {
  const router = useRouter();
  const [project, setProject] = useState<WithId<Project> | null>(null);
  const [isLoading, startLoading] = useTransition();
  const [isClient, setIsClient] = useState(false);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);

  useEffect(() => {
    setIsClient(true);
    setActiveProjectId(localStorage.getItem("activeProjectId"));
  }, []);

  const refresh = React.useCallback(() => {
    if (!activeProjectId) return;
    startLoading(async () => {
      const data = await getProjectById(activeProjectId);
      setProject(data);
    });
  }, [activeProjectId]);

  useEffect(() => {
    if (isClient && activeProjectId) refresh();
  }, [isClient, activeProjectId, refresh]);

  if (!isClient || (isLoading && !project)) {
    return <SettingsSkeleton />;
  }

  if (!activeProjectId) {
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
              <ZoruBreadcrumbPage>Settings</ZoruBreadcrumbPage>
            </ZoruBreadcrumbItem>
          </ZoruBreadcrumbList>
        </ZoruBreadcrumb>
        <div className="mt-6">
          <NoProjectState />
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="mx-auto w-full max-w-[1320px] px-6 pt-6 pb-10">
        <ZoruAlert variant="destructive">
          <AlertCircle />
          <ZoruAlertTitle>Project not found</ZoruAlertTitle>
          <ZoruAlertDescription>
            The selected project could not be loaded. Try refreshing or pick
            another project.
          </ZoruAlertDescription>
        </ZoruAlert>
      </div>
    );
  }

  const hasMarketingSetup = !!(project.adAccountId && project.facebookPageId);

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
            <ZoruBreadcrumbPage>Settings</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </ZoruBreadcrumb>

      <ZoruPageHeader className="mt-5" bordered={false}>
        <ZoruPageHeading>
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-zoru-ink-subtle">
            Project · {project.name}
          </p>
          <ZoruPageTitle>Facebook connection</ZoruPageTitle>
          <ZoruPageDescription>
            Review the connected Facebook Page and Ad Account for this project.
            All IDs were retrieved automatically via Embedded Signup.
          </ZoruPageDescription>
        </ZoruPageHeading>
        <div className="flex items-center gap-2">
          <ZoruButton variant="outline" size="sm" onClick={refresh}>
            <RefreshCw /> Refresh
          </ZoruButton>
          <ZoruButton asChild size="sm">
            <Link href="/dashboard/facebook/all-projects">
              {hasMarketingSetup ? "Reconnect" : "Connect"}
              <ArrowRight />
            </Link>
          </ZoruButton>
        </div>
      </ZoruPageHeader>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {/* ── Connection fields ── */}
        <ZoruCard className="p-6 lg:col-span-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-zoru-ink-subtle">
                Connected accounts
              </p>
              <h3 className="mt-1 text-[16px] text-zoru-ink">
                Page &amp; ad account IDs
              </h3>
            </div>
            {hasMarketingSetup ? (
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

          {!hasMarketingSetup ? (
            <div className="mt-5">
              <ZoruAlert variant="warning">
                <AlertCircle />
                <ZoruAlertTitle>No Facebook account connected</ZoruAlertTitle>
                <ZoruAlertDescription>
                  No Facebook Page or Ad Account is connected to this project.
                  Use the connect button above to authorize Meta.
                </ZoruAlertDescription>
              </ZoruAlert>
            </div>
          ) : (
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <ReadonlyField
                id="facebookPageId"
                label="Facebook Page ID"
                value={project.facebookPageId || ""}
                copyable
                monospace
              />
              <ReadonlyField
                id="adAccountId"
                label="Ad Account ID"
                value={project.adAccountId || ""}
                copyable
                monospace
              />
              <ReadonlyField
                id="appId"
                label="Connected App ID"
                value={project.appId || ""}
                copyable
                monospace
                hint="Meta application used for OAuth."
              />
              <ReadonlyField
                id="accessToken"
                label="Access token"
                value={"••••••••••••••••••••"}
                hint="Stored securely. Never displayed in plaintext."
                monospace
              />
              <ReadonlyField
                id="wabaId"
                label="WhatsApp Business ID"
                value={project.wabaId || ""}
                copyable
                monospace
              />
              <ReadonlyField
                id="projectId"
                label="SabNode project ID"
                value={project._id?.toString() || ""}
                copyable
                monospace
              />
            </div>
          )}

          <ZoruSeparator className="my-6" />

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[12.5px] text-zoru-ink">
                Re-authorize whenever permissions change
              </p>
              <p className="mt-0.5 text-[11.5px] text-zoru-ink-muted">
                If you grant new Facebook permissions or rotate tokens, run a
                fresh connect.
              </p>
            </div>
            <ZoruButton asChild variant="outline" size="sm">
              <Link href="/dashboard/facebook/all-projects">
                {hasMarketingSetup ? "Reconnect / change account" : "Connect account"}
              </Link>
            </ZoruButton>
          </div>
        </ZoruCard>

        {/* ── Linked assets ── */}
        <ZoruCard className="p-5">
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-zoru-ink-subtle">
            Linked assets
          </p>
          <div className="mt-3 flex flex-col gap-2">
            <LinkedAsset
              icon={<FacebookGlyph className="h-4 w-4" />}
              label="Facebook Page"
              status={project.facebookPageId ? "connected" : "missing"}
              detail={project.facebookPageId || "—"}
            />
            <LinkedAsset
              icon={<InstagramGlyph className="h-4 w-4" />}
              label="Instagram"
              status="check"
              detail="Verify on Page Settings"
            />
            <LinkedAsset
              icon={<WhatsAppGlyph className="h-4 w-4" />}
              label="WhatsApp"
              status={project.wabaId ? "connected" : "missing"}
              detail={project.wabaId || "Not linked"}
            />
            <LinkedAsset
              icon={<SettingsIcon className="h-4 w-4" />}
              label="Ad Account"
              status={project.adAccountId ? "connected" : "missing"}
              detail={project.adAccountId || "Not linked"}
            />
          </div>

          <ZoruSeparator className="my-5" />

          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-zoru-ink-subtle">
            Quick links
          </p>
          <div className="mt-3 flex flex-col gap-2">
            <ZoruButton
              asChild
              variant="outline"
              size="sm"
              className="justify-start"
            >
              <Link href="/dashboard/facebook/page-roles">
                <ShieldCheck /> Page roles
              </Link>
            </ZoruButton>
            <ZoruButton
              asChild
              variant="outline"
              size="sm"
              className="justify-start"
            >
              <Link href="/dashboard/facebook/agents">
                <SettingsIcon /> AI agents
              </Link>
            </ZoruButton>
            <ZoruButton
              asChild
              variant="outline"
              size="sm"
              className="justify-start"
            >
              <Link href="/dashboard/facebook/webhooks">
                <SettingsIcon /> Webhooks
              </Link>
            </ZoruButton>
          </div>
        </ZoruCard>
      </div>
    </div>
  );
}

function LinkedAsset({
  icon,
  label,
  status,
  detail,
}: {
  icon: React.ReactNode;
  label: string;
  status: "connected" | "missing" | "check";
  detail: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-bg p-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--zoru-radius-sm)] bg-zoru-surface-2 text-zoru-ink">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12.5px] text-zoru-ink">{label}</p>
        <p className="mt-0.5 truncate font-mono text-[11px] text-zoru-ink-muted">
          {detail}
        </p>
      </div>
      {status === "connected" ? (
        <ZoruBadge variant="outline" className="gap-1">
          <CheckCircle2 className="h-3 w-3 text-zoru-success" />
          OK
        </ZoruBadge>
      ) : status === "missing" ? (
        <ZoruBadge variant="secondary">Missing</ZoruBadge>
      ) : (
        <ZoruBadge variant="secondary">Verify</ZoruBadge>
      )}
    </div>
  );
}
