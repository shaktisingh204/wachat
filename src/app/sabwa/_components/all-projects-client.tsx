'use client';

import {
  Badge,
  Breadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  Button,
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  EmptyState,
  Input,
  Label,
  cn,
  useZoruToast,
} from '@/components/zoruui';
import {
  useRouter } from 'next/navigation';
import { ChevronRight,
  Loader2,
  MessageSquare,
  Plus,
  Search,
  Sparkles } from 'lucide-react';

import { useProject } from '@/context/project-context';
import { addSabwaProject } from '@/app/actions/sabwa.actions';

/**
 * AllProjectsClient — `/sabwa` clean projects landing.
 *
 * Just two things:
 *   1. List of SabWa workspaces (filtered to `kind === 'sabwa'`).
 *   2. "New SabWa project" button → inline create dialog.
 *
 * Clicking a workspace activates it and navigates to /sabwa/overview,
 * which is the accounts hub (linked WhatsApp numbers + connect-more
 * CTA + active-session picker). The legal/connect details all live on
 * that page.
 */

import * as React from 'react';

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

/* ── create-project dialog ─────────────────────────────────────── */

function CreateSabwaProjectDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  onCreated: (projectId: string) => void;
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
    if (!trimmed) return;
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
        description: `“${res.name}” is ready.`,
      });
      onCreated(res.projectId);
      onOpenChange(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ZoruDialogContent>
        <ZoruDialogHeader>
          <ZoruDialogTitle>New SabWa project</ZoruDialogTitle>
          <ZoruDialogDescription>
            A dedicated workspace for one or more WhatsApp accounts. Stays
            separate from your WaChat, Meta, and CRM projects.
          </ZoruDialogDescription>
        </ZoruDialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="sabwa-new-project-name">Name</Label>
            <Input
              id="sabwa-new-project-name"
              autoFocus
              maxLength={120}
              placeholder="e.g. Personal, Field team, Outreach"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <ZoruDialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending || !name.trim()}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus />}
              Create
            </Button>
          </ZoruDialogFooter>
        </form>
      </ZoruDialogContent>
    </Dialog>
  );
}

/* ── project row ───────────────────────────────────────────────── */

function ProjectRow({
  project,
  onOpen,
}: {
  project: AllProjectsBootstrap['projects'][number];
  onOpen: (id: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(project.id)}
      className={cn(
        'group flex w-full items-center gap-4 rounded-[var(--zoru-radius-lg)] border border-zoru-line bg-zoru-bg p-4 text-left transition',
        'hover:border-zoru-line-strong hover:shadow-[var(--zoru-shadow-sm)]',
      )}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--zoru-radius)] bg-zoru-surface text-zoru-ink">
        <MessageSquare className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] text-zoru-ink">{project.name}</p>
        <p className="mt-0.5 truncate text-[12px] text-zoru-ink-muted">
          SabWa workspace
          {project.groupName ? ` · ${project.groupName}` : ''}
        </p>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-zoru-ink-subtle transition group-hover:translate-x-0.5 group-hover:text-zoru-ink" />
    </button>
  );
}

/* ── page ──────────────────────────────────────────────────────── */

export function AllProjectsClient({ bootstrap }: AllProjectsClientProps) {
  const router = useRouter();
  const { setActiveProjectId, reloadProjects } = useProject();

  const sabwaProjects = React.useMemo(
    () => bootstrap.projects.filter((p) => p.kind === 'sabwa'),
    [bootstrap.projects],
  );

  const [search, setSearch] = React.useState('');
  const [createOpen, setCreateOpen] = React.useState(false);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sabwaProjects;
    return sabwaProjects.filter((p) => p.name.toLowerCase().includes(q));
  }, [sabwaProjects, search]);

  const openProject = (id: string) => {
    setActiveProjectId(id);
    router.push('/sabwa/overview');
  };

  const handleCreated = async (id: string) => {
    await reloadProjects();
    openProject(id);
  };

  return (
    <div className="mx-auto w-full max-w-[1180px] px-4 pt-6 pb-10 sm:px-6">
      <Breadcrumb>
        <ZoruBreadcrumbList>
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard">SabNode</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbPage>SabWa</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </Breadcrumb>

      <div className="mt-5 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[26px] leading-[1.15] tracking-[-0.015em] text-zoru-ink">
            Your SabWa projects
          </h1>
          <p className="mt-1 text-[13px] text-zoru-ink-muted">
            Open a project to link WhatsApp accounts and start chatting.
          </p>
        </div>
        <Button size="md" onClick={() => setCreateOpen(true)}>
          <Plus />
          New SabWa project
        </Button>
      </div>

      {sabwaProjects.length >= 5 && (
        <div className="mt-5 max-w-md">
          <Input
            leadingSlot={<Search />}
            placeholder="Search projects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      )}

      <div className="mt-6">
        {sabwaProjects.length === 0 ? (
          <EmptyState
            icon={<Sparkles />}
            title="No SabWa projects yet"
            description="Create one to link your first personal WhatsApp number."
            action={
              <Button size="md" onClick={() => setCreateOpen(true)}>
                <Plus />
                New SabWa project
              </Button>
            }
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Search />}
            title="No projects matched"
            description="Try a different search term."
          />
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((p) => (
              <ProjectRow key={p.id} project={p} onOpen={openProject} />
            ))}
          </div>
        )}
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
