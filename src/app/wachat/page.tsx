'use client';

/**
 * /dashboard — Wachat project selector built on Clay primitives.
 *
 * Lists all connected WhatsApp Business Account projects. Selecting
 * one sets it as the active project and navigates to the overview.
 * Uses the Clay design system and sits inside the Wachat sidebar.
 */

import * as React from 'react';
import { useEffect, useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  LuPlus,
  LuSearch,
  LuArrowRight,
  LuMessageSquare,
  LuClock,
  LuSparkles,
  LuRefreshCw,
  LuWifi,
  LuWifiOff,
  LuChevronLeft,
  LuChevronRight,
} from 'react-icons/lu';

import { cn } from '@/lib/utils';
import { useProject } from '@/context/project-context';
import { getWabaHealthStatus } from '@/app/actions/whatsapp.actions';
import { SyncProjectsDialog } from '@/components/wabasimplify/sync-projects-dialog';
import {
  ClayBreadcrumbs,
  ClayButton,
  ClayCard,
  ClayInput,
} from '@/components/clay';

/* ── helpers ───────────────────────────────────────────────────── */

function formatPhone(id?: string): string {
  if (!id) return '';
  const clean = id.replace(/\D/g, '');
  if (clean.length > 10) {
    return `+${clean.slice(0, clean.length - 10)} ${clean.slice(-10, -5)} ${clean.slice(-5)}`;
  }
  return id;
}

function HealthPill({ status }: { status?: string }) {
  if (!status) return null;
  const s = status.toLowerCase();
  const isGreen = s === 'available' || s === 'connected';
  const isAmber = s === 'limited' || s === 'flagged';
  const isRed = s === 'blocked' || s === 'restricted';

  return (
    <span className={cn(
      'inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wider leading-none',
      isGreen && 'bg-emerald-500/10 text-emerald-600',
      isAmber && 'bg-amber-500/10 text-amber-600',
      isRed && 'bg-red-500/10 text-red-600',
      !isGreen && !isAmber && !isRed && 'bg-muted text-muted-foreground',
    )}>
      <span className={cn(
        'h-1.5 w-1.5 rounded-full',
        isGreen && 'bg-emerald-500',
        isAmber && 'bg-amber-500',
        isRed && 'bg-red-500',
        !isGreen && !isAmber && !isRed && 'bg-muted-foreground',
      )} />
      {status}
    </span>
  );
}

/* ── skeleton ──────────────────────────────────────────────────── */

function ProjectsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="h-[120px] animate-pulse rounded-xl bg-muted"
        />
      ))}
    </div>
  );
}

/* ── empty state ───────────────────────────────────────────────── */

function EmptyState({ query, reloadProjects }: { query: string; reloadProjects: () => Promise<void> }) {
  if (query) {
    return (
      <ClayCard variant="soft" className="flex flex-col items-center gap-3 py-16 text-center">
        <LuSearch className="h-8 w-8 text-muted-foreground/40" strokeWidth={1.5} />
        <div>
          <p className="text-[15px] font-semibold text-foreground">No projects matched</p>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Try a different search term or clear the filter.
          </p>
        </div>
      </ClayCard>
    );
  }

  return (
    <ClayCard className="flex flex-col items-center gap-5 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
        <LuSparkles className="h-7 w-7 text-primary" strokeWidth={1.75} />
      </div>
      <div>
        <p className="text-[18px] font-semibold text-foreground">
          Connect your first project
        </p>
        <p className="mx-auto mt-1.5 max-w-sm text-[13px] text-muted-foreground leading-relaxed">
          Link your WhatsApp Business Account to start messaging, automating,
          and tracking performance.
        </p>
      </div>
      <div className="flex items-center gap-2.5">
        <Link href="/dashboard/setup">
          <ClayButton variant="obsidian" size="md">
            <LuPlus className="mr-1.5 h-3.5 w-3.5" />
            Connect account
          </ClayButton>
        </Link>
        <SyncProjectsDialog onSuccess={reloadProjects} />
      </div>
    </ClayCard>
  );
}

/* ── project card ──────────────────────────────────────────────── */

function ProjectRow({
  project,
  isRecent,
  onSelect,
  healthStatus,
}: {
  project: any;
  isRecent?: boolean;
  onSelect: (id: string) => void;
  healthStatus?: string;
}) {
  const connected = !!project.wabaId;
  const phone = project.phoneNumbers?.[0]?.display_phone_number || project.wabaId;

  return (
    <button
      type="button"
      onClick={() => onSelect(project._id.toString())}
      className={cn(
        'group flex items-center gap-4 rounded-xl border border-border bg-card p-4 text-left transition',
        'hover:border-primary/40 hover:shadow-sm',
      )}
    >
      {/* Icon */}
      <div
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
          connected
            ? 'bg-emerald-50 text-emerald-600'
            : 'bg-muted text-muted-foreground',
        )}
      >
        <LuMessageSquare className="h-4.5 w-4.5" strokeWidth={2} />
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-[14px] font-semibold text-foreground">
            {project.name || 'Untitled project'}
          </p>
          <HealthPill status={healthStatus} />
          {isRecent && (
            <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
              <LuClock className="h-2.5 w-2.5" /> Recent
            </span>
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-[12px] text-muted-foreground">
          {connected ? (
            <>
              <LuWifi className="h-3 w-3 text-emerald-500" />
              <span>{formatPhone(phone)}</span>
            </>
          ) : (
            <>
              <LuWifiOff className="h-3 w-3 text-muted-foreground/50" />
              <span>Not connected</span>
            </>
          )}
          {project.groupName && (
            <>
              <span className="text-muted-foreground/30">·</span>
              <span>{project.groupName}</span>
            </>
          )}
        </div>
      </div>

      {/* Arrow */}
      <LuArrowRight className="h-4 w-4 shrink-0 text-muted-foreground/40 transition group-hover:translate-x-0.5 group-hover:text-primary" />
    </button>
  );
}

/* ── page ───────────────────────────────────────────────────────── */

const PAGE_SIZE = 24;

export default function SelectProjectPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { projects: allProjects, reloadProjects, isLoadingProject, setActiveProjectId } = useProject();
  const [, startHealthTransition] = useTransition();

  const projects = useMemo(() => allProjects.filter((p) => !!p.wabaId), [allProjects]);

  const [search, setSearch] = useState(searchParams.get('query') || '');
  const [page, setPage] = useState(1);

  // Health status map: projectId → can_send_message status
  const [healthMap, setHealthMap] = useState<Record<string, string>>({});

  // Recent projects from localStorage
  const [recentIds, setRecentIds] = useState<string[]>([]);
  useEffect(() => {
    try {
      const raw = localStorage.getItem('recentProjects');
      if (raw) setRecentIds(JSON.parse(raw));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    document.title = 'Projects · Wachat';
  }, []);

  // Fetch health status for all projects in background
  useEffect(() => {
    if (projects.length === 0) return;
    startHealthTransition(async () => {
      const results: Record<string, string> = {};
      await Promise.allSettled(
        projects.map(async (p) => {
          try {
            const { healthStatus } = await getWabaHealthStatus(p._id.toString());
            if (healthStatus?.can_send_message) {
              results[p._id.toString()] = healthStatus.can_send_message;
            }
          } catch { /* ignore */ }
        })
      );
      setHealthMap(results);
    });
  }, [projects]);

  const recentProjects = useMemo(
    () => projects.filter((p) => recentIds.includes(p._id.toString())).slice(0, 4),
    [projects, recentIds],
  );

  const filtered = useMemo(() => {
    if (!search.trim()) return projects;
    const q = search.toLowerCase();
    return projects.filter(
      (p) =>
        p.name?.toLowerCase().includes(q) ||
        p.wabaId?.toLowerCase().includes(q) ||
        p.phoneNumbers?.[0]?.display_phone_number?.toLowerCase().includes(q),
    );
  }, [projects, search]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = useMemo(
    () => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filtered, page],
  );

  const handleSelect = (projectId: string) => {
    // Save to recent
    const updated = [projectId, ...recentIds.filter((id) => id !== projectId)].slice(0, 8);
    localStorage.setItem('recentProjects', JSON.stringify(updated));
    setActiveProjectId(projectId);
    router.push('/dashboard/overview');
  };

  return (
    <>
      {/* Breadcrumbs */}
      <ClayBreadcrumbs
        items={[
          { label: 'SabNode', href: '/home' },
          { label: 'Wachat' },
          { label: 'Projects' },
        ]}
      />

      {/* Header */}
      <div className="mt-5 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[26px] font-semibold tracking-[-0.015em] text-foreground leading-[1.15]">
            Your projects
          </h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {projects.length} connected account{projects.length !== 1 ? 's' : ''} — select one to open.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SyncProjectsDialog onSuccess={reloadProjects} />
          <Link href="/dashboard/setup">
            <ClayButton variant="obsidian" size="md">
              <LuPlus className="mr-1.5 h-3.5 w-3.5" />
              Connect new
            </ClayButton>
          </Link>
        </div>
      </div>

      {/* Search bar */}
      {projects.length > 0 && (
        <div className="mt-5 flex items-center gap-2">
          <div className="relative flex-1 max-w-md">
            <LuSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50" />
            <ClayInput
              placeholder="Search projects..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="pl-9"
            />
          </div>
        </div>
      )}

      {/* Recent projects */}
      {recentProjects.length > 0 && !search && (
        <div className="mt-6">
          <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Recently accessed
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {recentProjects.map((p) => (
              <ProjectRow
                key={p._id.toString()}
                project={p}
                isRecent
                onSelect={handleSelect}
                healthStatus={healthMap[p._id.toString()]}
              />
            ))}
          </div>
        </div>
      )}

      {/* All projects */}
      <div className="mt-6">
        {recentProjects.length > 0 && !search && projects.length > recentProjects.length && (
          <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            All projects
          </p>
        )}

        {isLoadingProject ? (
          <ProjectsSkeleton />
        ) : projects.length === 0 ? (
          <EmptyState query={search} reloadProjects={reloadProjects} />
        ) : filtered.length === 0 ? (
          <EmptyState query={search} reloadProjects={reloadProjects} />
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {paginated.map((p) => (
              <ProjectRow
                key={p._id.toString()}
                project={p}
                onSelect={handleSelect}
                healthStatus={healthMap[p._id.toString()]}
              />
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
          <p className="text-[12px] text-muted-foreground tabular-nums">
            Page {page} of {totalPages} · {filtered.length} project{filtered.length !== 1 ? 's' : ''}
          </p>
          <div className="flex items-center gap-1.5">
            <ClayButton
              variant="pill"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              <LuChevronLeft className="h-3.5 w-3.5" />
            </ClayButton>
            <ClayButton
              variant="pill"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              <LuChevronRight className="h-3.5 w-3.5" />
            </ClayButton>
          </div>
        </div>
      )}
    </>
  );
}
