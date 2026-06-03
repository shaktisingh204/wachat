'use client';

/**
 * SabCRM — Templates settings (`/sabcrm/settings/templates`), Twenty-style.
 *
 * A two-pane note / email / task template manager scoped to the active project
 * via `useProject()`:
 *
 *   • A kind filter (All / Note / Email / Task) above the panes narrows the
 *     left list to a single template kind.
 *
 *   • Left pane — a scrollable list of templates, each row showing the template
 *     name and a per-kind badge. Selecting a row loads it into the editor.
 *     "New" seeds a fresh, unsaved draft of the currently-filtered kind.
 *
 *   • Right pane — the editor: name input, kind select, a subject input shown
 *     only for the `email` kind, and a body textarea. An inline hint lists the
 *     template variables the engine supports (e.g. {{record.name}}). Save /
 *     Delete sit in the editor header.
 *
 * Every action independently re-runs the session → project → RBAC → plan
 * pipeline server-side, so the page fails closed. States: list/editor
 * skeletons while data loads, "no project" notice, empty list, error banner,
 * and graceful degradation when the engine is unreachable.
 *
 * Editable surface is this page + `./templates.css` only. The data layer lives
 * in `@/app/actions/sabcrm-templates.actions` (built in parallel); this file
 * codes against that documented contract.
 */

import * as React from 'react';
import {
  FileText,
  Plus,
  Save,
  Trash2,
  AlertTriangle,
  Info,
  StickyNote,
  Mail,
  CheckSquare,
  LayoutTemplate,
} from 'lucide-react';

import { TwentyPageHeader, TwentyButton } from '@/components/sabcrm/twenty';
import { useProject } from '@/context/project-context';
import {
  listTemplatesTw,
  getTemplateTw,
  createTemplateTw,
  updateTemplateTw,
  deleteTemplateTw,
} from '@/app/actions/sabcrm-templates.actions';

import '@/styles/sabcrm-twenty.css';
import '../settings-twenty.css';
import './templates.css';

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

/** Filter value — the three real kinds plus the catch-all "all". */
type KindFilter = 'all' | TemplateKind;

// ---------------------------------------------------------------------------
// Kind descriptors
// ---------------------------------------------------------------------------

interface KindInfo {
  label: string;
  Icon: React.ElementType;
}

const KIND_INFO: Record<TemplateKind, KindInfo> = {
  note: { label: 'Note', Icon: StickyNote },
  email: { label: 'Email', Icon: Mail },
  task: { label: 'Task', Icon: CheckSquare },
};

const KIND_ORDER: TemplateKind[] = ['note', 'email', 'task'];

const FILTER_TABS: { value: KindFilter; label: string; Icon: React.ElementType }[] = [
  { value: 'all', label: 'All', Icon: LayoutTemplate },
  { value: 'note', label: 'Note', Icon: StickyNote },
  { value: 'email', label: 'Email', Icon: Mail },
  { value: 'task', label: 'Task', Icon: CheckSquare },
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
// Kind badge — list-row chip with a per-kind dot.
// ---------------------------------------------------------------------------

function KindBadge({ kind }: { kind: TemplateKind }): React.JSX.Element {
  return (
    <span className={`st-tpl-kind st-tpl-kind--${kind}`}>
      <span className="st-tpl-kind__dot" aria-hidden="true" />
      {KIND_INFO[kind].label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// List skeleton
// ---------------------------------------------------------------------------

function ListSkeleton(): React.JSX.Element {
  return (
    <div className="st-tpl-list__skeleton">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="st-skeleton st-skeleton-row" />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Variable hint
// ---------------------------------------------------------------------------

function VariableHint(): React.JSX.Element {
  return (
    <div className="st-tpl-vars">
      <div className="st-tpl-vars__head">
        <Info size={12} aria-hidden="true" />
        Supported variables
      </div>
      <div className="st-tpl-vars__list">
        {SUPPORTED_VARIABLES.map((v) => (
          <code key={v} className="st-tpl-vars__chip">
            {v}
          </code>
        ))}
      </div>
      <p className="st-tpl-vars__note">
        Insert any of these tokens into the subject or body — they&apos;re
        replaced with the record&apos;s values when the template is used.
      </p>
    </div>
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
      className="st-tpl-editor"
      onSubmit={(e) => {
        e.preventDefault();
        onSave();
      }}
    >
      <div className="st-tpl-editor__head">
        <h2 className="st-tpl-editor__title">
          {isNew ? 'New template' : 'Edit template'}
        </h2>
        <div className="st-tpl-editor__actions">
          {!isNew ? (
            <TwentyButton
              variant="ghost"
              icon={Trash2}
              className="st-btn--danger"
              onClick={onDelete}
              disabled={busy}
              title="Delete template"
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </TwentyButton>
          ) : null}
          <TwentyButton type="submit" variant="primary" icon={Save} disabled={busy}>
            {saving ? 'Saving…' : 'Save'}
          </TwentyButton>
        </div>
      </div>

      {error ? (
        <div className="st-banner">
          <AlertTriangle className="st-banner__icon" size={16} />
          <span>{error}</span>
        </div>
      ) : null}

      <div className="st-tpl-editor__body">
        <div className="st-field">
          <label className="st-field__label" htmlFor="tpl-name">
            Name
            <span className="st-field__req" aria-hidden="true">
              *
            </span>
          </label>
          <input
            id="tpl-name"
            className="st-input"
            type="text"
            value={draft.name}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder="e.g. Follow-up email"
            disabled={busy}
            autoComplete="off"
          />
        </div>

        <div className="st-field">
          <label className="st-field__label" htmlFor="tpl-kind">
            Kind
          </label>
          <select
            id="tpl-kind"
            className="st-select"
            value={draft.kind}
            onChange={(e) => onChange({ kind: e.target.value as TemplateKind })}
            disabled={busy}
          >
            {KIND_ORDER.map((k) => (
              <option key={k} value={k}>
                {KIND_INFO[k].label}
              </option>
            ))}
          </select>
        </div>

        {draft.kind === 'email' ? (
          <div className="st-field">
            <label className="st-field__label" htmlFor="tpl-subject">
              Subject
            </label>
            <input
              id="tpl-subject"
              className="st-input"
              type="text"
              value={draft.subject}
              onChange={(e) => onChange({ subject: e.target.value })}
              placeholder="e.g. Following up on {{record.name}}"
              disabled={busy}
              autoComplete="off"
            />
          </div>
        ) : null}

        <div className="st-field">
          <label className="st-field__label" htmlFor="tpl-body">
            Body
          </label>
          <textarea
            id="tpl-body"
            className="st-textarea st-tpl-body"
            value={draft.body}
            onChange={(e) => onChange({ body: e.target.value })}
            placeholder="Write the template content. Use variables like {{record.name}}."
            disabled={busy}
          />
        </div>

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

  // ----- Loaders -----

  const loadTemplates = React.useCallback(async (projectId: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = (await listTemplatesTw(
        { projectId },
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
          { ...payload, projectId: activeProjectId },
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
      } else {
        setEditorError(res.error);
      }
    } catch {
      setEditorError('Failed to delete the template. The service may be unavailable.');
    } finally {
      setDeleting(false);
    }
  }, [draft, activeProjectId, deleting]);

  // ----- Render -----

  return (
    <div className="st-page">
      <div className="st-settings">
        <TwentyPageHeader
          title="Templates"
          icon={FileText}
          actions={
            activeProjectId ? (
              <TwentyButton variant="primary" icon={Plus} onClick={startNew}>
                New template
              </TwentyButton>
            ) : null
          }
        />
        <p className="st-settings__intro">
          Reusable note, email, and task templates for this workspace. Pick a
          template on the left to edit it, or create a new one. Templates can
          embed variables like <code>{'{{record.name}}'}</code> that are filled
          in when the template is used.
        </p>

        {isLoadingProject ? (
          <div className="st-tpl-list">
            <ListSkeleton />
          </div>
        ) : !activeProjectId ? (
          <div className="st-empty">
            <span className="st-empty__icon">
              <AlertTriangle size={20} />
            </span>
            <h2 className="st-empty__title">No project selected</h2>
            <p className="st-empty__desc">
              Select a project to manage its templates.
            </p>
          </div>
        ) : (
          <>
            {/* Kind filter */}
            <div className="st-tpl-filter" role="tablist" aria-label="Filter templates by kind">
              {FILTER_TABS.map((tab) => {
                const active = filter === tab.value;
                const { Icon } = tab;
                return (
                  <button
                    key={tab.value}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    className={`st-tpl-filter__btn${active ? ' st-tpl-filter__btn--active' : ''}`}
                    onClick={() => setFilter(tab.value)}
                  >
                    <Icon size={13} aria-hidden="true" />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            <div className="st-tpl-split">
              {/* Left list */}
              <aside className="st-tpl-list" aria-label="Templates">
                {loading ? (
                  <ListSkeleton />
                ) : error ? (
                  <div className="st-tpl-list__empty">{error}</div>
                ) : visibleTemplates.length === 0 ? (
                  <div className="st-tpl-list__empty">
                    {templates.length === 0
                      ? 'No templates yet. Create one to get started.'
                      : `No ${filter} templates.`}
                  </div>
                ) : (
                  <div className="st-tpl-list__scroll">
                    {visibleTemplates.map((t) => {
                      const active = selectedId === t.id;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          className={`st-tpl-item${active ? ' st-tpl-item--active' : ''}`}
                          aria-current={active ? 'true' : undefined}
                          onClick={() => void selectTemplate(t.id)}
                        >
                          <span
                            className={`st-tpl-item__name${
                              t.name.trim() ? '' : ' st-tpl-item__name--untitled'
                            }`}
                          >
                            {t.name.trim() || 'Untitled template'}
                          </span>
                          <KindBadge kind={t.kind} />
                        </button>
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
                  onDelete={handleDelete}
                />
              ) : (
                <div className="st-tpl-editor st-tpl-editor--empty">
                  <div className="st-empty">
                    <span className="st-empty__icon">
                      <FileText size={20} />
                    </span>
                    <h2 className="st-empty__title">No template selected</h2>
                    <p className="st-empty__desc">
                      Choose a template from the list, or create a new one to
                      start editing.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
