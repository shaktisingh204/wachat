'use client';

/**
 * SabCRM Settings - Saved Views (`/dashboard/settings/crm/views`).
 *
 * Presents every saved view in the active project, grouped by object. Each
 * group is a 20ui table listing the view name, its kind (table / board) as a
 * badge, and a default star. Within each row, users with the `sabcrm:manage`
 * capability can:
 *   - Rename a view inline (saveViewAction update path)
 *   - Mark a view as the object default (setDefaultViewAction)
 *   - Delete a view (deleteViewAction)
 *
 * All mutations go through the gated server actions in
 * `src/app/actions/sabcrm.actions.ts`; the gate re-runs
 * session -> project -> RBAC -> plan -> Mongo so direct API access fails closed.
 * Auth / onboarding guards are enforced upstream by `../../layout.tsx`.
 *
 * Pure 20ui design system (`@/components/sabcrm/20ui`).
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
} from 'lucide-react';

import {
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageDescription,
  PageActions,
  Button,
  IconButton,
  Field,
  Input,
  Badge,
  Alert,
  EmptyState,
  Skeleton,
  Card,
  Table,
  THead,
  TBody,
  Tr,
  Th,
  Td,
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/sabcrm/20ui';
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
      className="flex items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        commit();
      }}
    >
      <Field label="New view name" className="flex-1 [&>.u-field__label]:sr-only">
        <Input
          ref={inputRef}
          inputSize="sm"
          value={name}
          disabled={saving}
          aria-label="New view name"
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') onCancel();
          }}
        />
      </Field>
      <Button
        type="submit"
        size="sm"
        variant="primary"
        iconLeft={Check}
        aria-label="Save name"
        title="Save name"
        loading={saving}
        disabled={!name.trim()}
      />
      <IconButton
        type="button"
        size="sm"
        icon={X}
        label="Cancel rename"
        disabled={saving}
        onClick={onCancel}
      />
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
    <Tr>
      <Td>
        {isRenaming ? (
          <RenameRow
            initial={view.name}
            saving={renameSaving}
            onSave={(name) => onRenameSave(view._id, name)}
            onCancel={onRenameCancel}
          />
        ) : (
          <span className="flex items-center gap-2">
            <Button
              size="sm"
              iconLeft={Star}
              variant={view.isDefault ? 'primary' : 'ghost'}
              aria-label={view.isDefault ? 'Default view' : 'Set as default'}
              title={view.isDefault ? 'Default view' : 'Set as default'}
              loading={mutating}
              disabled={view.isDefault}
              onClick={() => onSetDefault(view._id)}
            />
            <span className="font-medium text-[var(--st-text)]">{view.name}</span>
            {view.userId ? (
              <Badge tone="neutral" kind="soft">
                Private
              </Badge>
            ) : null}
          </span>
        )}
      </Td>
      <Td>
        <Badge tone="neutral" kind="soft">
          <KindIcon size={12} aria-hidden="true" />
          {kindLabel}
        </Badge>
      </Td>
      <Td>
        {view.isDefault ? (
          <Badge tone="success" kind="soft" dot>
            Default
          </Badge>
        ) : (
          <span className="text-[var(--st-text-tertiary)]">-</span>
        )}
      </Td>
      <Td align="right">
        {!isRenaming ? (
          <span className="flex items-center justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              iconLeft={Eye}
              onClick={() => {
                window.location.href = `/sabcrm/${objectSlug}`;
              }}
              title="Open records"
            >
              Open
            </Button>
            <Button
              variant="ghost"
              size="sm"
              iconLeft={Pencil}
              disabled={mutating}
              onClick={() => onStartRename(view._id)}
              title="Rename view"
            >
              Rename
            </Button>
            <Button
              variant="danger"
              size="sm"
              iconLeft={Trash2}
              disabled={mutating}
              onClick={() => onDelete(view)}
              title="Delete view"
            >
              Delete
            </Button>
          </span>
        ) : null}
      </Td>
    </Tr>
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
    <AlertDialog
      open
      onOpenChange={(next) => {
        if (!next && !busy) onCancel();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete view</AlertDialogTitle>
          <AlertDialogDescription>
            Delete <strong className="text-[var(--st-text)]">{view.name}</strong>? Its filters,
            sort, and layout will be permanently removed. Records are not affected.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            intent="danger"
            disabled={busy}
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
          >
            {busy ? 'Deleting...' : 'Delete view'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ---------------------------------------------------------------------------
// One object group (a table of that object's views)
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
    <Card variant="outlined" padding="none" className="overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--st-border)]">
        <h2 className="text-sm font-semibold text-[var(--st-text)]">{group.object.labelPlural}</h2>
        <span className="text-xs text-[var(--st-text-secondary)]">
          {group.views.length} {group.views.length === 1 ? 'view' : 'views'}
        </span>
        <span className="flex-1" />
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            window.location.href = `/sabcrm/${group.object.slug}`;
          }}
        >
          Open records
        </Button>
      </div>

      {error ? (
        <div className="px-4 pt-3">
          <Alert tone="danger" onClose={() => setError(null)}>
            {error}
          </Alert>
        </div>
      ) : null}

      <Table density="comfortable" hover>
        <THead>
          <Tr>
            <Th>Name</Th>
            <Th>Kind</Th>
            <Th>Default</Th>
            <Th align="right" aria-label="Actions" />
          </Tr>
        </THead>
        <TBody>
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
        </TBody>
      </Table>

      {deleteTarget ? (
        <DeleteDialog
          view={deleteTarget}
          busy={deleting}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={confirmDelete}
        />
      ) : null}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function ViewsSkeleton(): React.JSX.Element {
  return (
    <Card variant="outlined" padding="md" className="flex flex-col gap-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} height={44} radius={8} />
      ))}
    </Card>
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
    <div className="20ui flex flex-col gap-6 p-6">
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>Views</PageTitle>
          <PageDescription>
            Manage every saved view across your CRM objects. Rename a view, mark one
            as the object default, or delete views you no longer need. Records are
            never affected.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions />
      </PageHeader>

      {error ? (
        <Alert tone="danger" onClose={() => setError(null)}>
          {error}
        </Alert>
      ) : null}

      {isLoadingProject || loading ? (
        <ViewsSkeleton />
      ) : !activeProjectId ? (
        <Card variant="outlined" padding="lg">
          <EmptyState
            icon={Eye}
            title="No project selected"
            description="Select a project to manage its saved views."
          />
        </Card>
      ) : groups.length === 0 ? (
        <Card variant="outlined" padding="lg">
          <EmptyState
            icon={Eye}
            title="No saved views yet"
            description="Save a view from any object's toolbar to persist its filters, sort, and layout. Saved views appear here for management."
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-5">
          {groups.map((group) => (
            <ObjectGroupBlock
              key={group.object.slug}
              group={group}
              projectId={activeProjectId}
              onViewsChange={handleViewsChange}
            />
          ))}
        </div>
      )}
    </div>
  );
}
