'use client';

/**
 * SabCRM Settings — Saved Views (`/dashboard/settings/crm/views`), Twenty-style.
 *
 * Presents every saved view in the active project, grouped by object. Each
 * group is a Twenty-style table listing the view name, its kind (table / board)
 * as a chip, and a default star. Within each row, users with the `sabcrm:manage`
 * capability can:
 *   - Rename a view inline (saveViewAction update path)
 *   - Mark a view as the object default (setDefaultViewAction)
 *   - Delete a view (deleteViewAction)
 *
 * All mutations go through the gated server actions in
 * `src/app/actions/sabcrm.actions.ts`; the gate re-runs
 * session → project → RBAC → plan → Mongo so direct API access fails closed.
 * Auth / onboarding guards are enforced upstream by `../../layout.tsx`.
 *
 * Twenty visual language only (`.st-*` + views-automations.css). No ZoruUI,
 * no Tailwind. The `.sabcrm-twenty` scope is applied by TwentyAppFrame.
 */

import * as React from 'react';
import {
  Eye,
  Star,
  Pencil,
  Trash2,
  Check,
  X,
  Table2,
  Columns3,
  AlertTriangle,
  Loader2,
} from 'lucide-react';

import { TwentyPageHeader, TwentyButton } from '@/components/sabcrm/twenty';
import { useProject } from '@/context/project-context';
import {
  listObjectsAction,
  listViewsAction,
  saveViewAction,
  deleteViewAction,
  setDefaultViewAction,
} from '@/app/actions/sabcrm.actions';
import type { SavedView } from '@/app/actions/sabcrm.actions.types';
import type { ObjectMetadata } from '@/lib/sabcrm/types';

import '@/components/sabcrm/20ui/surface-crm-base.css';
import '../settings-twenty.css';
import '../views-automations.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ObjectGroup {
  object: ObjectMetadata;
  views: SavedView[];
}

// ---------------------------------------------------------------------------
// Inline rename row
// ---------------------------------------------------------------------------

interface RenameRowProps {
  initial: string;
  saving: boolean;
  onSave: (name: string) => void;
  onCancel: () => void;
}

function RenameRow({ initial, saving, onSave, onCancel }: RenameRowProps): React.JSX.Element {
  const [name, setName] = React.useState(initial);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const commit = React.useCallback(() => {
    const trimmed = name.trim();
    if (trimmed && trimmed !== initial) {
      onSave(trimmed);
    } else {
      onCancel();
    }
  }, [name, initial, onSave, onCancel]);

  return (
    <form
      className="st-rename"
      onSubmit={(e) => {
        e.preventDefault();
        commit();
      }}
    >
      <input
        ref={inputRef}
        className="st-cell-input"
        value={name}
        disabled={saving}
        aria-label="New view name"
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onCancel();
        }}
      />
      <button
        type="submit"
        className="st-icon-btn"
        disabled={saving || !name.trim()}
        aria-label="Save name"
        title="Save"
      >
        {saving ? <Loader2 className="st-spin" size={14} /> : <Check size={14} />}
      </button>
      <button
        type="button"
        className="st-icon-btn"
        disabled={saving}
        onClick={onCancel}
        aria-label="Cancel rename"
        title="Cancel"
      >
        <X size={14} />
      </button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// One view row
// ---------------------------------------------------------------------------

interface ViewRowProps {
  view: SavedView;
  objectSlug: string;
  isRenaming: boolean;
  renameSaving: boolean;
  mutating: boolean;
  onStartRename: (id: string) => void;
  onRenameSave: (id: string, name: string) => void;
  onRenameCancel: () => void;
  onSetDefault: (id: string) => void;
  onDelete: (view: SavedView) => void;
}

function ViewRow({
  view,
  objectSlug,
  isRenaming,
  renameSaving,
  mutating,
  onStartRename,
  onRenameSave,
  onRenameCancel,
  onSetDefault,
  onDelete,
}: ViewRowProps): React.JSX.Element {
  const KindIcon = view.kind === 'board' ? Columns3 : Table2;
  const kindLabel = view.kind === 'board' ? 'Board' : 'Table';

  return (
    <tr className="st-row">
      <td>
        {isRenaming ? (
          <RenameRow
            initial={view.name}
            saving={renameSaving}
            onSave={(name) => onRenameSave(view._id, name)}
            onCancel={onRenameCancel}
          />
        ) : (
          <span className="st-name-cell">
            <button
              type="button"
              className={`st-star${view.isDefault ? ' is-default' : ''}`}
              disabled={mutating || view.isDefault}
              aria-label={view.isDefault ? 'Default view' : 'Set as default'}
              title={view.isDefault ? 'Default view' : 'Set as default'}
              onClick={() => onSetDefault(view._id)}
            >
              {mutating ? (
                <Loader2 className="st-spin" size={14} />
              ) : (
                <Star size={14} fill={view.isDefault ? 'currentColor' : 'none'} />
              )}
            </button>
            <span className="st-name-cell__text st-cell-link">{view.name}</span>
            {view.userId ? (
              <span className="st-chip">
                <span className="st-chip__label">Private</span>
              </span>
            ) : null}
          </span>
        )}
      </td>
      <td>
        <span className="st-chip">
          <KindIcon className="st-name-cell__icon" size={12} aria-hidden="true" />
          <span className="st-chip__label">{kindLabel}</span>
        </span>
      </td>
      <td>
        {view.isDefault ? (
          <span className="st-chip st-chip--ok">
            <span className="st-chip__dot" aria-hidden="true" />
            <span className="st-chip__label">Default</span>
          </span>
        ) : (
          <span className="st-muted">—</span>
        )}
      </td>
      <td className="st-cell-actions">
        {!isRenaming ? (
          <>
            <a
              className="st-btn st-btn--ghost"
              href={`/sabcrm/${objectSlug}`}
              title="Open records"
            >
              <Eye size={14} aria-hidden="true" />
              Open
            </a>
            <TwentyButton
              variant="ghost"
              icon={Pencil}
              disabled={mutating}
              onClick={() => onStartRename(view._id)}
              title="Rename view"
            >
              Rename
            </TwentyButton>
            <TwentyButton
              variant="ghost"
              icon={Trash2}
              className="st-btn--danger"
              disabled={mutating}
              onClick={() => onDelete(view)}
              title="Delete view"
            >
              Delete
            </TwentyButton>
          </>
        ) : null}
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Delete confirmation dialog
// ---------------------------------------------------------------------------

interface DeleteDialogProps {
  view: SavedView;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

function DeleteDialog({ view, busy, onCancel, onConfirm }: DeleteDialogProps): React.JSX.Element {
  return (
    <div
      className="st-dialog-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Delete view"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="st-dialog">
        <div className="st-dialog__header">
          <h2 className="st-dialog__title">Delete view</h2>
          <button type="button" className="st-dialog__close" onClick={onCancel} aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <div className="st-dialog__body">
          <p style={{ margin: 0, color: 'var(--st-text-secondary)' }}>
            Delete <strong style={{ color: 'var(--st-text)' }}>{view.name}</strong>? Its filters,
            sort, and layout will be permanently removed. Records are not affected.
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
            {busy ? 'Deleting…' : 'Delete view'}
          </TwentyButton>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// One object group (a Twenty table of that object's views)
// ---------------------------------------------------------------------------

interface ObjectGroupBlockProps {
  group: ObjectGroup;
  projectId: string;
  onViewsChange: (slug: string, views: SavedView[]) => void;
}

function ObjectGroupBlock({ group, projectId, onViewsChange }: ObjectGroupBlockProps): React.JSX.Element {
  const [renamingId, setRenamingId] = React.useState<string | null>(null);
  const [renameSaving, setRenameSaving] = React.useState(false);
  const [mutatingId, setMutatingId] = React.useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<SavedView | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleRenameSave = React.useCallback(
    async (id: string, name: string) => {
      setRenameSaving(true);
      setError(null);
      try {
        const res = await saveViewAction({ id, object: group.object.slug, name }, projectId);
        if (res.ok) {
          setRenamingId(null);
          onViewsChange(
            group.object.slug,
            group.views.map((v) => (v._id === id ? res.data : v)),
          );
        } else {
          setError(res.error);
        }
      } catch {
        setError('Failed to rename the view. The service may be unavailable.');
      } finally {
        setRenameSaving(false);
      }
    },
    [group, projectId, onViewsChange],
  );

  const handleSetDefault = React.useCallback(
    async (id: string) => {
      setMutatingId(id);
      setError(null);
      try {
        const res = await setDefaultViewAction(id, projectId);
        if (res.ok) {
          onViewsChange(
            group.object.slug,
            group.views.map((v) => ({ ...v, isDefault: v._id === id })),
          );
        } else {
          setError(res.error);
        }
      } catch {
        setError('Failed to set the default view. The service may be unavailable.');
      } finally {
        setMutatingId(null);
      }
    },
    [group, projectId, onViewsChange],
  );

  const confirmDelete = React.useCallback(async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await deleteViewAction(deleteTarget._id, projectId);
      if (res.ok) {
        onViewsChange(
          group.object.slug,
          group.views.filter((v) => v._id !== deleteTarget._id),
        );
        setDeleteTarget(null);
      } else {
        setError(res.error);
        setDeleteTarget(null);
      }
    } catch {
      setError('Failed to delete the view. The service may be unavailable.');
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget, group, projectId, onViewsChange]);

  return (
    <section className="st-group">
      <div className="st-group__head">
        <h2 className="st-group__title">{group.object.labelPlural}</h2>
        <span className="st-group__count">
          {group.views.length} {group.views.length === 1 ? 'view' : 'views'}
        </span>
        <span className="st-group__spacer" />
        <a className="st-btn st-btn--secondary" href={`/sabcrm/${group.object.slug}`}>
          Open records
        </a>
      </div>

      {error ? (
        <div className="st-banner">
          <AlertTriangle className="st-banner__icon" size={16} />
          <span>{error}</span>
        </div>
      ) : null}

      <div className="st-table-wrap">
        <table className="st-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Kind</th>
              <th>Default</th>
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {group.views.map((view) => (
              <ViewRow
                key={view._id}
                view={view}
                objectSlug={group.object.slug}
                isRenaming={renamingId === view._id}
                renameSaving={renameSaving}
                mutating={mutatingId === view._id}
                onStartRename={(id) => {
                  setRenamingId(id);
                  setError(null);
                }}
                onRenameSave={handleRenameSave}
                onRenameCancel={() => setRenamingId(null)}
                onSetDefault={handleSetDefault}
                onDelete={setDeleteTarget}
              />
            ))}
          </tbody>
        </table>
      </div>

      {deleteTarget ? (
        <DeleteDialog
          view={deleteTarget}
          busy={deleting}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={confirmDelete}
        />
      ) : null}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function ViewsSkeleton(): React.JSX.Element {
  return (
    <div className="st-table-wrap" style={{ padding: 'var(--st-space-3)' }}>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="st-skeleton st-skeleton-row" />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SabcrmViewsSettingsPage(): React.JSX.Element {
  const { activeProjectId, isLoadingProject } = useProject();

  const [groups, setGroups] = React.useState<ObjectGroup[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async (projectId: string) => {
    setLoading(true);
    setError(null);
    try {
      const objectsRes = await listObjectsAction(projectId);
      if (!objectsRes.ok) {
        setError(objectsRes.error);
        setGroups([]);
        return;
      }

      const pairs = await Promise.all(
        objectsRes.data.map(async (object) => {
          const res = await listViewsAction(object.slug, projectId);
          return { object, views: res.ok ? res.data : [] };
        }),
      );

      // Only surface objects that actually have saved views.
      setGroups(pairs.filter((p) => p.views.length > 0));
    } catch {
      setError('Saved views could not be loaded. The service may be unavailable.');
      setGroups([]);
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
    void load(activeProjectId);
  }, [activeProjectId, isLoadingProject, load]);

  const handleViewsChange = React.useCallback((slug: string, views: SavedView[]) => {
    setGroups((prev) => {
      if (views.length === 0) return prev.filter((g) => g.object.slug !== slug);
      return prev.map((g) => (g.object.slug === slug ? { ...g, views } : g));
    });
  }, []);

  return (
    <div className="st-page">
      <div className="st-settings">
        <TwentyPageHeader title="Views" icon={Eye} />
        <p className="st-settings__intro">
          Manage every saved view across your CRM objects. Rename a view, mark one
          as the object default, or delete views you no longer need. Records are
          never affected.
        </p>

        {error ? (
          <div className="st-banner">
            <AlertTriangle className="st-banner__icon" size={16} />
            <span>{error}</span>
          </div>
        ) : null}

        {isLoadingProject || loading ? (
          <ViewsSkeleton />
        ) : !activeProjectId ? (
          <div className="st-empty">
            <span className="st-empty__icon">
              <AlertTriangle size={20} />
            </span>
            <h2 className="st-empty__title">No project selected</h2>
            <p className="st-empty__desc">Select a project to manage its saved views.</p>
          </div>
        ) : groups.length === 0 ? (
          <div className="st-empty">
            <span className="st-empty__icon">
              <Eye size={20} />
            </span>
            <h2 className="st-empty__title">No saved views yet</h2>
            <p className="st-empty__desc">
              Save a view from any object&rsquo;s toolbar to persist its filters,
              sort, and layout. Saved views appear here for management.
            </p>
          </div>
        ) : (
          groups.map((group) => (
            <ObjectGroupBlock
              key={group.object.slug}
              group={group}
              projectId={activeProjectId}
              onViewsChange={handleViewsChange}
            />
          ))
        )}
      </div>
    </div>
  );
}
