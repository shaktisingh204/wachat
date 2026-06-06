'use client';

/**
 * SabCRM — Tags settings (`/dashboard/settings/crm/tags`), Twenty-style.
 *
 * A single surface that lists the workspace's tags as Twenty-style coloured
 * chips, each with a name and a record-count placeholder. From here a user can:
 *
 *   - "New tag"      → name + colour from the fixed Twenty palette → createTagTw
 *   - edit a tag     → rename / recolour in place                  → updateTagTw
 *   - delete a tag   → confirm, then remove                        → deleteTagTw
 *
 * Mutations go through the gated server actions in
 * `@/app/actions/sabcrm-tags.actions`, each of which independently re-runs the
 * session → project → RBAC → plan pipeline server-side, so the page fails
 * closed. The CRM engine may be DOWN; every call returns an `ActionResult`, so
 * the page degrades to loading / empty / error states and never crashes.
 *
 * Auth / RBAC / project context are enforced by the parent `../../layout.tsx`;
 * the actions re-run the full gate. NO ZoruUI / Tailwind / clay here — Twenty
 * look only (the shared `.st-*` kit + the sibling `./tags.css`).
 */

import * as React from 'react';
import {
  Tag,
  Tags as TagsIcon,
  Plus,
  AlertTriangle,
  Loader2,
  X,
  Check,
  Pencil,
  Trash2,
} from 'lucide-react';

import { TwentyPageHeader, TwentyButton } from '@/components/sabcrm/twenty';
import { useProject } from '@/context/project-context';
import {
  listTagsTw,
  createTagTw,
  updateTagTw,
  deleteTagTw,
} from '@/app/actions/sabcrm-tags.actions';

import '@/components/sabcrm/20ui/surface-crm-base.css';
import './tags.css';

// ---------------------------------------------------------------------------
// Tag wire shape
//
// Declared locally to keep this client page free of any `server-only` import.
// Mirrors the `{ id, name, color, createdAt }` payload documented in the
// `@/app/actions/sabcrm-tags.actions` contract.
// ---------------------------------------------------------------------------

interface CrmTag {
  id: string;
  name: string;
  color?: string;
  createdAt: string;
  /** Optional usage count if the engine reports one; placeholder otherwise. */
  recordCount?: number;
}

// ---------------------------------------------------------------------------
// Twenty tag-colour palette
//
// `token` is what we persist (a `--zoru-*` name, to stay consistent with the
// seeded schema) and `swatch` is the literal hex painted in the picker / chip —
// this page renders under the `.sabcrm-twenty` scope where `--zoru-*` vars are
// NOT in scope, so the swatch must be a concrete colour.
// ---------------------------------------------------------------------------

interface PaletteColor {
  name: string;
  token: string;
  swatch: string;
}

const TAG_PALETTE: ReadonlyArray<PaletteColor> = [
  { name: 'Green', token: '--zoru-green', swatch: '#3dab5a' },
  { name: 'Turquoise', token: '--zoru-turquoise', swatch: '#21b8a6' },
  { name: 'Sky', token: '--zoru-sky', swatch: '#5db4e3' },
  { name: 'Blue', token: '--zoru-blue', swatch: '#3b7ae4' },
  { name: 'Purple', token: '--zoru-purple', swatch: '#9b51e0' },
  { name: 'Pink', token: '--zoru-pink', swatch: '#e052b0' },
  { name: 'Red', token: '--zoru-red', swatch: '#e0484e' },
  { name: 'Orange', token: '--zoru-orange', swatch: '#f0883e' },
  { name: 'Yellow', token: '--zoru-yellow', swatch: '#e0c64a' },
  { name: 'Gray', token: '--zoru-gray', swatch: '#8c8c8c' },
];

const DEFAULT_TAG_COLOR = TAG_PALETTE[0].token;

/** Resolve a stored tag colour (token or hex) to a paintable swatch. */
function swatchFor(color: string | undefined): string {
  if (!color) return TAG_PALETTE[0].swatch;
  const match = TAG_PALETTE.find((c) => c.token === color);
  if (match) return match.swatch;
  // Already a hex / concrete colour → paint as-is, else fall back.
  return /^#|^rgb|^hsl/.test(color) ? color : TAG_PALETTE[0].swatch;
}

/** Human label for a stored colour, for titles / a11y. */
function colorName(color: string | undefined): string {
  if (!color) return TAG_PALETTE[0].name;
  return TAG_PALETTE.find((c) => c.token === color)?.name ?? 'Custom';
}

// ---------------------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------------------

function ErrorBanner({ message }: { message: string }): React.JSX.Element {
  return (
    <div className="st-banner" role="alert">
      <AlertTriangle className="st-banner__icon" size={16} />
      <span>{message}</span>
    </div>
  );
}

function RowsSkeleton({ count = 5 }: { count?: number }): React.JSX.Element {
  return (
    <div className="st-table-wrap p-[var(--st-space-3)]">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="st-skeleton st-skeleton-row" />
      ))}
    </div>
  );
}

/** A coloured tag chip — swatch dot + name. */
function TagChip({ tag }: { tag: CrmTag }): React.JSX.Element {
  return (
    <span className="st-chip tg-chip">
      <span
        className="st-chip__dot"
        style={{ background: swatchFor(tag.color) }}
        aria-hidden="true"
      />
      <span className="st-chip__label">{tag.name}</span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Colour-swatch picker — Twenty style popover
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
    <div className="tg-color" ref={ref}>
      <button
        type="button"
        className="tg-color__trigger"
        aria-label={`Pick tag colour (current: ${colorName(value)})`}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span
          className="tg-swatch"
          style={{ background: swatchFor(value) }}
          aria-hidden="true"
        />
        <span className="tg-color__name">{colorName(value)}</span>
      </button>
      {open ? (
        <div className="tg-color__pop" role="listbox" aria-label="Tag colours">
          {TAG_PALETTE.map((c) => (
            <button
              key={c.token}
              type="button"
              role="option"
              aria-selected={c.token === value}
              className="tg-color__cell"
              title={c.name}
              onClick={() => {
                onChange(c.token);
                setOpen(false);
              }}
            >
              <span
                className="tg-swatch tg-swatch--lg"
                style={{ background: c.swatch }}
                aria-hidden="true"
              />
              {c.token === value ? (
                <Check className="tg-color__check" size={12} />
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tag dialog — create a new tag OR edit an existing one
// ---------------------------------------------------------------------------

interface TagDialogProps {
  projectId: string;
  /** When set, edit this tag; otherwise create a new one. */
  editing: CrmTag | null;
  existingNames: ReadonlySet<string>;
  onClose: () => void;
  onSaved: (tag: CrmTag) => void;
}

function TagDialog({
  projectId,
  editing,
  existingNames,
  onClose,
  onSaved,
}: TagDialogProps): React.JSX.Element {
  const [name, setName] = React.useState(editing?.name ?? '');
  const [color, setColor] = React.useState(editing?.color ?? DEFAULT_TAG_COLOR);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const trimmed = name.trim();
  const nameTaken =
    trimmed.length > 0 &&
    trimmed.toLowerCase() !== (editing?.name ?? '').trim().toLowerCase() &&
    existingNames.has(trimmed.toLowerCase());
  const canSubmit = trimmed.length > 0 && !nameTaken && !saving;

  const handleSubmit = React.useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!canSubmit) return;
      setSaving(true);
      setError(null);
      try {
        const res = editing
          ? await updateTagTw(
              editing.id,
              { name: trimmed, color },
              projectId,
            )
          : await createTagTw({ name: trimmed, color }, projectId);
        if (res.ok) {
          onSaved(res.data as CrmTag);
        } else {
          setError(res.error);
        }
      } catch {
        setError('Failed to save the tag. The service may be unavailable.');
      } finally {
        setSaving(false);
      }
    },
    [canSubmit, editing, trimmed, color, projectId, onSaved],
  );

  return (
    <div
      className="st-dialog-overlay"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="st-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={editing ? `Edit tag ${editing.name}` : 'New tag'}
        style={{ maxWidth: 440 }}
      >
        <form onSubmit={handleSubmit}>
          <div className="st-dialog__header">
            <h2 className="st-dialog__title">
              {editing ? 'Edit tag' : 'New tag'}
            </h2>
            <button
              type="button"
              className="st-dialog__close"
              onClick={onClose}
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>

          <div className="st-dialog__body">
            <div className="st-field">
              <label className="st-field__label" htmlFor="tag-name">
                Name<span className="st-field__req">*</span>
              </label>
              <input
                id="tag-name"
                className="st-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Lead"
                autoComplete="off"
                autoFocus
                aria-invalid={nameTaken}
              />
              {nameTaken ? (
                <span className="st-form-error">
                  A tag with this name already exists.
                </span>
              ) : null}
            </div>

            <div className="st-field">
              <span className="st-field__label">Colour</span>
              <ColorPicker value={color} onChange={setColor} />
            </div>

            <div className="st-field">
              <span className="st-field__label">Preview</span>
              <TagChip
                tag={{
                  id: '__preview__',
                  name: trimmed || 'Tag name',
                  color,
                  createdAt: '',
                }}
              />
            </div>

            {error ? <ErrorBanner message={error} /> : null}
          </div>

          <div className="st-dialog__footer">
            <TwentyButton variant="secondary" onClick={onClose} disabled={saving}>
              Cancel
            </TwentyButton>
            <button
              type="submit"
              className="st-btn st-btn--primary"
              disabled={!canSubmit}
            >
              {saving ? <Loader2 size={14} className="st-spin" /> : null}
              {editing ? 'Save changes' : 'Create tag'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Delete confirmation
// ---------------------------------------------------------------------------

interface DeleteTagDialogProps {
  tag: CrmTag;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

function DeleteTagDialog({
  tag,
  busy,
  onCancel,
  onConfirm,
}: DeleteTagDialogProps): React.JSX.Element {
  return (
    <div
      className="st-dialog-overlay"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        className="st-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Delete tag"
      >
        <div className="st-dialog__header">
          <h2 className="st-dialog__title">Delete tag</h2>
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
          <p className="m-0 text-[var(--st-text-secondary)]">
            Delete the tag{' '}
            <TagChip tag={tag} />? It will be removed from every record it is
            applied to. This cannot be undone.
          </p>
        </div>
        <div className="st-dialog__footer">
          <TwentyButton variant="secondary" onClick={onCancel} disabled={busy}>
            Cancel
          </TwentyButton>
          <button
            type="button"
            className="st-btn st-btn--secondary st-btn--danger"
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? <Loader2 size={14} className="st-spin" /> : null}
            Delete tag
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tag row
// ---------------------------------------------------------------------------

function TagRow({
  tag,
  busy,
  onEdit,
  onDelete,
}: {
  tag: CrmTag;
  busy: boolean;
  onEdit: (tag: CrmTag) => void;
  onDelete: (tag: CrmTag) => void;
}): React.JSX.Element {
  const count = typeof tag.recordCount === 'number' ? tag.recordCount : 0;
  return (
    <tr className="st-row">
      <td>
        <TagChip tag={tag} />
      </td>
      <td className="text-[var(--st-text-secondary)]">
        {count} {count === 1 ? 'record' : 'records'}
      </td>
      <td className="tg-col-actions">
        <button
          type="button"
          className="tg-iconbtn"
          aria-label={`Edit tag ${tag.name}`}
          title={`Edit ${tag.name}`}
          disabled={busy}
          onClick={() => onEdit(tag)}
        >
          <Pencil size={14} />
        </button>
        <button
          type="button"
          className="tg-iconbtn tg-iconbtn--danger"
          aria-label={`Delete tag ${tag.name}`}
          title={`Delete ${tag.name}`}
          disabled={busy}
          onClick={() => onDelete(tag)}
        >
          {busy ? <Loader2 size={14} className="st-spin" /> : <Trash2 size={14} />}
        </button>
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SabcrmTagsSettingsPage(): React.JSX.Element {
  const { activeProjectId, isLoadingProject } = useProject();

  const [tags, setTags] = React.useState<CrmTag[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [mutationError, setMutationError] = React.useState<string | null>(null);

  // Dialog / row state
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<CrmTag | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<CrmTag | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const loadTags = React.useCallback(async (projectId: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await listTagsTw(projectId);
      if (res.ok) {
        setTags(res.data as CrmTag[]);
      } else {
        setError(res.error);
      }
    } catch {
      setError('Tags could not be loaded. The service may be unavailable.');
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
    void loadTags(activeProjectId);
  }, [activeProjectId, isLoadingProject, loadTags]);

  // ----- Derived -----

  const sortedTags = React.useMemo(
    () =>
      [...tags].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
      ),
    [tags],
  );

  const existingNames = React.useMemo(
    () => new Set(tags.map((t) => t.name.trim().toLowerCase())),
    [tags],
  );

  // ----- Mutations -----

  const handleSaved = React.useCallback((tag: CrmTag) => {
    setTags((prev) => {
      const exists = prev.some((t) => t.id === tag.id);
      return exists
        ? prev.map((t) => (t.id === tag.id ? { ...t, ...tag } : t))
        : [...prev, tag];
    });
    setDialogOpen(false);
    setEditing(null);
  }, []);

  const confirmDelete = React.useCallback(async () => {
    if (!deleteTarget || !activeProjectId) return;
    setDeleting(true);
    setMutationError(null);
    try {
      const res = await deleteTagTw(deleteTarget.id, activeProjectId);
      if (res.ok) {
        setTags((prev) => prev.filter((t) => t.id !== deleteTarget.id));
        setDeleteTarget(null);
      } else {
        setMutationError(res.error);
        setDeleteTarget(null);
      }
    } catch {
      setMutationError('Failed to delete the tag. The service may be unavailable.');
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget, activeProjectId]);

  const openCreate = React.useCallback(() => {
    setEditing(null);
    setMutationError(null);
    setDialogOpen(true);
  }, []);

  const openEdit = React.useCallback((tag: CrmTag) => {
    setEditing(tag);
    setMutationError(null);
    setDialogOpen(true);
  }, []);

  // ----- Render -----

  return (
    <div className="st-page">
      <div className="st-settings">
        <TwentyPageHeader
          title="Tags"
          icon={TagsIcon}
          actions={
            activeProjectId ? (
              <TwentyButton
                variant="primary"
                icon={Plus}
                onClick={openCreate}
                disabled={loading || !!error}
              >
                New tag
              </TwentyButton>
            ) : null
          }
        />
        <p className="st-settings__intro">
          Tags label and group records across SabCRM. Create a tag, pick a colour
          from the palette, then apply it to any record. Renaming or recolouring a
          tag updates it everywhere it&apos;s used.
        </p>

        {mutationError ? <ErrorBanner message={mutationError} /> : null}

        {isLoadingProject || loading ? (
          <RowsSkeleton />
        ) : !activeProjectId ? (
          <div className="st-empty">
            <span className="st-empty__icon">
              <AlertTriangle size={20} />
            </span>
            <h2 className="st-empty__title">No project selected</h2>
            <p className="st-empty__desc">Select a project to manage its tags.</p>
          </div>
        ) : error ? (
          <ErrorBanner message={error} />
        ) : sortedTags.length === 0 ? (
          <div className="st-empty">
            <span className="st-empty__icon">
              <Tag size={20} />
            </span>
            <h2 className="st-empty__title">No tags yet</h2>
            <p className="st-empty__desc">
              Create your first tag to start labelling and grouping records.
            </p>
            <TwentyButton variant="primary" icon={Plus} onClick={openCreate}>
              New tag
            </TwentyButton>
          </div>
        ) : (
          <>
            <div className="st-table-wrap">
              <table className="st-table">
                <thead>
                  <tr>
                    <th>Tag</th>
                    <th>Usage</th>
                    <th className="tg-col-actions" aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {sortedTags.map((tag) => (
                    <TagRow
                      key={tag.id}
                      tag={tag}
                      busy={deleting && deleteTarget?.id === tag.id}
                      onEdit={openEdit}
                      onDelete={setDeleteTarget}
                    />
                  ))}
                </tbody>
              </table>
            </div>
            <p className="st-footnote">
              {sortedTags.length} tag{sortedTags.length !== 1 ? 's' : ''}
            </p>
          </>
        )}
      </div>

      {dialogOpen && activeProjectId ? (
        <TagDialog
          projectId={activeProjectId}
          editing={editing}
          existingNames={existingNames}
          onClose={() => {
            setDialogOpen(false);
            setEditing(null);
          }}
          onSaved={handleSaved}
        />
      ) : null}

      {deleteTarget ? (
        <DeleteTagDialog
          tag={deleteTarget}
          busy={deleting}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={confirmDelete}
        />
      ) : null}
    </div>
  );
}
