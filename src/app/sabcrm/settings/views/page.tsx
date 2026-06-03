'use client';

/**
 * SabCRM Settings — Saved Views Management
 * Route: /sabcrm/settings/views
 *
 * Presents all saved views across every object the project has, grouped by
 * object. Within each group, users with `sabcrm:manage` capability can:
 *   - Rename a view (inline via the saveViewAction update path)
 *   - Set a view as the default for its object (setDefaultViewAction)
 *   - Delete a view (deleteViewAction)
 *
 * All mutations go through the existing gated server actions in
 * `src/app/actions/sabcrm.actions.ts`. The gate enforces
 * session → project → RBAC (sabcrm:manage → 'edit') → plan → Mongo.
 *
 * Auth / onboarding / RBAC is enforced by the parent layout
 * (`src/app/sabcrm/layout.tsx`). The server actions independently re-run the
 * gate so even direct API access fails closed.
 *
 * Client Component: view lists reload on demand, mutations are reflected
 * optimistically and confirmed by refetching.
 */

import * as React from 'react';
import Link from 'next/link';
import {
  Loader2,
  AlertTriangle,
  Eye,
  Trash2,
  Star,
  StarOff,
  Pencil,
  Check,
  X,
  Table2,
  Columns3,
  ArrowLeft,
  BookOpen,
} from 'lucide-react';

import {
  Button,
  Input,
  Badge,
  Card,
  ZoruCardHeader,
  ZoruCardTitle,
  ZoruCardDescription,
  ZoruCardContent,
  Skeleton,
  EmptyState,
  Alert,
  ZoruAlertTitle,
  ZoruAlertDescription,
  ZoruAlertDialog,
  ZoruAlertDialogTrigger,
  ZoruAlertDialogContent,
  ZoruAlertDialogHeader,
  ZoruAlertDialogFooter,
  ZoruAlertDialogTitle,
  ZoruAlertDialogDescription,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  Separator,
  Tooltip,
  ZoruTooltipProvider,
  ZoruTooltipTrigger,
  ZoruTooltipContent,
} from '@/components/zoruui';

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

interface ObjectWithViews {
  object: ObjectMetadata;
  views: SavedView[];
}

// ---------------------------------------------------------------------------
// Inline rename row
// ---------------------------------------------------------------------------

interface RenameRowProps {
  view: SavedView;
  onSave: (viewId: string, newName: string) => Promise<void>;
  onCancel: () => void;
  saving: boolean;
}

function RenameRow({ view, onSave, onCancel, saving }: RenameRowProps) {
  const [name, setName] = React.useState(view.name);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (name.trim() && name.trim() !== view.name) {
        void onSave(view._id, name.trim());
      } else {
        onCancel();
      }
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (name.trim() && name.trim() !== view.name) {
          void onSave(view._id, name.trim());
        } else {
          onCancel();
        }
      }}
    >
      <Input
        ref={inputRef}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={handleKeyDown}
        className="h-8 max-w-xs text-sm"
        disabled={saving}
        aria-label="New view name"
      />
      <Button
        type="submit"
        size="icon-sm"
        variant="secondary"
        disabled={saving || !name.trim()}
        aria-label="Save name"
      >
        {saving ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Check className="h-4 w-4" />
        )}
      </Button>
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        onClick={onCancel}
        disabled={saving}
        aria-label="Cancel rename"
      >
        <X className="h-4 w-4" />
      </Button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// View row
// ---------------------------------------------------------------------------

interface ViewRowProps {
  view: SavedView;
  objectSlug: string;
  onRename: (viewId: string) => void;
  onDelete: (viewId: string) => Promise<void>;
  onSetDefault: (viewId: string) => Promise<void>;
  renamingId: string | null;
  onRenameSave: (viewId: string, newName: string) => Promise<void>;
  onRenameCancel: () => void;
  renameSaving: boolean;
  mutatingId: string | null;
}

function ViewRow({
  view,
  objectSlug,
  onRename,
  onDelete,
  onSetDefault,
  renamingId,
  onRenameSave,
  onRenameCancel,
  renameSaving,
  mutatingId,
}: ViewRowProps) {
  const isRenaming = renamingId === view._id;
  const isMutating = mutatingId === view._id;

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-zoru-line bg-zoru-bg px-4 py-3 transition-colors hover:border-zoru-line-strong">
      {/* Left: name + meta */}
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {/* Kind icon */}
        <span className="shrink-0 text-zoru-ink-muted" aria-hidden>
          {view.kind === 'board' ? (
            <Columns3 className="h-4 w-4" />
          ) : (
            <Table2 className="h-4 w-4" />
          )}
        </span>

        {/* Name / inline rename */}
        {isRenaming ? (
          <RenameRow
            view={view}
            onSave={onRenameSave}
            onCancel={onRenameCancel}
            saving={renameSaving}
          />
        ) : (
          <div className="flex min-w-0 items-center gap-2">
            <Link
              href={`/sabcrm/${objectSlug}`}
              className="truncate text-sm font-medium text-zoru-ink hover:underline"
            >
              {view.name}
            </Link>
            {view.isDefault && (
              <Badge variant="secondary" className="shrink-0 text-xs">
                Default
              </Badge>
            )}
            {view.userId && (
              <Badge variant="ghost" className="shrink-0 text-xs">
                Private
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* Right: actions */}
      {!isRenaming && (
        <div className="flex shrink-0 items-center gap-1">
          <ZoruTooltipProvider>
            {/* Set default */}
            <Tooltip>
              <ZoruTooltipTrigger asChild>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  aria-label={
                    view.isDefault ? 'Already default' : 'Set as default'
                  }
                  disabled={isMutating || view.isDefault}
                  onClick={() => void onSetDefault(view._id)}
                >
                  {isMutating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : view.isDefault ? (
                    <Star className="h-4 w-4 fill-current text-zoru-ink" />
                  ) : (
                    <StarOff className="h-4 w-4" />
                  )}
                </Button>
              </ZoruTooltipTrigger>
              <ZoruTooltipContent side="top">
                {view.isDefault ? 'Default view' : 'Set as default'}
              </ZoruTooltipContent>
            </Tooltip>

            {/* Rename */}
            <Tooltip>
              <ZoruTooltipTrigger asChild>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Rename view"
                  disabled={isMutating}
                  onClick={() => onRename(view._id)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              </ZoruTooltipTrigger>
              <ZoruTooltipContent side="top">Rename</ZoruTooltipContent>
            </Tooltip>

            {/* Open */}
            <Tooltip>
              <ZoruTooltipTrigger asChild>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  aria-label={`Open ${view.name} view`}
                  disabled={isMutating}
                  asChild
                >
                  <Link href={`/sabcrm/${objectSlug}`}>
                    <Eye className="h-4 w-4" />
                  </Link>
                </Button>
              </ZoruTooltipTrigger>
              <ZoruTooltipContent side="top">Open view</ZoruTooltipContent>
            </Tooltip>

            {/* Delete */}
            <Tooltip>
              <ZoruTooltipTrigger asChild>
                <span>
                  <ZoruAlertDialog>
                    <ZoruAlertDialogTrigger asChild>
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        aria-label={`Delete ${view.name}`}
                        disabled={isMutating}
                        className="text-zoru-ink-muted hover:text-zoru-danger-ink"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </ZoruAlertDialogTrigger>
                    <ZoruAlertDialogContent>
                      <ZoruAlertDialogHeader>
                        <ZoruAlertDialogTitle>
                          Delete &ldquo;{view.name}&rdquo;?
                        </ZoruAlertDialogTitle>
                        <ZoruAlertDialogDescription>
                          This view and its configuration will be permanently
                          removed. Records are not affected.
                        </ZoruAlertDialogDescription>
                      </ZoruAlertDialogHeader>
                      <ZoruAlertDialogFooter>
                        <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
                        <ZoruAlertDialogAction
                          destructive
                          onClick={() => void onDelete(view._id)}
                        >
                          Delete view
                        </ZoruAlertDialogAction>
                      </ZoruAlertDialogFooter>
                    </ZoruAlertDialogContent>
                  </ZoruAlertDialog>
                </span>
              </ZoruTooltipTrigger>
              <ZoruTooltipContent side="top">Delete</ZoruTooltipContent>
            </Tooltip>
          </ZoruTooltipProvider>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Object section (views grouped by object)
// ---------------------------------------------------------------------------

interface ObjectSectionProps {
  ow: ObjectWithViews;
  onViewsChange: (objectSlug: string, views: SavedView[]) => void;
  projectId: string | null;
}

function ObjectSection({ ow, onViewsChange, projectId }: ObjectSectionProps) {
  const [renamingId, setRenamingId] = React.useState<string | null>(null);
  const [renameSaving, setRenameSaving] = React.useState(false);
  const [mutatingId, setMutatingId] = React.useState<string | null>(null);
  const [sectionError, setSectionError] = React.useState<string | null>(null);

  const handleRename = React.useCallback((viewId: string) => {
    setRenamingId(viewId);
    setSectionError(null);
  }, []);

  const handleRenameCancel = React.useCallback(() => {
    setRenamingId(null);
  }, []);

  const handleRenameSave = React.useCallback(
    async (viewId: string, newName: string) => {
      const view = ow.views.find((v) => v._id === viewId);
      if (!view) return;
      setRenameSaving(true);
      setSectionError(null);

      const res = await saveViewAction(
        {
          id: viewId,
          object: ow.object.slug,
          name: newName,
        },
        projectId ?? undefined,
      );

      setRenameSaving(false);

      if (res.ok) {
        setRenamingId(null);
        // Replace the updated view in the list in place.
        const updated = ow.views.map((v) =>
          v._id === viewId ? res.data : v,
        );
        onViewsChange(ow.object.slug, updated);
      } else {
        setSectionError(res.error);
      }
    },
    [ow, onViewsChange, projectId],
  );

  const handleSetDefault = React.useCallback(
    async (viewId: string) => {
      setMutatingId(viewId);
      setSectionError(null);

      const res = await setDefaultViewAction(viewId, projectId ?? undefined);

      setMutatingId(null);

      if (res.ok) {
        // Reflect the single-default invariant locally.
        const updated = ow.views.map((v) => ({
          ...v,
          isDefault: v._id === viewId,
        }));
        onViewsChange(ow.object.slug, updated);
      } else {
        setSectionError(res.error);
      }
    },
    [ow, onViewsChange, projectId],
  );

  const handleDelete = React.useCallback(
    async (viewId: string) => {
      setMutatingId(viewId);
      setSectionError(null);

      const res = await deleteViewAction(viewId, projectId ?? undefined);

      setMutatingId(null);

      if (res.ok) {
        const updated = ow.views.filter((v) => v._id !== viewId);
        onViewsChange(ow.object.slug, updated);
      } else {
        setSectionError(res.error);
      }
    },
    [ow, onViewsChange, projectId],
  );

  return (
    <Card variant="default" className="overflow-hidden">
      <ZoruCardHeader className="pb-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <ZoruCardTitle>{ow.object.labelPlural}</ZoruCardTitle>
            <ZoruCardDescription className="mt-0.5">
              {ow.views.length}{' '}
              {ow.views.length === 1 ? 'saved view' : 'saved views'}
            </ZoruCardDescription>
          </div>
          <Button size="sm" variant="outline" asChild>
            <Link href={`/sabcrm/${ow.object.slug}`}>
              Open records
            </Link>
          </Button>
        </div>
      </ZoruCardHeader>

      <Separator />

      <ZoruCardContent className="pt-4">
        {sectionError && (
          <Alert variant="destructive" className="mb-3">
            <AlertTriangle className="h-4 w-4" />
            <ZoruAlertTitle>Action failed</ZoruAlertTitle>
            <ZoruAlertDescription>{sectionError}</ZoruAlertDescription>
          </Alert>
        )}

        {ow.views.length === 0 ? (
          <p className="py-4 text-center text-sm text-zoru-ink-muted">
            No saved views for {ow.object.labelPlural.toLowerCase()}.
          </p>
        ) : (
          <div className="space-y-2">
            {ow.views.map((view) => (
              <ViewRow
                key={view._id}
                view={view}
                objectSlug={ow.object.slug}
                onRename={handleRename}
                onDelete={handleDelete}
                onSetDefault={handleSetDefault}
                renamingId={renamingId}
                onRenameSave={handleRenameSave}
                onRenameCancel={handleRenameCancel}
                renameSaving={renameSaving}
                mutatingId={mutatingId}
              />
            ))}
          </div>
        )}
      </ZoruCardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Loading skeletons
// ---------------------------------------------------------------------------

function PageSkeleton() {
  return (
    <div className="space-y-6">
      {[1, 2, 3].map((i) => (
        <div key={i} className="space-y-2 rounded-xl border border-zoru-line p-5">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-24" />
          <div className="mt-4 space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SavedViewsSettingsPage() {
  const { activeProjectId } = useProject();

  const [objectsWithViews, setObjectsWithViews] = React.useState<
    ObjectWithViews[]
  >([]);
  const [loading, setLoading] = React.useState(true);
  const [pageError, setPageError] = React.useState<string | null>(null);

  // Load all objects + their saved views in parallel.
  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setPageError(null);

    void (async () => {
      const objectsRes = await listObjectsAction(activeProjectId ?? undefined);
      if (cancelled) return;

      if (!objectsRes.ok) {
        setPageError(objectsRes.error);
        setLoading(false);
        return;
      }

      const objects = objectsRes.data;

      // Fetch views for every object in parallel. Gate failures are surfaced as
      // empty view lists rather than crashing the whole page.
      const pairs = await Promise.all(
        objects.map(async (object) => {
          const res = await listViewsAction(
            object.slug,
            activeProjectId ?? undefined,
          );
          const views: SavedView[] = res.ok ? res.data : [];
          return { object, views };
        }),
      );

      if (cancelled) return;

      // Only show objects that have at least one saved view — objects with no
      // views don't need management surface.
      setObjectsWithViews(pairs.filter((p) => p.views.length > 0));
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [activeProjectId]);

  /** Update the local view list for one object after a successful mutation. */
  const handleViewsChange = React.useCallback(
    (objectSlug: string, updatedViews: SavedView[]) => {
      setObjectsWithViews((prev) => {
        // Replace the view list for the given object. If it's now empty,
        // remove the section so the empty-state renders cleanly.
        if (updatedViews.length === 0) {
          return prev.filter((ow) => ow.object.slug !== objectSlug);
        }
        return prev.map((ow) =>
          ow.object.slug === objectSlug
            ? { ...ow, views: updatedViews }
            : ow,
        );
      });
    },
    [],
  );

  // ---- Render --------------------------------------------------------------

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-8">
      {/* Page header */}
      <div className="mb-8">
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="mb-4 -ml-2 text-zoru-ink-muted"
        >
          <Link href="/sabcrm">
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Back to SabCRM
          </Link>
        </Button>

        <h1 className="text-2xl font-semibold text-zoru-ink">Saved Views</h1>
        <p className="mt-1 text-sm text-zoru-ink-muted">
          Manage the saved views across all your CRM objects. Rename, set
          defaults, or delete views you no longer need.
        </p>
      </div>

      {/* Body */}
      {loading ? (
        <PageSkeleton />
      ) : pageError ? (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <ZoruAlertTitle>Unable to load views</ZoruAlertTitle>
          <ZoruAlertDescription>{pageError}</ZoruAlertDescription>
        </Alert>
      ) : objectsWithViews.length === 0 ? (
        <EmptyState
          icon={<BookOpen />}
          title="No saved views yet"
          description="Save a view from any object's toolbar to manage it here. Views let you persist filters, sorts, and layouts so you can jump back to them later."
          action={
            <Button asChild variant="outline">
              <Link href="/sabcrm">Browse objects</Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-6">
          {objectsWithViews.map((ow) => (
            <ObjectSection
              key={ow.object.slug}
              ow={ow}
              onViewsChange={handleViewsChange}
              projectId={activeProjectId}
            />
          ))}
        </div>
      )}
    </main>
  );
}
