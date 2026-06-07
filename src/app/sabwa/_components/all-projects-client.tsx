'use client';

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  Field,
  Input,
  PageActions,
  PageDescription,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  cn,
  useToast,
} from '@/components/sabcrm/20ui';
import { useRouter } from 'next/navigation';
import {
  ChevronRight,
  Loader2,
  MessageSquare,
  Plus,
  Search,
  Sparkles,
} from 'lucide-react';

import { useProject } from '@/context/project-context';
import { addSabwaProject } from '@/app/actions/sabwa.actions';

/**
 * AllProjectsClient. The `/sabwa` clean projects landing.
 *
 * Just two things:
 *   1. List of SabWa workspaces (filtered to `kind === 'sabwa'`).
 *   2. "New SabWa project" button that opens an inline create dialog.
 *
 * Clicking a workspace activates it and navigates to /sabwa/overview,
 * which is the accounts hub (linked WhatsApp numbers, connect-more
 * CTA, active-session picker). The legal/connect details all live on
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

/* create-project dialog */

function CreateSabwaProjectDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  onCreated: (projectId: string) => void;
}) {
  const { toast } = useToast();
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
        toast.error({
          title: 'Could not create project',
          description: res.error,
        });
        return;
      }
      toast.success({
        title: 'SabWa project created',
        description: `"${res.name}" is ready.`,
      });
      onCreated(res.projectId);
      onOpenChange(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New SabWa project</DialogTitle>
          <DialogDescription>
            A dedicated workspace for one or more WhatsApp accounts. Stays
            separate from your WaChat, Meta, and CRM projects.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <Field label="Name" id="sabwa-new-project-name">
            <Input
              autoFocus
              maxLength={120}
              placeholder="e.g. Personal, Field team, Outreach"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={pending || !name.trim()}>
              {pending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Plus aria-hidden="true" />
              )}
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* project row */

function ProjectRow({
  project,
  onOpen,
}: {
  project: AllProjectsBootstrap['projects'][number];
  onOpen: (id: string) => void;
}) {
  return (
    <Button
      variant="ghost"
      onClick={() => onOpen(project.id)}
      className={cn(
        'group !h-auto w-full justify-start gap-4 rounded-[var(--st-radius-lg)]',
        'border border-[var(--st-border)] bg-[var(--st-bg)] !p-4 text-left',
        'hover:border-[var(--st-border-strong)] hover:bg-[var(--st-bg)]',
        'hover:shadow-[var(--st-shadow-sm)]',
      )}
    >
      <span className="flex w-full items-center gap-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)] text-[var(--st-text)]">
          <MessageSquare className="h-4 w-4" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] text-[var(--st-text)]">
            {project.name}
          </span>
          <span className="mt-0.5 block truncate text-[12px] text-[var(--st-text-secondary)]">
            SabWa workspace
            {project.groupName ? ` , ${project.groupName}` : ''}
          </span>
        </span>
        <ChevronRight
          className="h-4 w-4 shrink-0 text-[var(--st-text-tertiary)] transition group-hover:translate-x-0.5 group-hover:text-[var(--st-text)]"
          aria-hidden="true"
        />
      </span>
    </Button>
  );
}

/* page */

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
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard">SabNode</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>SabWa</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <PageHeader className="mt-5" bordered={false}>
        <PageHeaderHeading>
          <PageTitle>Your SabWa projects</PageTitle>
          <PageDescription>
            Open a project to link WhatsApp accounts and start chatting.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Button size="md" variant="primary" onClick={() => setCreateOpen(true)}>
            <Plus aria-hidden="true" />
            New SabWa project
          </Button>
        </PageActions>
      </PageHeader>

      {sabwaProjects.length >= 5 && (
        <div className="mt-5 max-w-md">
          <Input
            iconLeft={Search}
            aria-label="Search projects"
            placeholder="Search projects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      )}

      <div className="mt-6">
        {sabwaProjects.length === 0 ? (
          <EmptyState
            icon={Sparkles}
            title="No SabWa projects yet"
            description="Create one to link your first personal WhatsApp number."
            action={
              <Button size="md" variant="primary" onClick={() => setCreateOpen(true)}>
                <Plus aria-hidden="true" />
                New SabWa project
              </Button>
            }
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Search}
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
