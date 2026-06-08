'use client';

/**
 * SabCRM - Templates settings (`/dashboard/settings/crm/templates`), pure 20ui.
 *
 * A two-pane note / email / task template manager scoped to the active project
 * via `useProject()`:
 *
 *   - A kind filter (All / Note / Email / Task) above the panes narrows the
 *     left list to a single template kind.
 *
 *   - Left pane: a scrollable list of templates, each row showing the template
 *     name and a per-kind badge. Selecting a row loads it into the editor.
 *     "New" seeds a fresh, unsaved draft of the currently-filtered kind.
 *
 *   - Right pane: the editor: name input, kind select, a subject input shown
 *     only for the `email` kind, and a body textarea. An inline hint lists the
 *     template variables the engine supports (e.g. {{record.name}}). Save /
 *     Delete sit in the editor header.
 *
 * Every action independently re-runs the session, project, RBAC, plan pipeline
 * server-side, so the page fails closed. States: list/editor skeletons while
 * data loads, "no project" notice, empty list, error banner, and graceful
 * degradation when the engine is unreachable.
 *
 * The data layer lives in `@/app/actions/sabcrm-templates.actions`; this file
 * codes against that documented contract.
 */

import * as React from 'react';
import {
  FileText,
  Plus,
  Save,
  Trash2,
  Info,
  StickyNote,
  Mail,
  CheckSquare,
  LayoutTemplate,
} from 'lucide-react';

import {
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageDescription,
  PageActions,
  Button,
  Badge,
  Field,
  Input,
  Textarea,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  SegmentedControl,
  Alert,
  EmptyState,
  Callout,
  Skeleton,
  Modal,
  type BadgeTone,
} from '@/components/sabcrm/20ui';
import { useProject } from '@/context/project-context';
import {
  listTemplatesTw,
  getTemplateTw,
  createTemplateTw,
  updateTemplateTw,
  deleteTemplateTw,
} from '@/app/actions/sabcrm-templates.actions';

// ---------------------------------------------------------------------------
// Wire shapes
//
// Declared locally to keep this client page free of any `server-only` import.
// Mirrors the `{ id, name, kind, subject?, body, ... }` template documented in
// the `@/app/actions/sabcrm-templates.actions` contract. The action results
// follow SabNode's `{ ok: true, data } | { ok: false, error }` envelope.
// ---------------------------------------------------------------------------

type TemplateKind = 'note' | 'email' | 'task';

interface Template {
  id: string;
  name: string;
  kind: TemplateKind;
  subject?: string;
  body: string;
}

type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

/** Filter value: the three real kinds plus the catch-all "all". */
type KindFilter = 'all' | TemplateKind;

// ---------------------------------------------------------------------------
// Kind descriptors
// ---------------------------------------------------------------------------

interface KindInfo {
  label: string;
  Icon: React.ElementType;
  /** Badge tone that carries the kind's meaning. */
  tone: BadgeTone;
}

const KIND_INFO: Record<TemplateKind, KindInfo> = {
  note: { label: 'Note', Icon: StickyNote, tone: 'accent' },
  email: { label: 'Email', Icon: Mail, tone: 'info' },
  task: { label: 'Task', Icon: CheckSquare, tone: 'success' },
};

const KIND_ORDER: TemplateKind[] = ['note', 'email', 'task'];

const FILTER_ITEMS: { value: KindFilter; label: string; icon: React.ElementType }[] = [
  { value: 'all', label: 'All', icon: LayoutTemplate },
  { value: 'note', label: 'Note', icon: StickyNote },
  { value: 'email', label: 'Email', icon: Mail },
  { value: 'task', label: 'Task', icon: CheckSquare },
];

/** Supported merge variables surfaced as an inline hint in the editor. */
const SUPPORTED_VARIABLES = [
  '{{record.name}}',
  '{{record.email}}',
  '{{record.company}}',
  '{{record.phone}}',
  '{{owner.name}}',
  '{{workspace.name}}',
  '{{today}}',
];

// ---------------------------------------------------------------------------
// Draft model
//
// The editor edits a `Draft`: a Template plus a synthetic `id: null` for an
// unsaved "New" record. Keeping the draft separate from the loaded list lets us
// detect dirtiness and avoid mutating list rows mid-edit.
// ---------------------------------------------------------------------------

interface Draft {
  id: string | null;
  name: string;
  kind: TemplateKind;
  subject: string;
  body: string;
}

function draftFromTemplate(t: Template): Draft {
  return {
    id: t.id,
    name: t.name,
    kind: t.kind,
    subject: t.subject ?? '',
    body: t.body,
  };
}

function blankDraft(kind: TemplateKind): Draft {
  return { id: null, name: '', kind, subject: '', body: '' };
}

// ---------------------------------------------------------------------------
// Kind badge - list-row chip with a per-kind tone.
// ---------------------------------------------------------------------------

function KindBadge({ kind }: { kind: TemplateKind }): React.JSX.Element {
  return (
    <Badge tone={KIND_INFO[kind].tone} dot>
      {KIND_INFO[kind].label}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// List skeleton
// ---------------------------------------------------------------------------

function ListSkeleton(): React.JSX.Element {
  return (
    <div className="flex flex-col gap-2 p-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} height={40} radius="var(--st-radius)" />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Variable hint
// ---------------------------------------------------------------------------

function VariableHint(): React.JSX.Element {
  return (
    <Callout tone="info" icon={Info} title="Supported variables">
      <div className="mt-2 flex flex-wrap gap-1.5">
        {SUPPORTED_VARIABLES.map((v) => (
          <code
            key={v}
            className="rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--st-text-secondary)]"
          >
            {v}
          </code>
        ))}
      </div>
      <p className="mt-2 text-[12px] text-[var(--st-text-secondary)]">
        Insert any of these tokens into the subject or body. They are replaced
        with the record&apos;s values when the template is used.
      </p>
    </Callout>
  );
}

// ---------------------------------------------------------------------------
// Editor pane
// ---------------------------------------------------------------------------

interface EditorProps {
  draft: Draft;
  saving: boolean;
  deleting: boolean;
  error: string | null;
  onChange: (patch: Partial<Draft>) => void;
  onSave: () => void;
  onDelete: () => void;
}

function Editor({
  draft,
  saving,
  deleting,
  error,
  onChange,
  onSave,
  onDelete,
}: EditorProps): React.JSX.Element {
  const isNew = draft.id === null;
  const busy = saving || deleting;

  return (
    <form
      className="flex min-h-0 flex-1 flex-col rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg)]"
      onSubmit={(e) => {
        e.preventDefault();
        onSave();
      }}
    >
      <div className="flex items-center justify-between gap-3 border-b border-[var(--st-border)] px-5 py-3">
        <h2 className="text-[15px] font-semibold text-[var(--st-text)]">
          {isNew ? 'New template' : 'Edit template'}
        </h2>
        <div className="flex items-center gap-2">
          {!isNew ? (
            <Button
              variant="danger"
              iconLeft={Trash2}
              onClick={onDelete}
              disabled={busy}
              title="Delete template"
            >
              {deleting ? 'Deleting' : 'Delete'}
            </Button>
          ) : null}
          <Button type="submit" variant="primary" iconLeft={Save} loading={saving} disabled={busy}>
            {saving ? 'Saving' : 'Save'}
          </Button>
        </div>
      </div>

      {error ? (
        <div className="px-5 pt-4">
          <Alert tone="danger">{error}</Alert>
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-5">
        <Field label="Name" required>
          <Input
            value={draft.name}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder="e.g. Follow-up email"
            disabled={busy}
            autoComplete="off"
          />
        </Field>

        <Field label="Kind">
          <Select
            value={draft.kind}
            onValueChange={(v) => onChange({ kind: v as TemplateKind })}
            disabled={busy}
          >
            <SelectTrigger aria-label="Template kind">
              <SelectValue placeholder="Pick a kind" />
            </SelectTrigger>
            <SelectContent>
              {KIND_ORDER.map((k) => (
                <SelectItem key={k} value={k}>
                  {KIND_INFO[k].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        {draft.kind === 'email' ? (
          <Field label="Subject">
            <Input
              value={draft.subject}
              onChange={(e) => onChange({ subject: e.target.value })}
              placeholder="e.g. Following up on {{record.name}}"
              disabled={busy}
              autoComplete="off"
            />
          </Field>
        ) : null}

        <Field label="Body">
          <Textarea
            value={draft.body}
            onChange={(e) => onChange({ body: e.target.value })}
            placeholder="Write the template content. Use variables like {{record.name}}."
            disabled={busy}
            rows={10}
          />
        </Field>

        <VariableHint />
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SabcrmTemplatesSettingsPage(): React.JSX.Element {
  const { activeProjectId, isLoadingProject } = useProject();

  // List
  const [templates, setTemplates] = React.useState<Template[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Filter
  const [filter, setFilter] = React.useState<KindFilter>('all');

  // Selection / editor
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState<Draft | null>(null);
  const [editorError, setEditorError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  // When set, the delete-confirmation dialog is open for the current draft.
  const [confirmingDelete, setConfirmingDelete] = React.useState(false);

  // ----- Loaders -----

  const loadTemplates = React.useCallback(async (projectId: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = (await listTemplatesTw(
        undefined,
        projectId,
      )) as ActionResult<Template[]>;
      if (res.ok) {
        setTemplates(res.data);
      } else {
        setError(res.error);
      }
    } catch {
      setError('Templates could not be loaded. The service may be unavailable.');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (isLoadingProject) return;
    if (!activeProjectId) {
      setLoading(false);
      return;
    }
    void loadTemplates(activeProjectId);
  }, [activeProjectId, isLoadingProject, loadTemplates]);

  // ----- Derived -----

  const visibleTemplates = React.useMemo(() => {
    const rows = filter === 'all' ? templates : templates.filter((t) => t.kind === filter);
    return [...rows].sort((a, b) =>
      (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }),
    );
  }, [templates, filter]);

  // ----- Selection -----

  const selectTemplate = React.useCallback(
    async (id: string) => {
      if (!activeProjectId) return;
      setSelectedId(id);
      setEditorError(null);
      // Optimistically seed the editor from the cached list row so the pane
      // never flashes empty, then refresh from the authoritative single-get.
      const cached = templates.find((t) => t.id === id);
      if (cached) setDraft(draftFromTemplate(cached));
      try {
        const res = (await getTemplateTw(id, activeProjectId)) as ActionResult<Template>;
        if (res.ok) {
          setDraft(draftFromTemplate(res.data));
        } else if (!cached) {
          setEditorError(res.error);
        }
      } catch {
        if (!cached) {
          setEditorError('This template could not be loaded. The service may be unavailable.');
        }
      }
    },
    [activeProjectId, templates],
  );

  const startNew = React.useCallback(() => {
    setSelectedId(null);
    setEditorError(null);
    // Seed the kind from the active filter when it's a concrete kind.
    setDraft(blankDraft(filter === 'all' ? 'note' : filter));
  }, [filter]);

  const patchDraft = React.useCallback((patch: Partial<Draft>) => {
    setDraft((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  // ----- Mutations -----

  const handleSave = React.useCallback(async () => {
    if (!draft || !activeProjectId || saving) return;
    const name = draft.name.trim();
    if (!name) {
      setEditorError('A template name is required.');
      return;
    }
    setSaving(true);
    setEditorError(null);

    // Email subject only travels for the email kind.
    const payload = {
      name,
      kind: draft.kind,
      body: draft.body,
      ...(draft.kind === 'email' ? { subject: draft.subject.trim() } : {}),
    };

    try {
      let res: ActionResult<Template>;
      if (draft.id === null) {
        res = (await createTemplateTw(
          payload,
          activeProjectId,
        )) as ActionResult<Template>;
      } else {
        res = (await updateTemplateTw(
          draft.id,
          payload,
          activeProjectId,
        )) as ActionResult<Template>;
      }

      if (res.ok) {
        const saved = res.data;
        setTemplates((prev) => {
          const exists = prev.some((t) => t.id === saved.id);
          return exists
            ? prev.map((t) => (t.id === saved.id ? saved : t))
            : [saved, ...prev];
        });
        setSelectedId(saved.id);
        setDraft(draftFromTemplate(saved));
      } else {
        setEditorError(res.error);
      }
    } catch {
      setEditorError('Failed to save the template. The service may be unavailable.');
    } finally {
      setSaving(false);
    }
  }, [draft, activeProjectId, saving]);

  const handleDelete = React.useCallback(async () => {
    if (!draft || draft.id === null || !activeProjectId || deleting) return;
    const targetId = draft.id;
    setDeleting(true);
    setEditorError(null);
    try {
      const res = (await deleteTemplateTw(targetId, activeProjectId)) as ActionResult<unknown>;
      if (res.ok) {
        setTemplates((prev) => prev.filter((t) => t.id !== targetId));
        setSelectedId(null);
        setDraft(null);
        setConfirmingDelete(false);
      } else {
        setEditorError(res.error);
        setConfirmingDelete(false);
      }
    } catch {
      setEditorError('Failed to delete the template. The service may be unavailable.');
      setConfirmingDelete(false);
    } finally {
      setDeleting(false);
    }
  }, [draft, activeProjectId, deleting]);

  // ----- Render -----

  return (
    <div className="20ui sabcrm-twenty mx-auto flex min-h-0 w-full max-w-5xl flex-col gap-5 p-6">
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>Templates</PageTitle>
          <PageDescription>
            Reusable note, email, and task templates for this workspace. Pick a
            template on the left to edit it, or create a new one. Templates can
            embed variables like <code>{'{{record.name}}'}</code> that are
            filled in when the template is used.
          </PageDescription>
        </PageHeaderHeading>
        {activeProjectId ? (
          <PageActions>
            <Button variant="primary" iconLeft={Plus} onClick={startNew}>
              New template
            </Button>
          </PageActions>
        ) : null}
      </PageHeader>

      {isLoadingProject ? (
        <div className="rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg)]">
          <ListSkeleton />
        </div>
      ) : !activeProjectId ? (
        <EmptyState
          icon={FileText}
          tone="warning"
          title="No project selected"
          description="Select a project to manage its templates."
        />
      ) : (
        <>
          {/* Kind filter */}
          <SegmentedControl
            aria-label="Filter templates by kind"
            value={filter}
            onChange={(v) => setFilter(v as KindFilter)}
            items={FILTER_ITEMS.map((tab) => ({
              value: tab.value,
              label: tab.label,
              icon: tab.icon as never,
            }))}
          />

          <div className="grid min-h-[28rem] grid-cols-1 gap-4 md:grid-cols-[18rem_1fr]">
            {/* Left list */}
            <aside
              className="flex min-h-0 flex-col overflow-hidden rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg)]"
              aria-label="Templates"
            >
              {loading ? (
                <ListSkeleton />
              ) : error ? (
                <div className="p-4">
                  <Alert tone="danger">{error}</Alert>
                </div>
              ) : visibleTemplates.length === 0 ? (
                <EmptyState
                  size="sm"
                  icon={FileText}
                  title={templates.length === 0 ? 'No templates yet' : `No ${filter} templates`}
                  description={
                    templates.length === 0
                      ? 'Create one to get started.'
                      : 'Try a different filter, or create one.'
                  }
                />
              ) : (
                <div className="flex flex-col gap-1 overflow-y-auto p-2">
                  {visibleTemplates.map((t) => {
                    const active = selectedId === t.id;
                    return (
                      <Button
                        key={t.id}
                        variant={active ? 'secondary' : 'ghost'}
                        block
                        aria-current={active ? 'true' : undefined}
                        onClick={() => void selectTemplate(t.id)}
                        className="justify-between"
                      >
                        <span
                          className={
                            t.name.trim()
                              ? 'truncate text-[var(--st-text)]'
                              : 'truncate italic text-[var(--st-text-tertiary)]'
                          }
                        >
                          {t.name.trim() || 'Untitled template'}
                        </span>
                        <KindBadge kind={t.kind} />
                      </Button>
                    );
                  })}
                </div>
              )}
            </aside>

            {/* Right editor */}
            {draft ? (
              <Editor
                draft={draft}
                saving={saving}
                deleting={deleting}
                error={editorError}
                onChange={patchDraft}
                onSave={handleSave}
                onDelete={() => setConfirmingDelete(true)}
              />
            ) : (
              <div className="flex min-h-0 flex-1 items-center justify-center rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg)]">
                <EmptyState
                  icon={FileText}
                  title="No template selected"
                  description="Choose a template from the list, or create a new one to start editing."
                />
              </div>
            )}
          </div>
        </>
      )}

      <Modal
        open={confirmingDelete && Boolean(draft) && draft?.id !== null}
        onClose={() => setConfirmingDelete(false)}
        title="Delete template"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmingDelete(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDelete} loading={deleting} disabled={deleting}>
              {deleting ? 'Deleting' : 'Delete template'}
            </Button>
          </>
        }
      >
        <p className="text-[var(--st-text-secondary)]">
          Delete{' '}
          <strong className="text-[var(--st-text)]">
            {draft?.name.trim() || 'this template'}
          </strong>
          ? This cannot be undone.
        </p>
      </Modal>
    </div>
  );
}
