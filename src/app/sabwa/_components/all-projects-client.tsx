'use client';

/**
 * AllProjectsClient — `/sabwa` landing.
 *
 * Built on ZoruUI primitives. Drives the three-step SabWa onboarding
 * flow visible at the top of the page:
 *
 *   1. Create a project   (inline dialog — dedicated SabWa workspace)
 *   2. Select a project   (filtered to `kind === 'sabwa'`)
 *   3. Connect WhatsApp   (➜ /sabwa/connect once a project is active)
 *
 * SabWa projects are kept **distinct** from WaChat / Meta / CRM /
 * Telegram workspaces — the picker only shows projects flagged
 * `kind: 'sabwa'`, mirroring the Telegram pattern.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  Briefcase,
  Check,
  ChevronRight,
  Loader2,
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
import { addSabwaProject } from '@/app/actions/sabwa.actions';
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
  ZoruDialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruEmptyState,
  ZoruInput,
  ZoruLabel,
  cn,
  useZoruToast,
} from '@/components/zoruui';

export interface AllProjectsBootstrap {
  projects: Array<{
    id: string;
    name: string;
    groupName: string | null;
    wabaId: string | null;
    facebookPageId: string | null;
    kind: string | null;
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
          state === 'idle' &&
            'border border-zoru-line-strong text-zoru-ink-muted',
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
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--zoru-radius)] bg-zoru-surface text-zoru-ink">
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
          <ZoruBadge variant="ghost" className="text-[10px]">
            SabWa workspace
          </ZoruBadge>
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-[12px] text-zoru-ink-muted">
          {project.phoneNumber ? (
            <>
              <Wifi className="h-3 w-3 text-zoru-success" />
              <span>{project.phoneNumber}</span>
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

/* ── create-project dialog ─────────────────────────────────────── */

function CreateSabwaProjectDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  onCreated: (projectId: string, name: string) => void;
}) {
  const toast = useZoruToast();
  const [name, setName] = React.useState('');
  const [pending, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (!open) setName('');
  }, [open]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      toast.toast({
        title: 'Name your SabWa project',
        description: 'Give this workspace a short identifier.',
        variant: 'destructive',
      });
      return;
    }
    startTransition(async () => {
      const res = await addSabwaProject({ name: trimmed });
      if (!res.ok) {
        toast.toast({
          title: 'Could not create project',
          description: res.error,
          variant: 'destructive',
        });
        return;
      }
      toast.toast({
        title: 'SabWa project created',
        description: `“${res.name}” is ready to link.`,
      });
      onCreated(res.projectId, res.name);
      onOpenChange(false);
    });
  };

  return (
    <ZoruDialog open={open} onOpenChange={onOpenChange}>
      <ZoruDialogContent>
        <ZoruDialogHeader>
          <ZoruDialogTitle>Create a SabWa project</ZoruDialogTitle>
          <ZoruDialogDescription>
            SabWa workspaces are kept separate from WaChat, Meta, and CRM
            projects. This one will only show up under SabWa.
          </ZoruDialogDescription>
        </ZoruDialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <ZoruLabel htmlFor="sabwa-new-project-name">
              Project name
            </ZoruLabel>
            <ZoruInput
              id="sabwa-new-project-name"
              autoFocus
              maxLength={120}
              placeholder="e.g. Personal — Family group, Outreach, Field team"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <p className="text-[11.5px] text-zoru-ink-muted">
              You can rename or delete this later from the workspace settings.
            </p>
          </div>
          <ZoruDialogFooter>
            <ZoruButton
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Cancel
            </ZoruButton>
            <ZoruButton type="submit" disabled={pending || !name.trim()}>
              {pending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus />
              )}
              Create project
            </ZoruButton>
          </ZoruDialogFooter>
        </form>
      </ZoruDialogContent>
    </ZoruDialog>
  );
}

/* ── page ──────────────────────────────────────────────────────── */

export function AllProjectsClient({ bootstrap }: AllProjectsClientProps) {
  const router = useRouter();
  const { activeProjectId, setActiveProjectId, reloadProjects } = useProject();

  // Filter to SabWa-only workspaces. A project is a SabWa workspace if:
  //   - its `kind === 'sabwa'` (created from /sabwa), OR
  //   - it has no other module signature (no wabaId, no facebookPageId,
  //     no other `kind`) AND is otherwise empty — covers legacy projects
  //     that haven't picked up the flag yet. Strict by default.
  const sabwaProjects = React.useMemo(() => {
    return bootstrap.projects.filter((p) => p.kind === 'sabwa');
  }, [bootstrap.projects]);

  const [search, setSearch] = React.useState('');
  const [createOpen, setCreateOpen] = React.useState(false);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sabwaProjects;
    return sabwaProjects.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.phoneNumber ?? '').toLowerCase().includes(q),
    );
  }, [sabwaProjects, search]);

  const flowStep: FlowStep =
    sabwaProjects.length === 0
      ? 'create'
      : !activeProjectId ||
          !sabwaProjects.some((p) => p.id === activeProjectId)
        ? 'select'
        : 'connect';

  const handleSelect = (projectId: string) => {
    setActiveProjectId(projectId);
  };

  const handleContinue = () => {
    if (!activeProjectId) return;
    router.push('/sabwa/connect');
  };

  const handleCreated = async (projectId: string, _name: string) => {
    await reloadProjects();
    setActiveProjectId(projectId);
    // Don't auto-redirect — let the user see their new project in the
    // picker, then click Continue. (Matches the 3-step flow narrative.)
    router.refresh();
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
            Pick a SabWa workspace
          </h1>
          <p className="mt-1 text-[13px] text-zoru-ink-muted">
            SabWa workspaces are <strong>separate</strong> from WaChat,
            Meta, CRM, and Telegram projects — they only show up here.
            Create a dedicated workspace for each WhatsApp account you want
            to link.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ZoruButton
            variant="outline"
            size="md"
            onClick={() => setCreateOpen(true)}
          >
            <Plus />
            New SabWa project
          </ZoruButton>
          <ZoruButton
            size="md"
            onClick={handleContinue}
            disabled={!activeProjectId || flowStep !== 'connect'}
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
              <p className="text-[14px] text-zoru-ink">
                Create a SabWa workspace
              </p>
              <p className="mt-1 text-[12.5px] text-zoru-ink-muted">
                Each SabWa workspace owns one WhatsApp number and its
                contacts / broadcasts / audit trail. Kept independent from
                your WaChat and Meta projects.
              </p>
              <ZoruButton
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => setCreateOpen(true)}
              >
                Create project
                <ChevronRight />
              </ZoruButton>
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
                Once a SabWa workspace is selected, link your number with a
                refreshing QR code or an 8-character pair code.
              </p>
              <ZoruButton
                size="sm"
                className="mt-3"
                disabled={!activeProjectId || flowStep !== 'connect'}
                onClick={handleContinue}
                variant={
                  activeProjectId && flowStep === 'connect'
                    ? 'default'
                    : 'outline'
                }
              >
                <Smartphone />
                Link a number
              </ZoruButton>
            </div>
          </div>
        </ZoruCard>
      </div>

      {/* Project picker */}
      <div className="mt-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.12em] text-zoru-ink-muted">
              Step 2 — Select a SabWa workspace
            </p>
            <h2 className="mt-1 text-[18px] text-zoru-ink">
              Your SabWa workspaces
            </h2>
          </div>
          {sabwaProjects.length > 0 && (
            <div className="w-full max-w-xs">
              <ZoruInput
                leadingSlot={<Search />}
                placeholder="Search SabWa workspaces..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          )}
        </div>

        <div className="mt-4">
          {sabwaProjects.length === 0 ? (
            <ZoruEmptyState
              icon={<Sparkles />}
              title="No SabWa workspaces yet"
              description="SabWa keeps its workspaces separate from your WaChat and Meta projects. Create the first one to link a personal WhatsApp number."
              action={
                <ZoruButton size="md" onClick={() => setCreateOpen(true)}>
                  <Plus />
                  Create SabWa workspace
                </ZoruButton>
              }
            />
          ) : filtered.length === 0 ? (
            <ZoruEmptyState
              icon={<Search />}
              title="No workspaces matched"
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

      <CreateSabwaProjectDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={handleCreated}
      />
    </div>
  );
}

export default AllProjectsClient;
