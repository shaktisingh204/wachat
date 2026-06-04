'use client';

/**
 * SabCRM — Pipelines settings (`/dashboard/settings/crm/pipelines`), Twenty-style.
 *
 * Twenty's "Sales pipelines" editor. A two-pane layout:
 *
 *   LEFT  — the list of pipelines this project owns. Each row shows the
 *           pipeline name, its stage count, and a "Default" badge on the one
 *           pipeline marked default. A "New" button at the top creates one.
 *
 *   RIGHT — the editor for the selected pipeline: its name, the object it runs
 *           on, an ordered list of stages (each a label + colour-swatch picker,
 *           with add / remove / reorder-by-arrows), and a "Set as default"
 *           toggle. Save persists via `updatePipelineTw` (existing) or
 *           `createPipelineTw` (new, unsaved) drafts. Delete removes it.
 *
 * Mutations go through the gated server actions in
 * `@/app/actions/sabcrm-pipelines.actions` (session → project → RBAC → plan),
 * which return a typed `ActionResult`, so the page degrades to loading / empty
 * / error states and never crashes when the engine is unreachable.
 *
 * Twenty look only — the shared `.st-*` kit (`src/styles/sabcrm-twenty.css`)
 * plus the page-local `./pipelines.css`. NO ZoruUI / Tailwind / clay. Auth /
 * RBAC / project context are enforced by the parent `../../layout.tsx`; every
 * action independently re-runs the full gate. The colour-swatch picker and the
 * arrow-based reorder mirror the Data Model SELECT-option editor.
 */

import * as React from 'react';
import {
  Plus,
  Workflow,
  AlertTriangle,
  Loader2,
  Trash2,
  X,
  Check,
  ArrowUp,
  ArrowDown,
  Star,
  GripVertical,
} from 'lucide-react';

import { TwentyPageHeader, TwentyButton } from '@/components/sabcrm/twenty';
import { useProject } from '@/context/project-context';
import {
  listPipelinesTw,
  getPipelineTw,
  createPipelineTw,
  updatePipelineTw,
  deletePipelineTw,
} from '@/app/actions/sabcrm-pipelines.actions';

import './pipelines.css';

// ---------------------------------------------------------------------------
// Wire shapes
//
// Declared locally to keep this client page free of any `server-only` import.
// Mirrors the `Pipeline` shape documented in the
// `@/app/actions/sabcrm-pipelines.actions` contract:
//   { id, name, object, stages:[{ id, label, color }], isDefault? }
// ---------------------------------------------------------------------------

interface PipelineStage {
  id: string;
  label: string;
  /** A `--zoru-*` token (or hex); optional on the wire, defaulted in the UI. */
  color?: string;
}

interface Pipeline {
  id: string;
  name: string;
  object: string;
  stages: PipelineStage[];
  isDefault?: boolean;
}

/** Input for create/update — `id` is server-assigned for new pipelines. */
interface PipelineInput {
  name: string;
  object: string;
  stages: PipelineStage[];
  isDefault?: boolean;
}

// ---------------------------------------------------------------------------
// Twenty stage-colour palette
//
// Same fixed palette the Data Model option editor paints. `token` is what we
// persist (a `--zoru-*` name, consistent with the seeded schema) and `swatch`
// is the literal hex we paint — this page renders under `.sabcrm-twenty` where
// `--zoru-*` vars are NOT in scope, so the swatch must be concrete.
// ---------------------------------------------------------------------------

interface PaletteColor {
  name: string;
  token: string;
  swatch: string;
}

const STAGE_PALETTE: ReadonlyArray<PaletteColor> = [
  { name: 'Gray', token: '--zoru-gray', swatch: '#8c8c8c' },
  { name: 'Blue', token: '--zoru-blue', swatch: '#3b7ae4' },
  { name: 'Sky', token: '--zoru-sky', swatch: '#5db4e3' },
  { name: 'Turquoise', token: '--zoru-turquoise', swatch: '#21b8a6' },
  { name: 'Green', token: '--zoru-green', swatch: '#3dab5a' },
  { name: 'Yellow', token: '--zoru-yellow', swatch: '#e0c64a' },
  { name: 'Orange', token: '--zoru-orange', swatch: '#f0883e' },
  { name: 'Red', token: '--zoru-red', swatch: '#e0484e' },
  { name: 'Pink', token: '--zoru-pink', swatch: '#e052b0' },
  { name: 'Purple', token: '--zoru-purple', swatch: '#9b51e0' },
];

const DEFAULT_STAGE_COLOR = STAGE_PALETTE[0].token;

/** Resolve a stored stage colour (token or hex) to a paintable swatch. */
function swatchFor(color: string | undefined): string {
  if (!color) return STAGE_PALETTE[0].swatch;
  const match = STAGE_PALETTE.find((c) => c.token === color);
  if (match) return match.swatch;
  return /^#|^rgb|^hsl/.test(color) ? color : STAGE_PALETTE[0].swatch;
}

/**
 * Objects a pipeline can run on (Twenty ships pipelines on these). The values
 * are the plural object slugs the Rust engine uses — `"opportunities"` is the
 * server-side default — so a created pipeline's `object` round-trips cleanly.
 */
const PIPELINE_OBJECTS: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'opportunities', label: 'Opportunities' },
  { value: 'leads', label: 'Leads' },
  { value: 'deals', label: 'Deals' },
  { value: 'companies', label: 'Companies' },
  { value: 'people', label: 'People' },
];

function objectLabel(object: string): string {
  return PIPELINE_OBJECTS.find((o) => o.value === object)?.label ?? object;
}

/** Stable client-side id for unsaved stage rows. */
function tempId(): string {
  return `tmp_${Math.random().toString(36).slice(2, 10)}`;
}

/** A fresh draft pipeline (not yet persisted; `id` is empty until created). */
function newDraft(): Pipeline {
  return {
    id: '',
    name: 'New pipeline',
    object: PIPELINE_OBJECTS[0].value,
    stages: [
      { id: tempId(), label: 'New', color: '--zoru-gray' },
      { id: tempId(), label: 'In progress', color: '--zoru-blue' },
      { id: tempId(), label: 'Won', color: '--zoru-green' },
      { id: tempId(), label: 'Lost', color: '--zoru-red' },
    ],
    isDefault: false,
  };
}

/** Compare two pipelines for editor dirty-state (order-sensitive on stages). */
function pipelineEquals(a: Pipeline, b: Pipeline): boolean {
  if (
    a.name !== b.name ||
    a.object !== b.object ||
    Boolean(a.isDefault) !== Boolean(b.isDefault) ||
    a.stages.length !== b.stages.length
  ) {
    return false;
  }
  return a.stages.every((s, i) => {
    const o = b.stages[i];
    return o && s.id === o.id && s.label === o.label && s.color === o.color;
  });
}

// ---------------------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------------------

function ErrorBanner({ message }: { message: string }): React.JSX.Element {
  return (
    <div className="st-banner" role="alert">
      <AlertTriangle className="st-banner__icon" size={15} />
      <span>{message}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Colour-swatch picker (popover) — mirrors the Data Model option editor.
// ---------------------------------------------------------------------------

function ColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (token: string) => void;
}): React.JSX.Element {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  return (
    <div className="pl-color" ref={ref}>
      <button
        type="button"
        className="pl-color__trigger"
        aria-label="Pick stage colour"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span
          className="pl-swatch"
          style={{ background: swatchFor(value) }}
          aria-hidden="true"
        />
      </button>
      {open ? (
        <div className="pl-color__pop" role="listbox" aria-label="Colours">
          {STAGE_PALETTE.map((c) => (
            <button
              key={c.token}
              type="button"
              role="option"
              aria-selected={c.token === value}
              className="pl-color__cell"
              title={c.name}
              onClick={() => {
                onChange(c.token);
                setOpen(false);
              }}
            >
              <span
                className="pl-swatch pl-swatch--lg"
                style={{ background: c.swatch }}
                aria-hidden="true"
              />
              {c.token === value ? (
                <Check className="pl-color__check" size={12} />
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stages editor — ordered rows of swatch + label, with add/remove/reorder.
// ---------------------------------------------------------------------------

function StagesEditor({
  stages,
  onChange,
}: {
  stages: PipelineStage[];
  onChange: (next: PipelineStage[]) => void;
}): React.JSX.Element {
  const update = (idx: number, patch: Partial<PipelineStage>) => {
    onChange(stages.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  };

  const move = (idx: number, dir: -1 | 1) => {
    const next = [...stages];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange(next);
  };

  const remove = (idx: number) => {
    onChange(stages.filter((_, i) => i !== idx));
  };

  const add = () => {
    onChange([
      ...stages,
      { id: tempId(), label: '', color: DEFAULT_STAGE_COLOR },
    ]);
  };

  return (
    <div className="pl-field">
      <span className="st-field__label">Stages</span>
      <div className="pl-stages">
        {stages.length === 0 ? (
          <p className="pl-stages__empty">
            No stages yet. Add one to start the pipeline.
          </p>
        ) : (
          stages.map((stage, idx) => (
            <div className="pl-stage" key={stage.id}>
              <span className="pl-stage__grip" aria-hidden="true">
                <GripVertical size={14} />
              </span>
              <ColorPicker
                value={stage.color || DEFAULT_STAGE_COLOR}
                onChange={(token) => update(idx, { color: token })}
              />
              <input
                className="st-input pl-stage__label"
                value={stage.label}
                placeholder={`Stage ${idx + 1}`}
                autoComplete="off"
                aria-label={`Stage ${idx + 1} label`}
                onChange={(e) => update(idx, { label: e.target.value })}
              />
              <div className="pl-stage__order">
                <button
                  type="button"
                  className="pl-iconbtn"
                  aria-label="Move stage up"
                  disabled={idx === 0}
                  onClick={() => move(idx, -1)}
                >
                  <ArrowUp size={13} />
                </button>
                <button
                  type="button"
                  className="pl-iconbtn"
                  aria-label="Move stage down"
                  disabled={idx === stages.length - 1}
                  onClick={() => move(idx, 1)}
                >
                  <ArrowDown size={13} />
                </button>
              </div>
              <button
                type="button"
                className="pl-iconbtn pl-iconbtn--danger"
                aria-label={`Remove stage ${stage.label || idx + 1}`}
                onClick={() => remove(idx)}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))
        )}
        <button type="button" className="pl-stages__add" onClick={add}>
          <Plus size={14} />
          Add stage
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Left pane — pipeline list
// ---------------------------------------------------------------------------

function PipelineList({
  pipelines,
  activeId,
  dirtyId,
  onSelect,
}: {
  pipelines: Pipeline[];
  activeId: string | null;
  /** id of a pipeline (or '' for a draft) with unsaved edits, for a dot. */
  dirtyId: string | null;
  onSelect: (id: string) => void;
}): React.JSX.Element {
  return (
    <nav className="pl-list" aria-label="Pipelines">
      {pipelines.map((p) => {
        const id = p.id || '';
        const active = id === activeId || (p.id === '' && activeId === '');
        const dirty = dirtyId !== null && dirtyId === id;
        return (
          <button
            key={p.id || 'draft'}
            type="button"
            className={`pl-item${active ? ' active' : ''}`}
            aria-current={active ? 'true' : undefined}
            onClick={() => onSelect(id)}
          >
            <span className="pl-item__icon" aria-hidden="true">
              <Workflow size={15} />
            </span>
            <span className="pl-item__body">
              <span className="pl-item__label">
                {p.name || 'Untitled pipeline'}
                {dirty ? (
                  <span className="pl-item__dirty" title="Unsaved changes" />
                ) : null}
              </span>
              <span className="pl-item__meta">
                {p.stages.length}{' '}
                {p.stages.length === 1 ? 'stage' : 'stages'} ·{' '}
                {objectLabel(p.object)}
              </span>
            </span>
            {p.isDefault ? (
              <span className="pl-item__badge">Default</span>
            ) : null}
          </button>
        );
      })}
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Right pane — pipeline editor
// ---------------------------------------------------------------------------

interface EditorProps {
  /** The persisted/original pipeline (drives the dirty diff). */
  original: Pipeline;
  /** The in-progress draft the user is editing. */
  draft: Pipeline;
  saving: boolean;
  deleting: boolean;
  error: string | null;
  onChange: (next: Pipeline) => void;
  onSave: () => void;
  onDelete: () => void;
}

function PipelineEditor({
  original,
  draft,
  saving,
  deleting,
  error,
  onChange,
  onSave,
  onDelete,
}: EditorProps): React.JSX.Element {
  const isNew = draft.id === '';
  const dirty = isNew || !pipelineEquals(original, draft);

  const stagesValid =
    draft.stages.length > 0 &&
    draft.stages.every((s) => s.label.trim().length > 0);
  const nameValid = draft.name.trim().length > 0;
  const canSave = dirty && nameValid && stagesValid && !saving && !deleting;

  return (
    <section className="pl-editor" aria-label="Pipeline editor">
      <div className="pl-editor__head">
        <div className="pl-editor__title-wrap">
          <h2 className="pl-editor__title">
            <Workflow size={18} aria-hidden="true" />
            {isNew ? 'New pipeline' : original.name}
          </h2>
          {draft.isDefault ? (
            <span className="pl-item__badge pl-item__badge--lg">Default</span>
          ) : null}
        </div>
        <div className="pl-editor__actions">
          {!isNew ? (
            <TwentyButton
              variant="ghost"
              className="st-btn--danger"
              icon={Trash2}
              onClick={onDelete}
              disabled={saving || deleting}
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </TwentyButton>
          ) : null}
          <button
            type="button"
            className="st-btn st-btn--primary"
            disabled={!canSave}
            onClick={onSave}
          >
            {saving ? <Loader2 size={14} className="st-spin" /> : null}
            {isNew ? 'Create pipeline' : 'Save changes'}
          </button>
        </div>
      </div>

      <div className="pl-editor__body">
        <div className="pl-field">
          <label className="st-field__label" htmlFor="pl-name">
            Name<span className="st-field__req">*</span>
          </label>
          <input
            id="pl-name"
            className="st-input"
            value={draft.name}
            placeholder="Sales pipeline"
            autoComplete="off"
            onChange={(e) => onChange({ ...draft, name: e.target.value })}
          />
        </div>

        <div className="pl-field">
          <label className="st-field__label" htmlFor="pl-object">
            Object
          </label>
          <select
            id="pl-object"
            className="st-select"
            value={draft.object}
            onChange={(e) => onChange({ ...draft, object: e.target.value })}
          >
            {PIPELINE_OBJECTS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
            {/* Preserve an unknown stored object so it round-trips. */}
            {PIPELINE_OBJECTS.some((o) => o.value === draft.object) ? null : (
              <option value={draft.object}>{draft.object}</option>
            )}
          </select>
        </div>

        <StagesEditor
          stages={draft.stages}
          onChange={(stages) => onChange({ ...draft, stages })}
        />

        <label className="pl-default">
          <button
            type="button"
            role="switch"
            aria-checked={Boolean(draft.isDefault)}
            className={`pl-switch${draft.isDefault ? ' is-on' : ''}`}
            onClick={() =>
              onChange({ ...draft, isDefault: !draft.isDefault })
            }
          >
            <span className="pl-switch__knob" aria-hidden="true" />
          </button>
          <span className="pl-default__text">
            <span className="pl-default__title">
              <Star size={14} aria-hidden="true" />
              Set as default pipeline
            </span>
            <span className="pl-default__hint">
              New {objectLabel(draft.object).toLowerCase()} land in this
              pipeline unless another is chosen.
            </span>
          </span>
        </label>

        {error ? <ErrorBanner message={error} /> : null}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Delete confirmation
// ---------------------------------------------------------------------------

function DeleteDialog({
  pipeline,
  busy,
  onCancel,
  onConfirm,
}: {
  pipeline: Pipeline;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}): React.JSX.Element {
  return (
    <div
      className="st-dialog-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Delete pipeline"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="st-dialog">
        <div className="st-dialog__header">
          <h2 className="st-dialog__title">Delete pipeline</h2>
          <button
            type="button"
            className="st-dialog__close"
            onClick={onCancel}
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>
        <div className="st-dialog__body">
          <p style={{ margin: 0, color: 'var(--st-text-secondary)' }}>
            Delete the pipeline{' '}
            <strong style={{ color: 'var(--st-text)' }}>
              {pipeline.name || 'Untitled pipeline'}
            </strong>
            ? Its stages will be removed. This cannot be undone.
          </p>
        </div>
        <div className="st-dialog__footer">
          <TwentyButton variant="secondary" onClick={onCancel} disabled={busy}>
            Cancel
          </TwentyButton>
          <TwentyButton
            variant="secondary"
            className="st-btn--danger"
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? 'Deleting…' : 'Delete pipeline'}
          </TwentyButton>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SabcrmPipelinesSettingsPage(): React.JSX.Element {
  const { activeProjectId, isLoadingProject } = useProject();

  const [pipelines, setPipelines] = React.useState<Pipeline[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Selection: an id, '' for the in-list unsaved draft, or null when none.
  const [activeId, setActiveId] = React.useState<string | null>(null);
  /** The working copy of the selected pipeline (drives the editor). */
  const [draft, setDraft] = React.useState<Pipeline | null>(null);
  /** The pristine copy of the selected pipeline (drives the dirty diff). */
  const [original, setOriginal] = React.useState<Pipeline | null>(null);

  const [saving, setSaving] = React.useState(false);
  const [editorError, setEditorError] = React.useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = React.useState<Pipeline | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  // ----- Load -----

  const selectInto = React.useCallback((p: Pipeline) => {
    setActiveId(p.id);
    setDraft({ ...p, stages: p.stages.map((s) => ({ ...s })) });
    setOriginal({ ...p, stages: p.stages.map((s) => ({ ...s })) });
    setEditorError(null);
  }, []);

  React.useEffect(() => {
    if (isLoadingProject) return;
    if (!activeProjectId) {
      setLoading(false);
      setPipelines([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      const res = await listPipelinesTw(activeProjectId);
      if (cancelled) return;
      if (!res.ok) {
        setError(res.error);
        setPipelines([]);
      } else {
        setPipelines(res.data);
        // Auto-select the default (or first) pipeline if nothing is selected.
        setActiveId((prev) => {
          if (prev !== null && (prev === '' || res.data.some((p) => p.id === prev))) {
            return prev;
          }
          const first = res.data.find((p) => p.isDefault) ?? res.data[0];
          if (first) {
            setDraft({ ...first, stages: first.stages.map((s) => ({ ...s })) });
            setOriginal({ ...first, stages: first.stages.map((s) => ({ ...s })) });
            return first.id;
          }
          setDraft(null);
          setOriginal(null);
          return null;
        });
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
    // selectInto is stable; intentionally only re-run on project change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProjectId, isLoadingProject]);

  // ----- Selection -----

  const handleSelect = React.useCallback(
    (id: string) => {
      if (id === '') {
        // The unsaved draft is whatever is already in `draft` when id===''.
        setActiveId('');
        return;
      }
      const p = pipelines.find((x) => x.id === id);
      if (p) selectInto(p);
    },
    [pipelines, selectInto],
  );

  const handleNew = React.useCallback(() => {
    const d = newDraft();
    setActiveId('');
    setDraft(d);
    setOriginal(d);
    setEditorError(null);
  }, []);

  // The list shows persisted pipelines, plus the draft row when one is active.
  const listPipelines = React.useMemo<Pipeline[]>(() => {
    if (activeId === '' && draft) return [...pipelines, draft];
    return pipelines;
  }, [pipelines, activeId, draft]);

  const dirtyId = React.useMemo<string | null>(() => {
    if (!draft || !original) return null;
    if (draft.id === '') return ''; // a new draft is always "dirty"
    return pipelineEquals(original, draft) ? null : draft.id;
  }, [draft, original]);

  // ----- Save -----

  const handleSave = React.useCallback(async () => {
    if (!draft || !activeProjectId) return;
    setSaving(true);
    setEditorError(null);

    const input: PipelineInput = {
      name: draft.name.trim(),
      object: draft.object,
      isDefault: Boolean(draft.isDefault),
      stages: draft.stages.map((s) => ({
        id: s.id,
        label: s.label.trim(),
        color: s.color || DEFAULT_STAGE_COLOR,
      })),
    };

    const res = draft.id
      ? await updatePipelineTw(draft.id, input, activeProjectId)
      : await createPipelineTw({ ...input }, activeProjectId);

    setSaving(false);
    if (!res.ok) {
      setEditorError(res.error);
      return;
    }

    const saved = res.data as Pipeline;
    // Re-fetch the canonical pipeline so server-assigned ids / default-flag
    // adjustments (only one default) are reflected; fall back to the response.
    const refreshed = await getPipelineTw(saved.id, activeProjectId);
    const canonical: Pipeline = refreshed.ok ? (refreshed.data as Pipeline) : saved;

    setPipelines((prev) => {
      const exists = prev.some((p) => p.id === canonical.id);
      const next = exists
        ? prev.map((p) => (p.id === canonical.id ? canonical : p))
        : [...prev, canonical];
      // Saving a default un-defaults the others in our local copy.
      return canonical.isDefault
        ? next.map((p) =>
            p.id === canonical.id ? p : { ...p, isDefault: false },
          )
        : next;
    });
    selectInto(canonical);
  }, [draft, activeProjectId, selectInto]);

  // ----- Delete -----

  const confirmDelete = React.useCallback(async () => {
    if (!deleteTarget || !activeProjectId || !deleteTarget.id) return;
    setDeleting(true);
    setEditorError(null);
    const res = await deletePipelineTw(deleteTarget.id, activeProjectId);
    setDeleting(false);
    if (!res.ok) {
      setEditorError(res.error);
      setDeleteTarget(null);
      return;
    }
    setPipelines((prev) => {
      const next = prev.filter((p) => p.id !== deleteTarget.id);
      // Move selection to the new default/first, or clear it.
      const fallback = next.find((p) => p.isDefault) ?? next[0] ?? null;
      if (fallback) {
        setActiveId(fallback.id);
        setDraft({ ...fallback, stages: fallback.stages.map((s) => ({ ...s })) });
        setOriginal({ ...fallback, stages: fallback.stages.map((s) => ({ ...s })) });
      } else {
        setActiveId(null);
        setDraft(null);
        setOriginal(null);
      }
      return next;
    });
    setDeleteTarget(null);
  }, [deleteTarget, activeProjectId]);

  // ----- Render -----

  const headerActions =
    activeProjectId && !error ? (
      <TwentyButton variant="primary" icon={Plus} onClick={handleNew} disabled={loading}>
        New
      </TwentyButton>
    ) : null;

  return (
    <div className="st-page">
      <div className="st-settings">
        <TwentyPageHeader title="Pipelines" icon={Workflow} actions={headerActions} />
        <p className="st-settings__intro">
          Sales pipelines and their stages. Records move left-to-right through a
          pipeline&apos;s stages; the default pipeline catches new records.
        </p>

        {isLoadingProject || loading ? (
          <div className="pl-layout">
            <div className="st-table-wrap" style={{ padding: 'var(--st-space-3)' }}>
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="st-skeleton st-skeleton-row" />
              ))}
            </div>
            <div className="st-table-wrap" style={{ padding: 'var(--st-space-3)' }}>
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="st-skeleton st-skeleton-row" />
              ))}
            </div>
          </div>
        ) : !activeProjectId ? (
          <div className="st-empty">
            <span className="st-empty__icon">
              <AlertTriangle size={20} />
            </span>
            <h2 className="st-empty__title">No project selected</h2>
            <p className="st-empty__desc">
              Select a project to manage its sales pipelines.
            </p>
          </div>
        ) : error ? (
          <ErrorBanner message={error} />
        ) : pipelines.length === 0 && activeId !== '' ? (
          <div className="st-empty">
            <span className="st-empty__icon">
              <Workflow size={20} />
            </span>
            <h2 className="st-empty__title">No pipelines yet</h2>
            <p className="st-empty__desc">
              Create your first sales pipeline to organise records into stages.
            </p>
            <TwentyButton variant="primary" icon={Plus} onClick={handleNew}>
              New pipeline
            </TwentyButton>
          </div>
        ) : (
          <div className="pl-layout">
            <PipelineList
              pipelines={listPipelines}
              activeId={activeId}
              dirtyId={dirtyId}
              onSelect={handleSelect}
            />

            {draft && original ? (
              <PipelineEditor
                original={original}
                draft={draft}
                saving={saving}
                deleting={deleting}
                error={editorError}
                onChange={setDraft}
                onSave={handleSave}
                onDelete={() => setDeleteTarget(draft)}
              />
            ) : (
              <div className="pl-editor__placeholder">
                Select a pipeline to edit its stages, or create a new one.
              </div>
            )}
          </div>
        )}
      </div>

      {deleteTarget ? (
        <DeleteDialog
          pipeline={deleteTarget}
          busy={deleting}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={confirmDelete}
        />
      ) : null}
    </div>
  );
}
