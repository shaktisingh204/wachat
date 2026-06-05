'use client';

import {
  Button,
  Input,
  Badge,
  EmptyState,
  Skeleton,
} from '@/components/sabcrm/20ui';
import {
  useEffect,
  useMemo,
  useState,
  useTransition } from 'react';
import Link from 'next/link';
import { useRouter,
  useSearchParams } from 'next/navigation';
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
import { SyncProjectsDialog } from '@/app/wachat/_components/sync-projects-dialog';
import { WachatPage } from '@/app/wachat/_components/wachat-page';

/**
 * /wachat — WhatsApp project picker, rebuilt on 20ui primitives.
 *
 * Same project data, same select handler, same recent/health logic.
 * Visual swap only — neutral palette, no clay-* utilities.
 */

import * as React from 'react';

function cx(...a: Array<string | false | null | undefined>): string {
  return a.filter(Boolean).join(' ');
}

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

  let tone: 'success' | 'warning' | 'danger' | 'neutral' = 'neutral';
  if (isGreen) tone = 'success';
  else if (isAmber) tone = 'warning';
  else if (isRed) tone = 'danger';

  return (
    <Badge tone={tone} dot className="text-[9.5px] uppercase tracking-wider">
      {status}
    </Badge>
  );
}

/* ── skeleton ──────────────────────────────────────────────────── */

function ProjectsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} height={120} />
      ))}
    </div>
  );
}

/* ── empty state ───────────────────────────────────────────────── */

function ProjectsEmptyState({
  query,
  reloadProjects,
}: {
  query: string;
  reloadProjects: () => Promise<void>;
}) {
  if (query) {
    return (
      <EmptyState
        icon={Search}
        title="No projects matched"
        description="Try a different search term or clear the filter."
      />
    );
  }

  return (
    <EmptyState
      icon={Sparkles}
      title="Connect your first project"
      description="Link your WhatsApp Business Account to start messaging, automating, and tracking performance."
      action={
        <div className="flex items-center gap-2.5">
          <Link href="/wachat/setup">
            <Button variant="primary" iconLeft={Plus}>
              Connect account
            </Button>
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
      className="u-card u-card--interactive u-card--pad-md group flex w-full items-center gap-4 text-left"
    >
      <div
        className={cx(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--st-radius)]',
          connected
            ? 'bg-[var(--st-surface-muted)] text-[var(--st-text)]'
            : 'bg-[var(--st-surface)] text-[var(--st-text-muted)]',
        )}
      >
        <MessageSquare className="h-4 w-4" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-[14px] text-[var(--st-text)]">
            {project.name || 'Untitled project'}
          </p>
          <HealthPill status={healthStatus} />
          {isRecent && (
            <Badge tone="neutral" className="text-[10px]">
              <Clock className="h-2.5 w-2.5" /> Recent
            </Badge>
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-[12px] text-[var(--st-text-muted)]">
          {connected ? (
            <>
              <Wifi className="h-3 w-3 [color:var(--st-success)]" />
              <span>{formatPhone(phone)}</span>
            </>
          ) : (
            <>
              <WifiOff className="h-3 w-3 [color:var(--st-text-light)]" />
              <span>Not connected</span>
            </>
          )}
          {project.groupName && (
            <>
              <span className="[color:var(--st-text-light)]">·</span>
              <span>{project.groupName}</span>
            </>
          )}
        </div>
      </div>

      <ArrowRight className="h-4 w-4 shrink-0 [color:var(--st-text-light)] transition group-hover:translate-x-0.5" />
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

  const projects = allProjects;

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
          if (!p.wabaId) return;
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
    const project = projects.find((p) => p._id.toString() === projectId);
    if (!project) return;

    if (!project.wabaId) {
      setActiveProjectId(projectId);
      router.push('/wachat/setup');
      return;
    }

    if (!project.phoneNumbers || project.phoneNumbers.length === 0) {
      setActiveProjectId(projectId);
      router.push('/wachat/numbers');
      return;
    }

    const updated = [
      projectId,
      ...recentIds.filter((id) => id !== projectId),
    ].slice(0, 8);
    localStorage.setItem('recentProjects', JSON.stringify(updated));
    setActiveProjectId(projectId);
    router.push('/wachat/overview');
  };

  return (
    <WachatPage
      width="wide"
      breadcrumb={[
        { label: 'SabNode', href: '/dashboard' },
        { label: 'WaChat', href: '/wachat' },
        { label: 'Projects' },
      ]}
      title="Your projects"
      description={`${projects.length} connected account${
        projects.length !== 1 ? 's' : ''
      } — select one to open.`}
      actions={
        <div className="flex items-center gap-2">
          <SyncProjectsDialog onSuccess={reloadProjects} />
          <Link href="/wachat/setup">
            <Button variant="primary" iconLeft={Plus}>
              Connect new
            </Button>
          </Link>
        </div>
      }
    >
      {projects.length > 0 && (
        <div className="flex items-center gap-2">
          <div className="max-w-md flex-1">
            <Input
              iconLeft={Search}
              placeholder="Search projects..."
              aria-label="Search projects"
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
          <p className="mb-2.5 text-[11px] uppercase tracking-[0.12em] text-[var(--st-text-muted)]">
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
            <p className="mb-2.5 text-[11px] uppercase tracking-[0.12em] text-[var(--st-text-muted)]">
              All projects
            </p>
          )}

        {isLoadingProject ? (
          <ProjectsSkeleton />
        ) : projects.length === 0 ? (
          <ProjectsEmptyState query={search} reloadProjects={reloadProjects} />
        ) : filtered.length === 0 ? (
          <ProjectsEmptyState query={search} reloadProjects={reloadProjects} />
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
        <div className="mt-6 flex items-center justify-between border-t border-[var(--st-border)] pt-4">
          <p className="text-[12px] tabular-nums text-[var(--st-text-muted)]">
            Page {page} of {totalPages} · {filtered.length} project
            {filtered.length !== 1 ? 's' : ''}
          </p>
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              aria-label="Previous page"
              iconLeft={ChevronLeft}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            />
            <Button
              variant="outline"
              size="sm"
              aria-label="Next page"
              iconLeft={ChevronRight}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            />
          </div>
        </div>
      )}
    </WachatPage>
  );
}
