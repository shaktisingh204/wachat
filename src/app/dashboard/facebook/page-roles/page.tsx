"use client";

import { Alert, AlertDescription, AlertTitle, Badge, Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator, Button, Card, DataTable, EmptyState, PageDescription, PageHeader, PageHeading, PageTitle, Skeleton, type DataTableColumn } from '@/components/sabcrm/20ui';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition } from "react";
import { AlertCircle,
  Ban,
  RefreshCw,
  ShieldCheck } from "lucide-react";

import {
  getBlockedProfiles,
  getPageRoles,
  } from "@/app/actions/facebook.actions";

/**
 * /dashboard/facebook/page-roles — page-roles + blocked profiles.
 *
 * Rebuilt on Ui20 primitives. Same `getPageRoles`, `getBlockedProfiles`,
 * `blockProfile`, `unblockProfile` server actions — no behavioral changes.
 * Pure ui20 tokens, neutral palette.
 */

import * as React from "react";

import { NoProjectState } from "../_components/no-project-state";
import { BlockProfileDialog } from "../_components/block-profile-dialog";
import { UnblockProfileDialog } from "../_components/unblock-profile-dialog";

/* ── types ───────────────────────────────────────────────────────── */

type RoleRow = {
  id?: string;
  name: string;
  role: string;
};

type BlockedRow = {
  id: string;
  name?: string | null;
};

/* ── skeleton ────────────────────────────────────────────────────── */

function PageRolesSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[1320px] px-6 pt-6 pb-10">
      <Skeleton className="h-3 w-48" />
      <div className="mt-5 flex flex-col gap-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-7 w-72" />
        <Skeleton className="h-3 w-96" />
      </div>
      <div className="mt-6 grid gap-3 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-72 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    </div>
  );
}

/* ── stat tile ───────────────────────────────────────────────────── */

function StatTile({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-[var(--st-radius-lg)] border border-[var(--st-border)] bg-[var(--st-bg)] p-4">
      <div className="flex items-start justify-between">
        <span className="flex h-8 w-8 items-center justify-center rounded-[var(--st-radius-sm)] bg-[var(--st-bg-muted)] text-[var(--st-text)] [&_svg]:size-4">
          {icon}
        </span>
      </div>
      <div className="mt-3 text-[11.5px] uppercase tracking-wide text-[var(--st-text-tertiary)]">
        {label}
      </div>
      <div className="mt-1 text-[22px] tracking-[-0.01em] text-[var(--st-text)] leading-none">
        {value}
      </div>
      {hint ? (
        <div className="mt-1 truncate text-[11px] text-[var(--st-text-secondary)]">
          {hint}
        </div>
      ) : null}
    </div>
  );
}

/* ── page ────────────────────────────────────────────────────────── */

export default function PageRolesPage() {
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [blocked, setBlocked] = useState<BlockedRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, startTransition] = useTransition();
  const [projectId, setProjectId] = useState<string | null>(null);
  const [unblockTarget, setUnblockTarget] = useState<BlockedRow | null>(null);

  const fetchData = useCallback(() => {
    if (!projectId) return;
    startTransition(async () => {
      const [rolesRes, blockedRes] = await Promise.all([
        getPageRoles(projectId),
        getBlockedProfiles(projectId),
      ]);

      if (rolesRes.error) setError(rolesRes.error);
      else {
        setRoles((rolesRes.roles || []) as RoleRow[]);
        setError(null);
      }

      setBlocked((blockedRes.profiles || []) as BlockedRow[]);
    });
  }, [projectId]);

  useEffect(() => {
    setProjectId(localStorage.getItem("activeProjectId"));
  }, []);

  useEffect(() => {
    fetchData();
  }, [projectId, fetchData]);

  const roleColumns = useMemo<DataTableColumn<RoleRow>[]>(
    () => [
      {
        key: "name",
        header: "Name",
        render: (row) => (
          <span className="text-[13px] text-[var(--st-text)]">
            {row.name}
          </span>
        ),
      },
      {
        key: "role",
        header: "Role",
        render: (row) => (
          <Badge variant="secondary">{row.role}</Badge>
        ),
      },
    ],
    [],
  );

  const blockedColumns = useMemo<DataTableColumn<BlockedRow>[]>(
    () => [
      {
        key: "name",
        header: "Name",
        render: (row) => (
          <span className="text-[13px] text-[var(--st-text)]">
            {row.name || row.id}
          </span>
        ),
      },
      {
        key: "id",
        header: "Profile ID",
        render: (row) => (
          <span className="font-mono text-[11.5px] text-[var(--st-text-secondary)]">
            {row.id}
          </span>
        ),
      },
      {
        key: "actions",
        header: <span className="sr-only">Actions</span>,
        render: (row) => (
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setUnblockTarget(row)}
            >
              Unblock
            </Button>
          </div>
        ),
      },
    ],
    [],
  );

  if (isLoading && roles.length === 0 && blocked.length === 0 && projectId) {
    return <PageRolesSkeleton />;
  }

  return (
    <div className="mx-auto w-full max-w-[1320px] px-6 pt-6 pb-10">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard">SabNode</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard/facebook">
              Meta Suite
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Page roles</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <PageHeader className="mt-5" bordered={false}>
        <PageHeading>
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-[var(--st-text-tertiary)]">
            Page access control
          </p>
          <PageTitle>Page roles &amp; blocked profiles</PageTitle>
          <PageDescription>
            See who has admin / editor / moderator access to your Page and
            manage profiles that are blocked from interacting with it.
          </PageDescription>
        </PageHeading>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            disabled={!projectId}
          >
            <RefreshCw /> Refresh
          </Button>
          {projectId ? (
            <BlockProfileDialog
              projectId={projectId}
              onSuccess={fetchData}
            />
          ) : null}
        </div>
      </PageHeader>

      {!projectId ? (
        <div className="mt-6">
          <NoProjectState />
        </div>
      ) : error ? (
        <div className="mt-6">
          <Alert variant="destructive">
            <AlertCircle />
            <AlertTitle>Couldn’t load page roles</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </div>
      ) : (
        <>
          {/* ── Stats ── */}
          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatTile
              label="Roles assigned"
              value={String(roles.length)}
              hint="People with Page access"
              icon={<ShieldCheck />}
            />
            <StatTile
              label="Blocked profiles"
              value={String(blocked.length)}
              hint="Cannot comment or message"
              icon={<Ban />}
            />
            <StatTile
              label="Admins"
              value={String(
                roles.filter((r) =>
                  r.role?.toLowerCase().includes("admin"),
                ).length,
              )}
              hint="Full Page control"
              icon={<ShieldCheck />}
            />
          </div>

          {/* ── Tables ── */}
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {/* Roles */}
            <Card className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-[var(--st-text-tertiary)]">
                    Page roles
                  </p>
                  <p className="mt-1 text-[15px] text-[var(--st-text)]">
                    {roles.length} role{roles.length !== 1 ? "s" : ""} assigned
                  </p>
                </div>
                <Badge variant="outline">
                  <ShieldCheck className="h-3 w-3" />
                  Live
                </Badge>
              </div>

              <div className="mt-4">
                {roles.length === 0 ? (
                  <EmptyState
                    size="sm"
                    icon={<ShieldCheck />}
                    title="No roles found"
                    description="Add admins or editors from your Facebook Page settings."
                  />
                ) : (
                  <DataTable
                    columns={roleColumns}
                    rows={roles}
                    getRowId={(row, index) => row.id ?? `${row.name}-${index}`}
                  />
                )}
              </div>
            </Card>

            {/* Blocked */}
            <Card className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-[var(--st-text-tertiary)]">
                    Blocked profiles
                  </p>
                  <p className="mt-1 text-[15px] text-[var(--st-text)]">
                    {blocked.length} profile{blocked.length !== 1 ? "s" : ""}{" "}
                    blocked
                  </p>
                </div>
              </div>

              <div className="mt-4">
                {blocked.length === 0 ? (
                  <EmptyState
                    size="sm"
                    icon={<Ban />}
                    title="No blocked profiles"
                    description="Use “Block profile” above to restrict a Facebook profile."
                  />
                ) : (
                  <DataTable
                    columns={blockedColumns}
                    rows={blocked}
                    getRowId={(row) => row.id}
                  />
                )}
              </div>
            </Card>
          </div>
        </>
      )}

      {projectId ? (
        <UnblockProfileDialog
          open={!!unblockTarget}
          onOpenChange={(o) => {
            if (!o) setUnblockTarget(null);
          }}
          profileId={unblockTarget?.id || null}
          profileName={unblockTarget?.name || null}
          projectId={projectId}
          onUnblocked={fetchData}
        />
      ) : null}
    </div>
  );
}
