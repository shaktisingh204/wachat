'use client';

/**
 * SabCRM Projects — workspace orchestrator.
 *
 * The full project-management surface. Owns the data lifecycle (idempotent
 * object seeding → record load → optimistic mutations) and switches between the
 * List, Board (kanban) and Timeline (gantt) views via a segmented control whose
 * value is mirrored into the `?view=` query so the sidebar submenu links deep-
 * link straight into a view.
 *
 * Built entirely on the 20ui design system inside the `.sabcrm-twenty` / `.ui20`
 * frame provided by `../layout.tsx`. RBAC / project / plan gating is enforced by
 * every server action it calls, so it fails closed to calm in-page states.
 */

import * as React from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import {
  FolderKanban,
  Table2,
  Columns3,
  GanttChartSquare,
  Plus,
  Search,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';

import {
  PageHeader,
  PageHeaderHeading,
  PageEyebrow,
  PageTitle,
  PageDescription,
  PageActions,
  SegmentedControl,
  Button,
  Input,
  Alert,
  Spinner,
} from '@/components/sabcrm/20ui';
import type { SegmentedItem } from '@/components/sabcrm/20ui';
import { useProject } from '@/context/project-context';
import {
  listSabcrmRecordsTw,
  createSabcrmRecordTw,
  updateSabcrmRecordTw,
  deleteSabcrmRecordTw,
} from '@/app/actions/sabcrm-twenty.actions';
import { ensureProjectsObjectTw } from '@/app/actions/sabcrm-projects.actions';
import { PROJECTS_SLUG } from '@/lib/sabcrm/projects-object';

import { ProjectsList } from './projects-list';
import { ProjectsBoard } from './projects-board';
import { ProjectsTimeline } from './projects-timeline';
import { ProjectFormDialog } from './project-form-dialog';
import { ProjectDetailDrawer } from './project-detail-drawer';
import { toProjectVM, asProjectView, type ProjectVM, type ProjectView } from './projects-shared';

import './projects.css';

const VIEW_ITEMS: ReadonlyArray<SegmentedItem<ProjectView>> = [
  { value: 'list', label: 'List', icon: Table2 },
  { value: 'board', label: 'Board', icon: Columns3 },
  { value: 'timeline', label: 'Timeline', icon: GanttChartSquare },
];

export function ProjectsWorkspace(): React.JSX.Element {
  const { activeProjectId } = useProject();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // The active view is URL-driven so the sidebar submenu links deep-link into
  // a view (and reloads / back-forward restore it) without local-state drift.
  const view: ProjectView = asProjectView(searchParams.get('view'));
  const [projects, setProjects] = React.useState<ProjectVM[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [searchInput, setSearchInput] = React.useState('');
  const [search, setSearch] = React.useState('');

  // Dialog (create / edit) state.
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<ProjectVM | null>(null);
  const [presetStatus, setPresetStatus] = React.useState<string | undefined>(undefined);

  // Detail drawer state.
  const [detail, setDetail] = React.useState<ProjectVM | null>(null);
  const [detailOpen, setDetailOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  const projectArg = activeProjectId ?? undefined;

  // Debounce the search box (300ms), mirroring the object-page pattern.
  React.useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim().toLowerCase()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    const ensured = await ensureProjectsObjectTw(projectArg);
    if (!ensured.ok) {
      setLoading(false);
      setError(ensured.error);
      return;
    }
    // No `sortBy` → the engine sorts by the top-level `updatedAt` (newest first);
    // the List view re-sorts on the client when a column header is activated.
    const res = await listSabcrmRecordsTw(PROJECTS_SLUG, { limit: 500 }, projectArg);
    setLoading(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setProjects(res.data.records.map(toProjectVM));
  }, [projectArg]);

  React.useEffect(() => {
    void load();
  }, [load]);

  // Reflect the active view into the URL (so submenu deep-links + reloads hold).
  const changeView = React.useCallback(
    (next: ProjectView) => {
      const qs = next === 'list' ? '' : `?view=${next}`;
      router.replace(`${pathname}${qs}`, { scroll: false });
    },
    [router, pathname],
  );

  const filtered = React.useMemo(() => {
    if (!search) return projects;
    return projects.filter(
      (p) =>
        p.name.toLowerCase().includes(search) ||
        p.owner.toLowerCase().includes(search) ||
        p.description.toLowerCase().includes(search),
    );
  }, [projects, search]);

  // ---- Mutations --------------------------------------------------------

  const openCreate = React.useCallback((status?: string) => {
    setEditing(null);
    setPresetStatus(status);
    setFormOpen(true);
  }, []);

  const openEdit = React.useCallback((p: ProjectVM) => {
    setEditing(p);
    setPresetStatus(undefined);
    setDetailOpen(false);
    setFormOpen(true);
  }, []);

  const openDetail = React.useCallback((p: ProjectVM) => {
    setDetail(p);
    setDetailOpen(true);
  }, []);

  const handleSubmit = React.useCallback(
    async (data: Record<string, unknown>): Promise<boolean> => {
      const res = editing
        ? await updateSabcrmRecordTw(PROJECTS_SLUG, editing.id, data, projectArg)
        : await createSabcrmRecordTw(PROJECTS_SLUG, data, projectArg);
      if (!res.ok) return false;
      setFormOpen(false);
      await load();
      return true;
    },
    [editing, projectArg, load],
  );

  const handleStatusChange = React.useCallback(
    (id: string, status: string) => {
      // Optimistic: move the card immediately, revert by reloading on failure.
      setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, status } : p)));
      void (async () => {
        const res = await updateSabcrmRecordTw(PROJECTS_SLUG, id, { status }, projectArg);
        if (!res.ok) {
          setError(res.error);
          void load();
        }
      })();
    },
    [projectArg, load],
  );

  const handleDelete = React.useCallback(
    async (p: ProjectVM) => {
      setDeleting(true);
      const res = await deleteSabcrmRecordTw(PROJECTS_SLUG, p.id, projectArg);
      setDeleting(false);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setProjects((prev) => prev.filter((x) => x.id !== p.id));
      setDetailOpen(false);
    },
    [projectArg],
  );

  // ---- Render -----------------------------------------------------------

  return (
    <div className="pm-page">
      <PageHeader>
        <PageHeaderHeading>
          <PageEyebrow>Workspace</PageEyebrow>
          <PageTitle>Projects</PageTitle>
          <PageDescription>Plan, track and deliver work across the team.</PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Button variant="ghost" iconLeft={RefreshCw} onClick={() => void load()} aria-label="Refresh">
            Refresh
          </Button>
          <Button variant="primary" iconLeft={Plus} onClick={() => openCreate()}>
            New project
          </Button>
        </PageActions>
      </PageHeader>

      <div className="pm-toolbar">
        <SegmentedControl
          items={VIEW_ITEMS}
          value={view}
          onChange={changeView}
          aria-label="Project view"
        />
        <div className="pm-toolbar__search">
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            iconLeft={Search}
            placeholder="Search projects…"
            inputSize="sm"
            aria-label="Search projects"
          />
        </div>
      </div>

      {error ? (
        <Alert tone="danger" icon={AlertTriangle} className="pm-page__alert">
          {error}
        </Alert>
      ) : null}

      {loading ? (
        <div className="pm-page__loading">
          <Spinner />
          <span>Loading projects…</span>
        </div>
      ) : (
        <div className="pm-page__view">
          {view === 'list' ? <ProjectsList projects={filtered} onOpen={openDetail} /> : null}
          {view === 'board' ? (
            <ProjectsBoard
              projects={filtered}
              onOpen={openDetail}
              onStatusChange={handleStatusChange}
              onAdd={openCreate}
            />
          ) : null}
          {view === 'timeline' ? <ProjectsTimeline projects={filtered} onOpen={openDetail} /> : null}
        </div>
      )}

      <ProjectFormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        initial={editing}
        defaultStatus={presetStatus}
        onSubmit={handleSubmit}
      />

      <ProjectDetailDrawer
        project={detail}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onEdit={openEdit}
        onDelete={(p) => void handleDelete(p)}
        deleting={deleting}
      />
    </div>
  );
}
