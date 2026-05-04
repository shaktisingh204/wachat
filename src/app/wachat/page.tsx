'use client';

/**
 * /wachat — WhatsApp project picker, rebuilt on ZoruUI primitives.
 *
 * Same project data, same select handler, same recent/health logic.
 * Visual swap only — neutral palette, no clay-* utilities.
 */

import * as React from 'react';
import { useEffect, useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Plus,
  Search,
  ArrowRight,
  MessageSquare,
  Clock,
  Sparkles,
  Wifi,
  WifiOff,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

import { useProject } from '@/context/project-context';
import { getWabaHealthStatus } from '@/app/actions/whatsapp.actions';
import { SyncProjectsDialog } from '@/components/wabasimplify/sync-projects-dialog';

import {
  ZoruBreadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  ZoruButton,
  ZoruCard,
  ZoruInput,
  ZoruBadge,
  ZoruEmptyState,
  ZoruSkeleton,
  cn,
} from '@/components/zoruui';

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

  let variant: 'success' | 'warning' | 'danger' | 'ghost' = 'ghost';
  if (isGreen) variant = 'success';
  else if (isAmber) variant = 'warning';
  else if (isRed) variant = 'danger';

  return (
    <ZoruBadge variant={variant} className="text-[9.5px] uppercase tracking-wider">
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          isGreen && 'bg-zoru-success',
          isAmber && 'bg-zoru-warning',
          isRed && 'bg-zoru-danger',
          !isGreen && !isAmber && !isRed && 'bg-zoru-ink-muted',
        )}
      />
      {status}
    </ZoruBadge>
  );
}

/* ── skeleton ──────────────────────────────────────────────────── */

function ProjectsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <ZoruSkeleton key={i} className="h-[120px]" />
      ))}
    </div>
  );
}

/* ── empty state ───────────────────────────────────────────────── */

function EmptyState({
  query,
  reloadProjects,
}: {
  query: string;
  reloadProjects: () => Promise<void>;
}) {
  if (query) {
    return (
      <ZoruEmptyState
        icon={<Search />}
        title="No projects matched"
        description="Try a different search term or clear the filter."
      />
    );
  }

  return (
    <ZoruEmptyState
      icon={<Sparkles />}
      title="Connect your first project"
      description="Link your WhatsApp Business Account to start messaging, automating, and tracking performance."
      action={
        <div className="flex items-center gap-2.5">
          <Link href="/dashboard/setup">
            <ZoruButton size="md">
              <Plus />
              Connect account
            </ZoruButton>
          </Link>
          <SyncProjectsDialog onSuccess={reloadProjects} />
        </div>
      }
    />
  );
}

/* ── project row ───────────────────────────────────────────────── */

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
        'group flex items-center gap-4 rounded-[var(--zoru-radius-lg)] border border-zoru-line bg-zoru-bg p-4 text-left transition',
        'hover:border-zoru-line-strong hover:shadow-[var(--zoru-shadow-sm)]',
      )}
    >
      <div
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--zoru-radius)]',
          connected ? 'bg-zoru-surface-2 text-zoru-ink' : 'bg-zoru-surface text-zoru-ink-muted',
        )}
      >
        <MessageSquare className="h-4 w-4" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-[14px] text-zoru-ink">
            {project.name || 'Untitled project'}
          </p>
          <HealthPill status={healthStatus} />
          {isRecent && (
            <ZoruBadge variant="ghost" className="text-[10px]">
              <Clock className="h-2.5 w-2.5" /> Recent
            </ZoruBadge>
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-[12px] text-zoru-ink-muted">
          {connected ? (
            <>
              <Wifi className="h-3 w-3 text-zoru-success" />
              <span>{formatPhone(phone)}</span>
            </>
          ) : (
            <>
              <WifiOff className="h-3 w-3 text-zoru-ink-subtle" />
              <span>Not connected</span>
            </>
          )}
          {project.groupName && (
            <>
              <span className="text-zoru-ink-subtle">·</span>
              <span>{project.groupName}</span>
            </>
          )}
        </div>
      </div>

      <ArrowRight className="h-4 w-4 shrink-0 text-zoru-ink-subtle transition group-hover:translate-x-0.5 group-hover:text-zoru-ink" />
    </button>
  );
}

/* ── page ──────────────────────────────────────────────────────── */

const PAGE_SIZE = 24;

export default function SelectProjectPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const {
    projects: allProjects,
    reloadProjects,
    isLoadingProject,
    setActiveProjectId,
  } = useProject();
  const [, startHealthTransition] = useTransition();

  const projects = useMemo(
    () => allProjects.filter((p) => !!p.wabaId),
    [allProjects],
  );

  const [search, setSearch] = useState(searchParams.get('query') || '');
  const [page, setPage] = useState(1);

  const [healthMap, setHealthMap] = useState<Record<string, string>>({});

  const [recentIds, setRecentIds] = useState<string[]>([]);
  useEffect(() => {
    try {
      const raw = localStorage.getItem('recentProjects');
      if (raw) setRecentIds(JSON.parse(raw));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    document.title = 'Projects · Wachat';
  }, []);

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
          } catch {
            /* ignore */
          }
        }),
      );
      setHealthMap(results);
    });
  }, [projects]);

  const recentProjects = useMemo(
    () =>
      projects
        .filter((p) => recentIds.includes(p._id.toString()))
        .slice(0, 4),
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
    const updated = [
      projectId,
      ...recentIds.filter((id) => id !== projectId),
    ].slice(0, 8);
    localStorage.setItem('recentProjects', JSON.stringify(updated));
    setActiveProjectId(projectId);
    router.push('/dashboard/overview');
  };

  return (
    <div className="mx-auto w-full max-w-[1320px] px-6 pt-6 pb-10">
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
            <ZoruBreadcrumbPage>Projects</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </ZoruBreadcrumb>

      <div className="mt-5 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[26px] tracking-[-0.015em] text-zoru-ink leading-[1.15]">
            Your projects
          </h1>
          <p className="mt-1 text-[13px] text-zoru-ink-muted">
            {projects.length} connected account
            {projects.length !== 1 ? 's' : ''} — select one to open.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SyncProjectsDialog onSuccess={reloadProjects} />
          <Link href="/dashboard/setup">
            <ZoruButton size="md">
              <Plus />
              Connect new
            </ZoruButton>
          </Link>
        </div>
      </div>

      {projects.length > 0 && (
        <div className="mt-5 flex items-center gap-2">
          <div className="max-w-md flex-1">
            <ZoruInput
              leadingSlot={<Search />}
              placeholder="Search projects..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>
      )}

      {recentProjects.length > 0 && !search && (
        <div className="mt-6">
          <p className="mb-2.5 text-[11px] uppercase tracking-[0.12em] text-zoru-ink-muted">
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

      <div className="mt-6">
        {recentProjects.length > 0 &&
          !search &&
          projects.length > recentProjects.length && (
            <p className="mb-2.5 text-[11px] uppercase tracking-[0.12em] text-zoru-ink-muted">
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

      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between border-t border-zoru-line pt-4">
          <p className="text-[12px] text-zoru-ink-muted tabular-nums">
            Page {page} of {totalPages} · {filtered.length} project
            {filtered.length !== 1 ? 's' : ''}
          </p>
          <div className="flex items-center gap-1.5">
            <ZoruButton
              variant="outline"
              size="icon-sm"
              aria-label="Previous page"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              <ChevronLeft />
            </ZoruButton>
            <ZoruButton
              variant="outline"
              size="icon-sm"
              aria-label="Next page"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              <ChevronRight />
            </ZoruButton>
          </div>
        </div>
      )}
    </div>
  );
}
