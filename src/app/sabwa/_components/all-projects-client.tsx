'use client';

/**
 * AllProjectsClient — `/sabwa` landing.
 *
 * Built on ZoruUI primitives. Drives the three-step SabWa onboarding
 * flow visible at the top of the page:
 *
 *   1. Create a project   (➜ /onboarding or inline create)
 *   2. Select a project   (current selection in the picker below)
 *   3. Connect WhatsApp   (➜ /sabwa/connect once a project is active)
 *
 * Once a session is paired the user lands on `/sabwa/overview`.
 */

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  Briefcase,
  Check,
  ChevronRight,
  MessageSquare,
  Plus,
  QrCode,
  Search,
  Smartphone,
  Sparkles,
  Wifi,
  WifiOff,
} from 'lucide-react';

import { useProject } from '@/context/project-context';
import {
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
  ZoruInput,
  cn,
} from '@/components/zoruui';

export interface AllProjectsBootstrap {
  projects: Array<{
    id: string;
    name: string;
    groupName: string | null;
    wabaId: string | null;
    phoneNumber: string | null;
  }>;
}

export interface AllProjectsClientProps {
  bootstrap: AllProjectsBootstrap;
}

type FlowStep = 'create' | 'select' | 'connect';

function StepPill({
  index,
  label,
  state,
}: {
  index: number;
  label: string;
  state: 'done' | 'active' | 'idle';
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-[var(--zoru-radius)] border px-3 py-2 text-[12.5px]',
        state === 'done' &&
          'border-zoru-line bg-zoru-surface text-zoru-ink',
        state === 'active' &&
          'border-zoru-ink bg-zoru-ink text-zoru-on-primary',
        state === 'idle' &&
          'border-zoru-line bg-zoru-bg text-zoru-ink-muted',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10.5px] font-semibold',
          state === 'done' && 'bg-zoru-ink text-zoru-on-primary',
          state === 'active' && 'bg-zoru-on-primary text-zoru-ink',
          state === 'idle' && 'border border-zoru-line-strong text-zoru-ink-muted',
        )}
      >
        {state === 'done' ? <Check className="h-3 w-3" /> : index}
      </span>
      <span className="truncate">{label}</span>
    </div>
  );
}

function FlowStepper({ activeStep }: { activeStep: FlowStep }) {
  const order: FlowStep[] = ['create', 'select', 'connect'];
  const activeIdx = order.indexOf(activeStep);

  const labels: Record<FlowStep, string> = {
    create: 'Create a project',
    select: 'Select a project',
    connect: 'Connect WhatsApp',
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {order.map((s, i) => {
        const state: 'done' | 'active' | 'idle' =
          i < activeIdx ? 'done' : i === activeIdx ? 'active' : 'idle';
        return (
          <React.Fragment key={s}>
            <StepPill index={i + 1} label={labels[s]} state={state} />
            {i < order.length - 1 && (
              <ChevronRight className="h-3.5 w-3.5 text-zoru-ink-subtle" />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function ProjectRow({
  project,
  active,
  onSelect,
}: {
  project: AllProjectsBootstrap['projects'][number];
  active: boolean;
  onSelect: (id: string) => void;
}) {
  const connected = !!project.wabaId;
  return (
    <button
      type="button"
      onClick={() => onSelect(project.id)}
      className={cn(
        'group flex w-full items-center gap-4 rounded-[var(--zoru-radius-lg)] border p-4 text-left transition',
        active
          ? 'border-zoru-ink bg-zoru-surface shadow-[var(--zoru-shadow-sm)]'
          : 'border-zoru-line bg-zoru-bg hover:border-zoru-line-strong hover:shadow-[var(--zoru-shadow-sm)]',
      )}
    >
      <div
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--zoru-radius)]',
          connected
            ? 'bg-zoru-surface-2 text-zoru-ink'
            : 'bg-zoru-surface text-zoru-ink-muted',
        )}
      >
        <MessageSquare className="h-4 w-4" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-[14px] text-zoru-ink">{project.name}</p>
          {active && (
            <ZoruBadge variant="default" className="text-[10px]">
              Active
            </ZoruBadge>
          )}
          {connected && (
            <ZoruBadge variant="success" className="text-[10px]">
              WaChat linked
            </ZoruBadge>
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-[12px] text-zoru-ink-muted">
          {connected ? (
            <>
              <Wifi className="h-3 w-3 text-zoru-success" />
              <span>{project.phoneNumber ?? project.wabaId}</span>
            </>
          ) : (
            <>
              <WifiOff className="h-3 w-3 text-zoru-ink-subtle" />
              <span>No WhatsApp linked yet</span>
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

      <ChevronRight className="h-4 w-4 shrink-0 text-zoru-ink-subtle transition group-hover:translate-x-0.5 group-hover:text-zoru-ink" />
    </button>
  );
}

export function AllProjectsClient({ bootstrap }: AllProjectsClientProps) {
  const router = useRouter();
  const { activeProjectId, setActiveProjectId } = useProject();

  const [search, setSearch] = React.useState('');

  const projects = bootstrap.projects;

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.phoneNumber ?? '').toLowerCase().includes(q) ||
        (p.wabaId ?? '').toLowerCase().includes(q),
    );
  }, [projects, search]);

  const flowStep: FlowStep =
    projects.length === 0
      ? 'create'
      : !activeProjectId
        ? 'select'
        : 'connect';

  const handleSelect = (projectId: string) => {
    setActiveProjectId(projectId);
  };

  const handleContinue = () => {
    if (!activeProjectId) return;
    router.push('/sabwa/connect');
  };

  return (
    <div className="mx-auto w-full max-w-[1280px] px-6 pt-6 pb-10">
      <ZoruBreadcrumb>
        <ZoruBreadcrumbList>
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard">SabNode</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbPage>SabWa</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </ZoruBreadcrumb>

      <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-[0.12em] text-zoru-ink-muted">
            SabWa — Personal WhatsApp
          </p>
          <h1 className="mt-1 text-[26px] leading-[1.15] tracking-[-0.015em] text-zoru-ink">
            Pick a project to link
          </h1>
          <p className="mt-1 text-[13px] text-zoru-ink-muted">
            SabWa attaches a personal WhatsApp number to a SabNode project. Pick
            an existing project below, or create a new one to keep this account
            separate.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/onboarding">
            <ZoruButton variant="outline" size="md">
              <Plus />
              New project
            </ZoruButton>
          </Link>
          <ZoruButton
            size="md"
            onClick={handleContinue}
            disabled={!activeProjectId}
          >
            Continue to connect
            <ArrowRight />
          </ZoruButton>
        </div>
      </div>

      {/* 3-step flow stepper */}
      <div className="mt-6">
        <FlowStepper activeStep={flowStep} />
      </div>

      {/* Quick-action cards: Create + Connect */}
      <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2">
        <ZoruCard className="p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--zoru-radius)] bg-zoru-surface text-zoru-ink">
              <Briefcase className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] text-zoru-ink">Create a project</p>
              <p className="mt-1 text-[12.5px] text-zoru-ink-muted">
                Use a dedicated workspace for this WhatsApp account. Helps keep
                contacts, broadcasts, and audit trails isolated.
              </p>
              <Link href="/onboarding" className="mt-3 inline-flex">
                <ZoruButton variant="outline" size="sm">
                  Start onboarding
                  <ChevronRight />
                </ZoruButton>
              </Link>
            </div>
          </div>
        </ZoruCard>

        <ZoruCard className="p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--zoru-radius)] bg-zoru-surface text-zoru-ink">
              <QrCode className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] text-zoru-ink">Connect WhatsApp</p>
              <p className="mt-1 text-[12.5px] text-zoru-ink-muted">
                Once a project is selected, link your number with a refreshing
                QR code or an 8-character pair code.
              </p>
              <Link
                href={activeProjectId ? '/sabwa/connect' : '#'}
                aria-disabled={!activeProjectId}
                className={cn('mt-3 inline-flex', !activeProjectId && 'pointer-events-none')}
              >
                <ZoruButton
                  size="sm"
                  disabled={!activeProjectId}
                  variant={activeProjectId ? 'default' : 'outline'}
                >
                  <Smartphone />
                  Link a number
                </ZoruButton>
              </Link>
            </div>
          </div>
        </ZoruCard>
      </div>

      {/* Project picker */}
      <div className="mt-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.12em] text-zoru-ink-muted">
              Step 2 — Select a project
            </p>
            <h2 className="mt-1 text-[18px] text-zoru-ink">Your projects</h2>
          </div>
          {projects.length > 0 && (
            <div className="w-full max-w-xs">
              <ZoruInput
                leadingSlot={<Search />}
                placeholder="Search projects..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          )}
        </div>

        <div className="mt-4">
          {projects.length === 0 ? (
            <ZoruEmptyState
              icon={<Sparkles />}
              title="No projects yet"
              description="Create a SabNode project first — it owns the contacts, broadcasts, and audit log for this WhatsApp account."
              action={
                <Link href="/onboarding">
                  <ZoruButton size="md">
                    <Plus />
                    Start onboarding
                  </ZoruButton>
                </Link>
              }
            />
          ) : filtered.length === 0 ? (
            <ZoruEmptyState
              icon={<Search />}
              title="No projects matched"
              description="Try a different search term or clear the filter."
            />
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((p) => (
                <ProjectRow
                  key={p.id}
                  project={p}
                  active={p.id === activeProjectId}
                  onSelect={handleSelect}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default AllProjectsClient;
