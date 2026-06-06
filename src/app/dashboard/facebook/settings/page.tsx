"use client";

import {
  Alert,
  ZoruAlertDescription,
  ZoruAlertTitle,
  Badge,
  Breadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  Button,
  Card,
  Input,
  Label,
  ZoruPageDescription,
  PageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  Separator,
  Skeleton,
  useZoruToast,
} from '@/components/sabcrm/20ui/compat';
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
      <Skeleton className="h-3 w-48" />
      <div className="mt-5 flex flex-col gap-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-7 w-72" />
        <Skeleton className="h-3 w-96" />
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-72 w-full lg:col-span-2" />
        <Skeleton className="h-72 w-full" />
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
      <Label htmlFor={id} className="text-[11.5px] uppercase tracking-wide text-[var(--st-text-tertiary)]">
        {label}
      </Label>
      <div className="flex gap-2">
        <Input
          id={id}
          value={safe}
          readOnly
          className={monospace ? "font-mono text-[12.5px]" : ""}
        />
        {copyable && value ? (
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={`Copy ${label}`}
            onClick={copy}
          >
            <Copy />
          </Button>
        ) : null}
      </div>
      {hint ? (
        <p className="text-[11px] text-[var(--st-text-secondary)]">{hint}</p>
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
        <Breadcrumb>
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
        </Breadcrumb>
        <div className="mt-6">
          <NoProjectState />
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="mx-auto w-full max-w-[1320px] px-6 pt-6 pb-10">
        <Alert variant="destructive">
          <AlertCircle />
          <ZoruAlertTitle>Project not found</ZoruAlertTitle>
          <ZoruAlertDescription>
            The selected project could not be loaded. Try refreshing or pick
            another project.
          </ZoruAlertDescription>
        </Alert>
      </div>
    );
  }

  const hasMarketingSetup = !!(project.adAccountId && project.facebookPageId);

  return (
    <div className="mx-auto w-full max-w-[1320px] px-6 pt-6 pb-10">
      <Breadcrumb>
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
      </Breadcrumb>

      <PageHeader className="mt-5" bordered={false}>
        <ZoruPageHeading>
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-[var(--st-text-tertiary)]">
            Project · {project.name}
          </p>
          <ZoruPageTitle>Facebook connection</ZoruPageTitle>
          <ZoruPageDescription>
            Review the connected Facebook Page and Ad Account for this project.
            All IDs were retrieved automatically via Embedded Signup.
          </ZoruPageDescription>
        </ZoruPageHeading>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={refresh}>
            <RefreshCw /> Refresh
          </Button>
          <Button asChild size="sm">
            <Link href="/dashboard/facebook/all-projects">
              {hasMarketingSetup ? "Reconnect" : "Connect"}
              <ArrowRight />
            </Link>
          </Button>
        </div>
      </PageHeader>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {/* ── Connection fields ── */}
        <Card className="p-6 lg:col-span-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-[var(--st-text-tertiary)]">
                Connected accounts
              </p>
              <h3 className="mt-1 text-[16px] text-[var(--st-text)]">
                Page &amp; ad account IDs
              </h3>
            </div>
            {hasMarketingSetup ? (
              <Badge variant="outline" className="gap-1">
                <CheckCircle2 className="h-3 w-3 text-[var(--st-status-ok)]" />
                Connected
              </Badge>
            ) : (
              <Badge variant="secondary" className="gap-1">
                <XCircle className="h-3 w-3 text-[var(--st-text-tertiary)]" />
                Not connected
              </Badge>
            )}
          </div>

          {!hasMarketingSetup ? (
            <div className="mt-5">
              <Alert variant="warning">
                <AlertCircle />
                <ZoruAlertTitle>No Facebook account connected</ZoruAlertTitle>
                <ZoruAlertDescription>
                  No Facebook Page or Ad Account is connected to this project.
                  Use the connect button above to authorize Meta.
                </ZoruAlertDescription>
              </Alert>
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

          <Separator className="my-6" />

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[12.5px] text-[var(--st-text)]">
                Re-authorize whenever permissions change
              </p>
              <p className="mt-0.5 text-[11.5px] text-[var(--st-text-secondary)]">
                If you grant new Facebook permissions or rotate tokens, run a
                fresh connect.
              </p>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/facebook/all-projects">
                {hasMarketingSetup ? "Reconnect / change account" : "Connect account"}
              </Link>
            </Button>
          </div>
        </Card>

        {/* ── Linked assets ── */}
        <Card className="p-5">
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-[var(--st-text-tertiary)]">
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

          <Separator className="my-5" />

          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-[var(--st-text-tertiary)]">
            Quick links
          </p>
          <div className="mt-3 flex flex-col gap-2">
            <Button
              asChild
              variant="outline"
              size="sm"
              className="justify-start"
            >
              <Link href="/dashboard/facebook/page-roles">
                <ShieldCheck /> Page roles
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="sm"
              className="justify-start"
            >
              <Link href="/dashboard/facebook/agents">
                <SettingsIcon /> AI agents
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="sm"
              className="justify-start"
            >
              <Link href="/dashboard/facebook/webhooks">
                <SettingsIcon /> Webhooks
              </Link>
            </Button>
          </div>
        </Card>
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
    <div className="flex items-center gap-3 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg)] p-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--st-radius-sm)] bg-[var(--st-bg-muted)] text-[var(--st-text)]">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12.5px] text-[var(--st-text)]">{label}</p>
        <p className="mt-0.5 truncate font-mono text-[11px] text-[var(--st-text-secondary)]">
          {detail}
        </p>
      </div>
      {status === "connected" ? (
        <Badge variant="outline" className="gap-1">
          <CheckCircle2 className="h-3 w-3 text-[var(--st-status-ok)]" />
          OK
        </Badge>
      ) : status === "missing" ? (
        <Badge variant="secondary">Missing</Badge>
      ) : (
        <Badge variant="secondary">Verify</Badge>
      )}
    </div>
  );
}
