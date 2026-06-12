'use client';

/**
 * RecordSurface — the flagged NEW record-list experience for
 * `/sabcrm/[objectSlug]`, built entirely on the 20ui RecordSurface
 * composites (`@/components/sabcrm/20ui/composites/record`) and wired to the
 * SAME gated server actions the legacy Twenty-styled page uses:
 *
 *   - object metadata .... `listSabcrmObjectsTw`
 *   - records page ....... `listSabcrmRecordsTw` (enriched: relation labels)
 *   - board buckets ...... `groupSabcrmRecordsTw` (+ client-side filter/q
 *                          narrowing — the group action takes no predicate)
 *   - inline / board edit  `updateSabcrmRecordTw` (optimistic, rollback)
 *   - create ............. `createSabcrmRecordTw`
 *   - bulk delete/update . `bulkDeleteRecordsTw` / `bulkUpdateRecordsTw`
 *   - saved views ........ `listViewsTw` / `createViewTw` / `updateViewTw` /
 *                          `deleteViewTw`
 *   - favorites .......... `listSabcrmFavoritesTw` / `addSabcrmFavoriteTw` /
 *                          `removeSabcrmFavoriteTw` (optimistic row star)
 *   - stage gates ........ `checkSabcrmStageMove` → RecordBoard `canMove`
 *
 * All client-model ⇄ wire mapping lives in `./record-surface-adapter.ts`
 * (pure, unit-testable). Rendered by the legacy `page.tsx` when the
 * `NEXT_PUBLIC_SABCRM_RECORD_SURFACE` flag matches the active slug.
 *
 * Shareable URLs: `?view=<id>&vt=<table|board>&page=<n>&q=<text>` round-trip
 * through `parseUrlViewState` / `applyUrlViewState` (replace-state only —
 * filters/sorts/group-by stay in the saved view the `view` param references).
 */

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Database, Inbox, Plus, RotateCw, Star, Trash2 } from 'lucide-react';

import {
  RecordGrid,
  BulkBar,
  GridPagination,
  RecordBoard,
  RecordCell,
  ViewBar,
  EMPTY_FILTER_GROUP,
  type FilterGroup,
  type ViewSort,
  type ViewDensity,
  type SavedView,
  type SavedViewPatch,
  type RecordViewType,
  type RecordBoardColumn,
  type RecordBoardGateVerdict,
  type RecordCellProps,
} from '@/components/sabcrm/20ui/composites/record';
import { Button } from '@/components/sabcrm/20ui/button';
import { Select } from '@/components/sabcrm/20ui/select';
import { Field, Input } from '@/components/sabcrm/20ui/field';
import { Alert, EmptyState } from '@/components/sabcrm/20ui/feedback';
import { Spinner } from '@/components/sabcrm/20ui/loading';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/sabcrm/20ui/dialog';

import { useProject } from '@/context/project-context';
import { sabcrmRecordLabel } from '@/lib/sabcrm/record-label';
import type { ObjectMetadata, FieldMetadata, CrmRecord } from '@/lib/sabcrm/types';
import {
  parseCurrency,
  DEFAULT_FMT,
} from '@/components/sabcrm/20ui/composites/record/fields/shared';

import {
  listSabcrmObjectsTw,
  listSabcrmRecordsTw,
  createSabcrmRecordTw,
  updateSabcrmRecordTw,
  groupSabcrmRecordsTw,
  listSabcrmFavoritesTw,
  addSabcrmFavoriteTw,
  removeSabcrmFavoriteTw,
} from '@/app/actions/sabcrm-twenty.actions';
import {
  bulkDeleteRecordsTw,
  bulkUpdateRecordsTw,
} from '@/app/actions/sabcrm-bulk.actions';
import {
  listViewsTw,
  createViewTw,
  updateViewTw,
  deleteViewTw,
} from '@/app/actions/sabcrm-views.actions';
import {
  checkSabcrmStageMove,
  requestSabcrmStageApproval,
} from '@/app/actions/sabcrm-stage-gates.actions';
import { listPipelinesTw } from '@/app/actions/sabcrm-pipelines.actions';
import type {
  SabcrmRustPipeline,
  SabcrmRustPipelineStage,
} from '@/app/actions/sabcrm-pipelines.actions.types';
import type { SabcrmRustRecord } from '@/app/actions/sabcrm-twenty.actions.types';

import {
  filterGroupToWire,
  sortsToWire,
  savedViewFromWire,
  savedViewToWireInput,
  savedViewPatchToWire,
  columnWidthsFromWire,
  parseUrlViewState,
  applyUrlViewState,
  rustRecordToCrm,
  collectRelationLabels,
  recordMatchesFilters,
  recordMatchesSearch,
  countLeaves,
  type ViewStateSnapshot,
  type UrlViewState,
} from './record-surface-adapter';

/* -------------------------------------------------------------- constants */

const DEFAULT_PAGE_SIZE = 50;
const SEARCH_DEBOUNCE_MS = 300;
const VIEW_PERSIST_DEBOUNCE_MS = 800;

type RelationResolver = NonNullable<RecordCellProps['relationResolver']>;

/** Concrete CSS color for a SELECT option's `color` token/hex. */
function optionCssColor(color?: string): string | undefined {
  if (!color) return undefined;
  if (
    color.startsWith('#') ||
    color.startsWith('rgb') ||
    color.startsWith('hsl')
  ) {
    return color;
  }
  if (color.startsWith('--')) return `var(${color})`;
  if (/^[a-z][a-z0-9-]*$/i.test(color)) return `var(--ui20-${color}, ${color})`;
  return undefined;
}

/**
 * Lost-stage detection: prefer the explicit `stage.kind` marker (set in the
 * pipeline settings governance editor). Legacy stages without a `kind` fall
 * back to the /lost/i id-or-label heuristic (e.g. "Closed lost").
 */
const LOST_STAGE_RE = /lost/i;

function isLostStage(stage: SabcrmRustPipelineStage): boolean {
  if (stage.kind) return stage.kind === 'lost';
  return LOST_STAGE_RE.test(String(stage.id)) || LOST_STAGE_RE.test(stage.label ?? '');
}

/* ------------------------------------------------------ lost-reason dialog */

interface LostReasonDialogProps {
  /** Label of the lost stage the card was dropped into. */
  stageLabel: string;
  /** Curated `pipeline.lostReasons`; empty → free-text input. */
  reasons: string[];
  onSubmit: (reason: string) => void;
  onCancel: () => void;
}

/**
 * "Why was this lost?" — shown when a card is dropped into a lost-type stage
 * of a pipeline with `lostReasonRequired`. Curated `lostReasons` render as a
 * Select; an empty list falls back to a free-text input. Cancel snaps the
 * card back (the move never commits).
 */
function LostReasonDialog({
  stageLabel,
  reasons,
  onSubmit,
  onCancel,
}: LostReasonDialogProps): React.JSX.Element {
  const [picked, setPicked] = React.useState<string | null>(null);
  const [other, setOther] = React.useState('');
  const reason = reasons.length > 0 ? picked ?? '' : other.trim();

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Why was this lost?</DialogTitle>
          <DialogDescription>
            Moving to “{stageLabel}” requires a lost reason. It is saved on the
            record with the move.
          </DialogDescription>
        </DialogHeader>
        <Field label="Lost reason" required>
          {reasons.length > 0 ? (
            <Select
              value={picked}
              onChange={setPicked}
              options={reasons.map((r) => ({ value: r, label: r }))}
              placeholder="Pick a reason…"
              block
            />
          ) : (
            <Input
              value={other}
              onChange={(e) => setOther(e.target.value)}
              placeholder="e.g. went with a competitor"
              autoFocus
            />
          )}
        </Field>
        <DialogFooter>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={!reason}
            onClick={() => onSubmit(reason)}
          >
            Move &amp; save reason
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------------------------------------------------- create dialog */

interface CreateRecordDialogProps {
  object: ObjectMetadata;
  projectId: string | null;
  relationResolver: RelationResolver;
  onClose: () => void;
  onCreated: () => void;
}

/**
 * Minimal "New record" dialog: RecordCell editors for the object's required +
 * in-table fields, submitted through the gated `createSabcrmRecordTw`.
 */
function CreateRecordDialog({
  object,
  projectId,
  relationResolver,
  onClose,
  onCreated,
}: CreateRecordDialogProps): React.JSX.Element {
  const fields = React.useMemo(
    () =>
      object.fields.filter((f) => !f.system && (f.required || f.inTable)),
    [object],
  );

  const [draft, setDraft] = React.useState<Record<string, unknown>>(() => {
    const seed: Record<string, unknown> = {};
    for (const f of fields) {
      if (f.defaultValue !== undefined) seed[f.key] = f.defaultValue;
    }
    return seed;
  });
  // Editors commit on blur — a "Create" click's blur-commit races the submit
  // handler's render closure, so the freshest draft also lives in a ref.
  const draftRef = React.useRef(draft);
  draftRef.current = draft;

  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const setFieldValue = React.useCallback((key: string, next: unknown) => {
    setDraft((prev) => {
      const out = { ...prev, [key]: next };
      draftRef.current = out;
      return out;
    });
  }, []);

  const missingRequired = React.useMemo(
    () =>
      fields.filter((f) => {
        if (!f.required) return false;
        const v = draft[f.key];
        return v === undefined || v === null || v === '';
      }),
    [fields, draft],
  );

  const submit = async (): Promise<void> => {
    if (saving) return;
    setSaving(true);
    setError(null);
    const res = await createSabcrmRecordTw(
      object.slug,
      draftRef.current,
      projectId ?? undefined,
    );
    setSaving(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    onCreated();
    onClose();
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="rs-create-dialog">
        <DialogHeader>
          <DialogTitle>New {object.labelSingular.toLowerCase()}</DialogTitle>
          <DialogDescription>
            Fill in the fields below, then create the record.
          </DialogDescription>
        </DialogHeader>

        {error ? (
          <Alert tone="danger" title="Could not create record">
            {error}
          </Alert>
        ) : null}

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--st-space-3, 12px)',
            padding: 'var(--st-space-2, 8px) 0',
            maxHeight: '60vh',
            overflowY: 'auto',
          }}
        >
          {fields.length === 0 ? (
            <EmptyState
              size="sm"
              icon={Inbox}
              title="No editable fields"
              description="This object has no required or in-table fields to fill."
            />
          ) : (
            fields.map((field) => (
              <label
                key={field.key}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--st-space-1, 4px)',
                  fontSize: 'var(--st-font-size-sm, 12px)',
                  color: 'var(--st-text-soft, var(--st-text))',
                }}
              >
                <span>
                  {field.label}
                  {field.required ? (
                    <span aria-hidden="true" style={{ color: 'var(--st-danger, currentColor)' }}>
                      {' '}
                      *
                    </span>
                  ) : null}
                </span>
                <RecordCell
                  field={field}
                  value={draft[field.key]}
                  mode="edit"
                  relationResolver={relationResolver}
                  onCommit={(next) => setFieldValue(field.key, next)}
                  onCancel={() => {}}
                />
              </label>
            ))
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            variant="primary"
            loading={saving}
            disabled={missingRequired.length > 0}
            onClick={() => void submit()}
          >
            Create {object.labelSingular.toLowerCase()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------ RecordSurface */

export function RecordSurface(): React.JSX.Element {
  const params = useParams<{ objectSlug: string }>();
  const objectSlug = params?.objectSlug ?? '';
  const router = useRouter();
  const { activeProjectId } = useProject();

  /* ---- URL view-state hydration ------------------------------------------ */

  // One-shot read of `?view/vt/page/q` (see the adapter codec) so the state
  // initializers below can seed from a shared link. The saved-view id can
  // only apply once the views list loads — it parks in `pendingViewIdRef`.
  const initialUrlRef = React.useRef<UrlViewState | null>(null);
  if (initialUrlRef.current === null) {
    initialUrlRef.current =
      typeof window === 'undefined'
        ? {}
        : parseUrlViewState(window.location.search);
  }
  const pendingViewIdRef = React.useRef<string | null>(
    initialUrlRef.current.viewId ?? null,
  );
  // Set to skip ONE run of the snap-to-page-1 effect, so a deep-linked
  // `?page` survives mount + the pending saved-view apply.
  const skipPageResetRef = React.useRef(true);

  /* ---- object metadata -------------------------------------------------- */

  const [object, setObject] = React.useState<ObjectMetadata | null>(null);
  const [allObjects, setAllObjects] = React.useState<ObjectMetadata[]>([]);
  const [loadingObject, setLoadingObject] = React.useState(true);
  const [objectError, setObjectError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setLoadingObject(true);
    setObjectError(null);
    void (async () => {
      const res = await listSabcrmObjectsTw(activeProjectId ?? undefined);
      if (cancelled) return;
      if (!res.ok) {
        setObjectError(res.error);
        setObject(null);
        setAllObjects([]);
      } else {
        setAllObjects(res.data);
        setObject(res.data.find((o) => o.slug === objectSlug) ?? null);
      }
      setLoadingObject(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [objectSlug, activeProjectId]);

  /* ---- view-bar state ---------------------------------------------------- */

  const [viewType, setViewType] = React.useState<RecordViewType>(
    () => initialUrlRef.current?.viewType ?? 'table',
  );
  const [filters, setFilters] = React.useState<FilterGroup>(EMPTY_FILTER_GROUP);
  const [sorts, setSorts] = React.useState<ViewSort[]>([]);
  const [groupBy, setGroupBy] = React.useState<string | null>(null);
  const [searchQuery, setSearchQuery] = React.useState(
    () => initialUrlRef.current?.q ?? '',
  );
  const [q, setQ] = React.useState(() => initialUrlRef.current?.q ?? '');
  const [density, setDensity] = React.useState<ViewDensity>('comfortable');
  /** Table column widths (px) keyed by field key — RecordGrid resize state. */
  const [columnWidths, setColumnWidths] = React.useState<
    Record<string, number>
  >({});

  // Reset transient state when the object CHANGES (not on mount — the mount
  // values may carry hydrated URL state).
  const prevSlugRef = React.useRef(objectSlug);
  React.useEffect(() => {
    if (prevSlugRef.current === objectSlug) return;
    prevSlugRef.current = objectSlug;
    setViewType('table');
    setFilters(EMPTY_FILTER_GROUP);
    setSorts([]);
    setGroupBy(null);
    setSearchQuery('');
    setQ('');
    setColumnWidths({});
  }, [objectSlug]);

  // Debounce quick search into the server `q` param.
  React.useEffect(() => {
    const t = setTimeout(() => setQ(searchQuery.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchQuery]);

  /* ---- saved views ------------------------------------------------------- */

  const [savedViews, setSavedViews] = React.useState<SavedView[]>([]);
  const [activeViewId, setActiveViewId] = React.useState<string | null>(null);
  // Set while a saved view's state is being APPLIED, so the persist-on-change
  // effect below doesn't immediately write the state back to the server.
  const applyingViewRef = React.useRef(false);
  // Per-view persisted column widths (`columnWidths` key on the view doc),
  // keyed by view id — the composites' SavedView model doesn't carry them, so
  // they ride alongside and are applied/persisted by the host.
  const viewWidthsRef = React.useRef<Record<string, Record<string, number>>>(
    {},
  );

  const applyView = React.useCallback((view: SavedView) => {
    applyingViewRef.current = true;
    setActiveViewId(view.id);
    setViewType(view.viewType ?? 'table');
    setFilters(view.filters ?? EMPTY_FILTER_GROUP);
    setSorts(view.sorts ?? []);
    setGroupBy(view.groupBy ?? null);
    setColumnWidths(viewWidthsRef.current[view.id] ?? {});
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    setActiveViewId(null);
    void (async () => {
      if (!objectSlug) return;
      const res = await listViewsTw(objectSlug, activeProjectId ?? undefined);
      if (cancelled || !res.ok) return;
      const widths: Record<string, Record<string, number>> = {};
      for (const wire of res.data) widths[wire.id] = columnWidthsFromWire(wire);
      viewWidthsRef.current = widths;
      const views = res.data.map(savedViewFromWire);
      setSavedViews(views);
      // Deep link: apply the URL's saved view once the list is known. The
      // URL's own vt/page (hydrated at mount) win over the view doc.
      const pendingId = pendingViewIdRef.current;
      if (pendingId) {
        pendingViewIdRef.current = null;
        const view = views.find((v) => v.id === pendingId);
        if (view) {
          const url = initialUrlRef.current ?? {};
          if (url.page) {
            // Skip the snap-to-page-1 run this apply triggers; effects flush
            // before the macrotask, so the reset is re-armed either way.
            skipPageResetRef.current = true;
            window.setTimeout(() => {
              skipPageResetRef.current = false;
            }, 0);
          }
          applyView(view);
          if (url.viewType) setViewType(url.viewType);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [objectSlug, activeProjectId, applyView]);

  const snapshot = React.useCallback(
    (): ViewStateSnapshot => ({ viewType, filters, sorts, groupBy, columnWidths }),
    [viewType, filters, sorts, groupBy, columnWidths],
  );

  const handleSelectView = React.useCallback(
    (id: string) => {
      const view = savedViews.find((v) => v.id === id);
      if (view) applyView(view);
    },
    [savedViews, applyView],
  );

  const handleSaveView = React.useCallback(
    (name: string) => {
      void (async () => {
        const res = await createViewTw(
          savedViewToWireInput(objectSlug, name, snapshot()),
          activeProjectId ?? undefined,
        );
        if (!res.ok) return;
        viewWidthsRef.current[res.data.id] = columnWidthsFromWire(res.data);
        const view = savedViewFromWire(res.data);
        setSavedViews((prev) => [...prev, view]);
        setActiveViewId(view.id);
      })();
    },
    [objectSlug, snapshot, activeProjectId],
  );

  const handleUpdateView = React.useCallback(
    (id: string, patch: SavedViewPatch) => {
      void (async () => {
        const res = await updateViewTw(
          id,
          savedViewPatchToWire(patch),
          activeProjectId ?? undefined,
        );
        if (!res.ok) return;
        viewWidthsRef.current[id] = columnWidthsFromWire(res.data);
        const view = savedViewFromWire(res.data);
        setSavedViews((prev) => prev.map((v) => (v.id === id ? view : v)));
      })();
    },
    [activeProjectId],
  );

  const handleDeleteView = React.useCallback(
    (id: string) => {
      void (async () => {
        const res = await deleteViewTw(id, activeProjectId ?? undefined);
        if (!res.ok) return;
        delete viewWidthsRef.current[id];
        setSavedViews((prev) => prev.filter((v) => v.id !== id));
        setActiveViewId((prev) => (prev === id ? null : prev));
      })();
    },
    [activeProjectId],
  );

  // Persist viewType/filters/sorts/groupBy/columnWidths onto the ACTIVE saved
  // view (debounced) whenever the user changes them — Twenty's implicit-save
  // model. Column resizes ride the same debounce.
  React.useEffect(() => {
    if (!activeViewId) return;
    if (applyingViewRef.current) {
      applyingViewRef.current = false;
      return;
    }
    const id = activeViewId;
    const snap: ViewStateSnapshot = {
      viewType,
      filters,
      sorts,
      groupBy,
      columnWidths,
    };
    const t = setTimeout(() => {
      void (async () => {
        const res = await updateViewTw(
          id,
          savedViewPatchToWire({}, snap),
          activeProjectId ?? undefined,
        );
        if (!res.ok) return;
        viewWidthsRef.current[id] = columnWidthsFromWire(res.data);
        const view = savedViewFromWire(res.data);
        setSavedViews((prev) => prev.map((v) => (v.id === id ? view : v)));
      })();
    }, VIEW_PERSIST_DEBOUNCE_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewType, filters, sorts, groupBy, columnWidths, activeViewId, activeProjectId]);

  /* ---- derived fields ---------------------------------------------------- */

  const columns = React.useMemo<FieldMetadata[]>(() => {
    if (!object) return [];
    const inTable = object.fields.filter((f) => f.inTable);
    return inTable.length > 0 ? inTable : object.fields.slice(0, 6);
  }, [object]);

  // The SELECT field the board buckets by: explicit Group-by wins, the
  // object's BoardConfig is the fallback, then the first SELECT field.
  const groupField = React.useMemo<FieldMetadata | undefined>(() => {
    if (!object) return undefined;
    const bySelect = (key: string | null | undefined): FieldMetadata | undefined => {
      if (!key) return undefined;
      const f = object.fields.find((x) => x.key === key);
      return f && f.type === 'SELECT' ? f : undefined;
    };
    return (
      bySelect(groupBy) ??
      bySelect(object.board?.groupByField) ??
      object.fields.find((f) => f.type === 'SELECT')
    );
  }, [object, groupBy]);

  const canBoard = !!groupField;
  const availableViews = React.useMemo<RecordViewType[]>(
    () => (canBoard ? ['table', 'board'] : ['table']),
    [canBoard],
  );

  // Only snap board → table once the object is KNOWN to lack a group field —
  // a deep-linked `vt=board` must survive the metadata round-trip.
  React.useEffect(() => {
    if (object && viewType === 'board' && !canBoard) setViewType('table');
  }, [object, viewType, canBoard]);

  /* ---- records (table) --------------------------------------------------- */

  const [rustRecords, setRustRecords] = React.useState<SabcrmRustRecord[]>([]);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(() => initialUrlRef.current?.page ?? 1);
  const [pageSize, setPageSize] = React.useState(DEFAULT_PAGE_SIZE);
  const [loadingData, setLoadingData] = React.useState(true);
  const [dataError, setDataError] = React.useState<string | null>(null);
  const [refreshTick, setRefreshTick] = React.useState(0);

  const refresh = React.useCallback(() => setRefreshTick((t) => t + 1), []);

  const wireFilters = React.useMemo(() => filterGroupToWire(filters), [filters]);
  const wireSort = React.useMemo(() => sortsToWire(sorts), [sorts]);

  // Any change to the query window's shape snaps back to page 1 — except a
  // skipped run (mount / deep-linked view apply), which keeps a URL `?page`.
  React.useEffect(() => {
    if (skipPageResetRef.current) {
      skipPageResetRef.current = false;
      return;
    }
    setPage(1);
  }, [objectSlug, q, wireFilters, wireSort, pageSize, viewType]);

  // Encode the shareable slice of view state into the URL (replace-state —
  // no Next.js navigation, no scroll). Foreign params are preserved.
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const next = applyUrlViewState(window.location.search, {
      viewId: activeViewId ?? undefined,
      viewType,
      page,
      q,
    });
    if (next !== window.location.search) {
      window.history.replaceState(
        window.history.state,
        '',
        `${window.location.pathname}${next}${window.location.hash}`,
      );
    }
  }, [activeViewId, viewType, page, q]);

  React.useEffect(() => {
    if (!object || !objectSlug || viewType === 'board') return;
    let cancelled = false;
    setLoadingData(true);
    setDataError(null);
    void (async () => {
      const res = await listSabcrmRecordsTw(
        objectSlug,
        {
          q: q || undefined,
          page,
          limit: pageSize,
          sortBy: wireSort.sortBy,
          sortDir: wireSort.sortDir,
          filters: wireFilters,
        },
        activeProjectId ?? undefined,
        true, // enrich: resolve RELATION/ACTOR labels for the cells
      );
      if (cancelled) return;
      if (!res.ok) {
        setDataError(res.error);
        setRustRecords([]);
        setTotal(0);
      } else {
        setRustRecords(res.data.records);
        setTotal(res.data.total);
      }
      setLoadingData(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [
    object,
    objectSlug,
    viewType,
    q,
    page,
    pageSize,
    wireSort,
    wireFilters,
    activeProjectId,
    refreshTick,
  ]);

  /* ---- records (board) --------------------------------------------------- */

  const [boardRust, setBoardRust] = React.useState<SabcrmRustRecord[]>([]);
  const [boardLoading, setBoardLoading] = React.useState(false);
  const [boardError, setBoardError] = React.useState<string | null>(null);
  const [boardHasUngrouped, setBoardHasUngrouped] = React.useState(false);

  React.useEffect(() => {
    if (!object || !objectSlug || viewType !== 'board' || !groupField) return;
    let cancelled = false;
    setBoardLoading(true);
    setBoardError(null);
    void (async () => {
      const res = await groupSabcrmRecordsTw(
        objectSlug,
        groupField.key,
        activeProjectId ?? undefined,
      );
      if (cancelled) return;
      if (!res.ok) {
        setBoardError(res.error);
        setBoardRust([]);
        setBoardHasUngrouped(false);
      } else {
        const flat: SabcrmRustRecord[] = [];
        let ungrouped = false;
        for (const group of res.data.groups) {
          if (group.value === null && group.records.length > 0) ungrouped = true;
          flat.push(...group.records);
        }
        setBoardRust(flat);
        setBoardHasUngrouped(ungrouped);
      }
      setBoardLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [object, objectSlug, viewType, groupField, activeProjectId, refreshTick]);

  // The group action takes no q/filters — narrow client-side so the board
  // stays honest with the active predicate (legacy page behaviour).
  const boardRecords = React.useMemo<CrmRecord[]>(() => {
    const hasFilters = countLeaves(filters) > 0;
    return boardRust
      .filter(
        (r) =>
          (!hasFilters || recordMatchesFilters(r.data, filters)) &&
          recordMatchesSearch(r.data, q),
      )
      .map(rustRecordToCrm);
  }, [boardRust, filters, q]);

  const boardColumns = React.useMemo<RecordBoardColumn[]>(() => {
    if (!groupField) return [];
    const cols: RecordBoardColumn[] = (groupField.options ?? []).map((o) => ({
      id: o.value,
      label: o.label,
      color: optionCssColor(o.color),
    }));
    if (boardHasUngrouped) {
      cols.push({ id: '', label: `No ${groupField.label.toLowerCase()}` });
    }
    return cols;
  }, [groupField, boardHasUngrouped]);

  /* ---- board per-column aggregates ---------------------------------------- */

  // The object's first CURRENCY field feeds the column-footer sum.
  const currencyField = React.useMemo<FieldMetadata | undefined>(
    () => object?.fields.find((f) => f.type === 'CURRENCY'),
    [object],
  );

  // column id → { count, sum, code } over the FILTERED board records, so the
  // footers stay honest with the active predicate (like the buckets do).
  const boardAggregates = React.useMemo(() => {
    const map = new Map<
      string,
      { count: number; sum: number; code: string | null }
    >();
    if (!groupField) return map;
    for (const record of boardRecords) {
      const raw = record.data[groupField.key];
      const key = raw == null ? '' : String(raw);
      let agg = map.get(key);
      if (!agg) {
        agg = { count: 0, sum: 0, code: null };
        map.set(key, agg);
      }
      agg.count += 1;
      if (currencyField) {
        const money = parseCurrency(record.data[currencyField.key]);
        if (money) {
          agg.sum += money.amount;
          if (agg.code === null) agg.code = money.code;
        }
      }
    }
    return map;
  }, [boardRecords, groupField, currencyField]);

  // "₹X · N deals"-style footer (count only when the object has no CURRENCY
  // field). Uses the field system's Intl currency formatter.
  const boardColumnFooter = React.useCallback(
    (column: RecordBoardColumn): React.ReactNode => {
      if (!object) return null;
      const agg = boardAggregates.get(column.id);
      const count = agg?.count ?? 0;
      const noun = (
        count === 1 ? object.labelSingular : object.labelPlural
      ).toLowerCase();
      const countLabel = `${count} ${noun}`;
      return (
        <span
          style={{
            fontSize: 'var(--st-font-size-xs, 11px)',
            color: 'var(--st-text-soft, var(--st-text))',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {currencyField
            ? `${DEFAULT_FMT.currency(agg?.sum ?? 0, agg?.code ?? 'USD')} · ${countLabel}`
            : countLabel}
        </span>
      );
    },
    [object, boardAggregates, currencyField],
  );

  /* ---- relation labels --------------------------------------------------- */

  // id → label cache, harvested from enriched pages + relation searches.
  const relationLabelsRef = React.useRef(new Map<string, string>());
  const [, bumpRelationLabels] = React.useReducer((n: number) => n + 1, 0);

  React.useEffect(() => {
    const before = relationLabelsRef.current.size;
    collectRelationLabels(rustRecords, relationLabelsRef.current);
    collectRelationLabels(boardRust, relationLabelsRef.current);
    if (relationLabelsRef.current.size !== before) bumpRelationLabels();
  }, [rustRecords, boardRust]);

  const relationResolver = React.useMemo<RelationResolver>(
    () => ({
      label: (_field, value) => {
        if (value === null || value === undefined || value === '') return null;
        return relationLabelsRef.current.get(String(value)) ?? null;
      },
      search: async (field, query) => {
        const target = field.relation?.targetObject;
        if (!target) return [];
        const res = await listSabcrmRecordsTw(
          target,
          { q: query || undefined, limit: 10 },
          activeProjectId ?? undefined,
        );
        if (!res.ok) return [];
        const targetObject = allObjects.find((o) => o.slug === target);
        const options = res.data.records.map((r) => ({
          id: r.id,
          label: targetObject
            ? sabcrmRecordLabel(targetObject, r)
            : String(r.id),
        }));
        // Feed the cache so a freshly-picked relation renders its label.
        for (const o of options) relationLabelsRef.current.set(o.id, o.label);
        return options;
      },
    }),
    [activeProjectId, allObjects],
  );

  /* ---- inline edit (optimistic) ------------------------------------------ */

  const [editing, setEditing] = React.useState<{
    recordId: string;
    fieldKey: string;
  } | null>(null);
  const [mutationError, setMutationError] = React.useState<string | null>(null);

  const patchLocal = React.useCallback(
    (recordId: string, patch: Record<string, unknown>) => {
      const apply = (list: SabcrmRustRecord[]): SabcrmRustRecord[] =>
        list.map((r) =>
          r.id === recordId ? { ...r, data: { ...r.data, ...patch } } : r,
        );
      setRustRecords(apply);
      setBoardRust(apply);
    },
    [],
  );

  const commitFieldEdit = React.useCallback(
    (record: CrmRecord, field: FieldMetadata, next: unknown) => {
      setEditing(null);
      const prev = record.data[field.key];
      if (Object.is(prev, next)) return;
      // Optimistic apply, rollback on failure.
      patchLocal(record._id, { [field.key]: next });
      setMutationError(null);
      void (async () => {
        const res = await updateSabcrmRecordTw(
          record.object,
          record._id,
          { [field.key]: next },
          activeProjectId ?? undefined,
        );
        if (!res.ok) {
          patchLocal(record._id, { [field.key]: prev });
          setMutationError(res.error);
        }
      })();
    },
    [patchLocal, activeProjectId],
  );

  const records = React.useMemo<CrmRecord[]>(
    () => rustRecords.map(rustRecordToCrm),
    [rustRecords],
  );

  /* ---- favorites (row star) ----------------------------------------------- */

  const [favoriteIds, setFavoriteIds] = React.useState<Set<string>>(new Set());

  React.useEffect(() => {
    let cancelled = false;
    setFavoriteIds(new Set());
    void (async () => {
      if (!objectSlug) return;
      const res = await listSabcrmFavoritesTw(activeProjectId ?? undefined);
      if (cancelled || !res.ok) return;
      setFavoriteIds(
        new Set(
          res.data
            .filter((f) => f.object === objectSlug)
            .map((f) => f.recordId),
        ),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [objectSlug, activeProjectId]);

  // Optimistic star toggle (rollback on failure). The suite frame's Favorites
  // group re-reads the list per pathname, so it picks the change up on the
  // next navigation — no frame wiring needed here.
  const toggleFavorite = React.useCallback(
    (recordId: string) => {
      const next = !favoriteIds.has(recordId);
      setFavoriteIds((prev) => {
        const out = new Set(prev);
        if (next) out.add(recordId);
        else out.delete(recordId);
        return out;
      });
      setMutationError(null);
      void (async () => {
        const res = next
          ? await addSabcrmFavoriteTw(
              objectSlug,
              recordId,
              activeProjectId ?? undefined,
            )
          : await removeSabcrmFavoriteTw(
              objectSlug,
              recordId,
              activeProjectId ?? undefined,
            );
        if (!res.ok) {
          setFavoriteIds((prev) => {
            const out = new Set(prev);
            if (next) out.delete(recordId);
            else out.add(recordId);
            return out;
          });
          setMutationError(res.error);
        }
      })();
    },
    [favoriteIds, objectSlug, activeProjectId],
  );

  /* ---- cells --------------------------------------------------------------- */

  // The first visible column carries the favorite star.
  const firstColumnKey = columns[0]?.key;

  const renderCell = React.useCallback(
    (record: CrmRecord, field: FieldMetadata): React.ReactNode => {
      const isEditing =
        editing?.recordId === record._id && editing.fieldKey === field.key;
      if (isEditing) {
        return (
          <span
            style={{ display: 'block', width: '100%' }}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <RecordCell
              field={field}
              value={record.data[field.key]}
              record={record}
              mode="edit"
              relationResolver={relationResolver}
              onCommit={(next) => commitFieldEdit(record, field, next)}
              onCancel={() => setEditing(null)}
            />
          </span>
        );
      }
      const withStar = field.key === firstColumnKey;
      const isFav = withStar && favoriteIds.has(record._id);
      const cell = (
        <RecordCell
          field={field}
          value={record.data[field.key]}
          record={record}
          relationResolver={relationResolver}
        />
      );
      return (
        <span
          style={
            withStar
              ? {
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--st-space-1, 4px)',
                  width: '100%',
                }
              : { display: 'block', width: '100%' }
          }
          onDoubleClick={(e) => {
            if (field.system) return;
            e.stopPropagation();
            setEditing({ recordId: record._id, fieldKey: field.key });
          }}
        >
          {withStar ? (
            <button
              type="button"
              aria-pressed={isFav}
              aria-label={isFav ? 'Remove from favorites' : 'Add to favorites'}
              title={isFav ? 'Remove from favorites' : 'Add to favorites'}
              onClick={(e) => {
                e.stopPropagation();
                toggleFavorite(record._id);
              }}
              onDoubleClick={(e) => e.stopPropagation()}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                flex: 'none',
                padding: 2,
                margin: 0,
                border: 0,
                background: 'none',
                cursor: 'pointer',
                borderRadius: 'var(--st-radius-sm, 4px)',
                color: isFav
                  ? 'var(--st-warn, #eab308)'
                  : 'var(--st-text-tertiary, currentColor)',
              }}
            >
              <Star
                size={13}
                fill={isFav ? 'currentColor' : 'none'}
                aria-hidden="true"
              />
            </button>
          ) : null}
          {withStar ? (
            <span style={{ flex: 1, minWidth: 0 }}>{cell}</span>
          ) : (
            cell
          )}
        </span>
      );
    },
    [editing, relationResolver, commitFieldEdit, firstColumnKey, favoriteIds, toggleFavorite],
  );

  // Commit a finished resize gesture into the working width set; the active
  // saved view (if any) picks it up through the implicit-save debounce.
  const handleColumnResize = React.useCallback((key: string, px: number) => {
    setColumnWidths((prev) => ({ ...prev, [key]: px }));
  }, []);

  /* ---- selection + bulk -------------------------------------------------- */

  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = React.useState(false);

  // Selection must not leak across object / query / view changes.
  React.useEffect(() => {
    setSelected(new Set());
  }, [objectSlug, q, wireFilters, viewType, page, refreshTick]);

  const handleBulkDelete = React.useCallback(() => {
    const ids = Array.from(selected);
    if (ids.length === 0 || bulkBusy) return;
    setBulkBusy(true);
    setMutationError(null);
    void (async () => {
      const res = await bulkDeleteRecordsTw(
        objectSlug,
        ids,
        activeProjectId ?? undefined,
      );
      setBulkBusy(false);
      if (!res.ok) {
        setMutationError(res.error);
        return;
      }
      setSelected(new Set());
      refresh();
    })();
  }, [selected, bulkBusy, objectSlug, activeProjectId, refresh]);

  // Bulk "move to <stage>" — the generic bulk-update over the group field.
  const handleBulkMove = React.useCallback(
    (value: string | null) => {
      if (!value || !groupField) return;
      const ids = Array.from(selected);
      if (ids.length === 0 || bulkBusy) return;
      setBulkBusy(true);
      setMutationError(null);
      void (async () => {
        const res = await bulkUpdateRecordsTw(
          objectSlug,
          ids,
          { [groupField.key]: value },
          activeProjectId ?? undefined,
        );
        setBulkBusy(false);
        if (!res.ok) {
          setMutationError(res.error);
          return;
        }
        setSelected(new Set());
        refresh();
      })();
    },
    [selected, bulkBusy, groupField, objectSlug, activeProjectId, refresh],
  );

  /* ---- pipelines (stage governance: lost reasons + approval requests) ---- */

  // The object's pipelines, for client-side governance UX (the server-side
  // gate in `checkSabcrmStageMove` stays authoritative). Resolution mirrors
  // its `findGoverningPipeline`: pipelines targeting this object that declare
  // the target stage, preferring the default pipeline.
  const [pipelines, setPipelines] = React.useState<SabcrmRustPipeline[]>([]);

  React.useEffect(() => {
    if (!objectSlug) return;
    let cancelled = false;
    void (async () => {
      const res = await listPipelinesTw(activeProjectId ?? undefined);
      if (cancelled || !res.ok) return;
      setPipelines(res.data.filter((p) => p.object === objectSlug));
    })();
    return () => {
      cancelled = true;
    };
  }, [objectSlug, activeProjectId]);

  const governingPipelineFor = React.useCallback(
    (toStageId: string): SabcrmRustPipeline | undefined => {
      const candidates = pipelines.filter((p) =>
        (p.stages ?? []).some((s) => String(s.id) === toStageId),
      );
      return candidates.find((p) => p.isDefault) ?? candidates[0];
    },
    [pipelines],
  );

  /* ---- board move (optimistic + stage gate) ------------------------------ */

  // Lost reason captured by the dialog for one (record → column) move, picked
  // up by `handleBoardMove` so the stage + `lostReason` land in ONE update.
  const pendingLostReasonsRef = React.useRef(new Map<string, string>());

  /** Live "Why was this lost?" prompt — resolves the awaiting canMove gate. */
  const [lostPrompt, setLostPrompt] = React.useState<{
    stageLabel: string;
    reasons: string[];
    resolve: (reason: string | null) => void;
  } | null>(null);

  /** Follow-up affordance after an approval-gated drop snapped back. */
  const [approvalPrompt, setApprovalPrompt] = React.useState<{
    recordId: string;
    toStageId: string;
    pipelineId: string;
    fromStageId?: string;
    message: string;
  } | null>(null);
  const [requestingApproval, setRequestingApproval] = React.useState(false);
  const [approvalNotice, setApprovalNotice] = React.useState<string | null>(
    null,
  );

  // The "Approval requested" confirmation self-dismisses.
  React.useEffect(() => {
    if (!approvalNotice) return;
    const t = window.setTimeout(() => setApprovalNotice(null), 6000);
    return () => window.clearTimeout(t);
  }, [approvalNotice]);

  const handleBoardMove = React.useCallback(
    (recordId: string, toColumnId: string) => {
      if (!groupField) return;
      const current = boardRust.find((r) => r.id === recordId);
      const prev = current?.data?.[groupField.key];
      const prevLostReason = current?.data?.lostReason;
      // A lost reason captured by the dialog rides the SAME update call.
      const lostKey = `${recordId}:${toColumnId}`;
      const lostReason = pendingLostReasonsRef.current.get(lostKey);
      pendingLostReasonsRef.current.delete(lostKey);
      const patch: Record<string, unknown> = { [groupField.key]: toColumnId };
      if (lostReason !== undefined) patch.lostReason = lostReason;
      patchLocal(recordId, patch);
      setMutationError(null);
      void (async () => {
        const res = await updateSabcrmRecordTw(
          objectSlug,
          recordId,
          patch,
          activeProjectId ?? undefined,
        );
        if (!res.ok) {
          const rollback: Record<string, unknown> = {
            [groupField.key]: prev,
          };
          if (lostReason !== undefined) rollback.lostReason = prevLostReason;
          patchLocal(recordId, rollback);
          setMutationError(res.error);
        }
      })();
    },
    [groupField, boardRust, patchLocal, objectSlug, activeProjectId],
  );

  const canMove = React.useCallback(
    async (
      record: CrmRecord,
      toColumnId: string,
    ): Promise<RecordBoardGateVerdict> => {
      const v = await checkSabcrmStageMove(
        activeProjectId ?? undefined,
        objectSlug,
        record._id,
        toColumnId,
      );
      if (!v.ok) {
        // Approval gate with no request yet → offer to raise one (the board
        // still snaps back + shows the reason banner).
        if (v.kind === 'approval' && !v.pendingApprovalId) {
          const pipeline = governingPipelineFor(toColumnId);
          if (pipeline) {
            const from = groupField ? record.data[groupField.key] : undefined;
            setApprovalPrompt({
              recordId: record._id,
              toStageId: toColumnId,
              pipelineId: pipeline.id,
              fromStageId:
                from === null || from === undefined || from === ''
                  ? undefined
                  : String(from),
              message: v.message,
            });
          }
        }
        return { ok: false, reason: v.message, kind: v.kind };
      }

      // Required lost-reason interception (pipeline `lostReasonRequired` +
      // lost-type target stage — see `isLostStage` for the heuristic): block
      // the commit on a small prompt; Cancel snaps the card back.
      const pipeline = governingPipelineFor(toColumnId);
      const stage = pipeline
        ? (pipeline.stages ?? []).find((s) => String(s.id) === toColumnId)
        : undefined;
      if (pipeline?.lostReasonRequired && stage && isLostStage(stage)) {
        const reason = await new Promise<string | null>((resolve) => {
          setLostPrompt({
            stageLabel: stage.label || toColumnId,
            reasons: pipeline.lostReasons ?? [],
            resolve,
          });
        });
        setLostPrompt(null);
        if (reason === null) {
          return {
            ok: false,
            reason: 'Move cancelled — a lost reason is required.',
            kind: 'required-fields',
          };
        }
        pendingLostReasonsRef.current.set(`${record._id}:${toColumnId}`, reason);
      }

      return { ok: true };
    },
    [activeProjectId, objectSlug, governingPipelineFor, groupField],
  );

  const submitApprovalRequest = React.useCallback(() => {
    const prompt = approvalPrompt;
    if (!prompt || requestingApproval) return;
    setRequestingApproval(true);
    void (async () => {
      const res = await requestSabcrmStageApproval(
        {
          objectSlug,
          recordId: prompt.recordId,
          pipelineId: prompt.pipelineId,
          fromStageId: prompt.fromStageId,
          toStageId: prompt.toStageId,
        },
        activeProjectId ?? undefined,
      );
      setRequestingApproval(false);
      setApprovalPrompt(null);
      if (!res.ok) {
        setMutationError(res.error);
        return;
      }
      setApprovalNotice(
        'Approval requested — the move will unlock once it is approved.',
      );
    })();
  }, [approvalPrompt, requestingApproval, objectSlug, activeProjectId]);

  /* ---- create ------------------------------------------------------------ */

  const [createOpen, setCreateOpen] = React.useState(false);

  /* ---- navigation -------------------------------------------------------- */

  const openRecord = React.useCallback(
    (record: CrmRecord) => {
      router.push(`/sabcrm/${objectSlug}/${record._id}`);
    },
    [router, objectSlug],
  );

  /* ---- render ------------------------------------------------------------ */

  const rootStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--st-space-3, 12px)',
    padding: 'var(--st-space-4, 16px)',
    minHeight: 0,
    flex: 1,
    fontFamily: 'var(--st-font, inherit)',
    color: 'var(--st-text, inherit)',
  };

  if (loadingObject) {
    return (
      <div className="20ui" style={rootStyle}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 240,
          }}
        >
          <Spinner aria-label="Loading object" />
        </div>
      </div>
    );
  }

  if (objectError) {
    return (
      <div className="20ui" style={rootStyle}>
        <Alert tone="danger" title="Could not load this object">
          {objectError}
        </Alert>
        <div>
          <Button variant="secondary" iconLeft={RotateCw} onClick={refresh}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (!object) {
    return (
      <div className="20ui" style={rootStyle}>
        <EmptyState
          icon={Database}
          title="Object not found"
          description={`No object named “${objectSlug}” exists in this workspace.`}
        />
      </div>
    );
  }

  const showBoard = viewType === 'board' && !!groupField;

  return (
    <div
      className={`20ui${density === 'compact' ? ' st-density-compact' : ''}`}
      style={rootStyle}
    >
      <ViewBar
        object={object}
        fields={object.fields}
        filters={filters}
        onFiltersChange={setFilters}
        sorts={sorts}
        onSortsChange={setSorts}
        groupBy={groupBy}
        onGroupByChange={setGroupBy}
        savedViews={savedViews}
        activeViewId={activeViewId}
        onSelectView={handleSelectView}
        onSaveView={handleSaveView}
        onUpdateView={handleUpdateView}
        onDeleteView={handleDeleteView}
        view={viewType}
        onViewTypeChange={setViewType}
        availableViews={availableViews}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        density={density}
        onDensityChange={setDensity}
        trailing={
          <Button
            variant="primary"
            size="sm"
            iconLeft={Plus}
            onClick={() => setCreateOpen(true)}
          >
            New {object.labelSingular.toLowerCase()}
          </Button>
        }
      />

      {mutationError ? (
        <Alert
          tone="danger"
          title="Change failed"
          onClose={() => setMutationError(null)}
        >
          {mutationError}
        </Alert>
      ) : null}

      {approvalNotice ? (
        <Alert
          tone="success"
          title="Approval requested"
          onClose={() => setApprovalNotice(null)}
        >
          {approvalNotice}
        </Alert>
      ) : null}

      {showBoard ? (
        boardError ? (
          <Alert tone="danger" title="Could not load the board">
            {boardError}
            <div style={{ marginTop: 'var(--st-space-2, 8px)' }}>
              <Button
                variant="secondary"
                size="sm"
                iconLeft={RotateCw}
                onClick={refresh}
              >
                Retry
              </Button>
            </div>
          </Alert>
        ) : (
          <RecordBoard
            columns={boardColumns}
            records={boardRecords}
            groupKey={groupField!.key}
            loading={boardLoading}
            renderCard={(record) => (
              <span style={{ fontSize: 'var(--st-font-size-sm, 12px)' }}>
                {sabcrmRecordLabel(object, {
                  id: record._id,
                  data: record.data,
                })}
              </span>
            )}
            onMove={handleBoardMove}
            canMove={canMove}
            onCardClick={openRecord}
            columnFooter={boardColumnFooter}
            emptyState={
              <EmptyState
                icon={Inbox}
                title={`No ${object.labelPlural.toLowerCase()} yet`}
                description="Create the first record to populate this board."
                action={
                  <Button
                    variant="primary"
                    size="sm"
                    iconLeft={Plus}
                    onClick={() => setCreateOpen(true)}
                  >
                    New {object.labelSingular.toLowerCase()}
                  </Button>
                }
              />
            }
          />
        )
      ) : dataError ? (
        <Alert tone="danger" title="Could not load records">
          {dataError}
          <div style={{ marginTop: 'var(--st-space-2, 8px)' }}>
            <Button
              variant="secondary"
              size="sm"
              iconLeft={RotateCw}
              onClick={refresh}
            >
              Retry
            </Button>
          </div>
        </Alert>
      ) : (
        <RecordGrid
          object={object}
          fields={columns}
          records={records}
          total={total}
          loading={loadingData}
          renderCell={renderCell}
          onRowClick={openRecord}
          selection={{ selected, onChange: setSelected }}
          columnWidths={columnWidths}
          onColumnResize={handleColumnResize}
          sort={
            sorts[0] ? { key: sorts[0].fieldKey, dir: sorts[0].dir } : null
          }
          onSortChange={(s) =>
            setSorts(s ? [{ fieldKey: s.key, dir: s.dir }] : [])
          }
          emptyState={
            <EmptyState
              icon={Inbox}
              title={
                q || countLeaves(filters) > 0
                  ? 'No records match'
                  : `No ${object.labelPlural.toLowerCase()} yet`
              }
              description={
                q || countLeaves(filters) > 0
                  ? 'Try clearing the search or filters.'
                  : 'Create the first record to get started.'
              }
              action={
                <Button
                  variant="primary"
                  size="sm"
                  iconLeft={Plus}
                  onClick={() => setCreateOpen(true)}
                >
                  New {object.labelSingular.toLowerCase()}
                </Button>
              }
            />
          }
          footer={
            <GridPagination
              page={page}
              pageSize={pageSize}
              total={total}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(1);
              }}
            />
          }
        />
      )}

      <BulkBar
        count={selected.size}
        onClear={() => setSelected(new Set())}
        label={selected.size === 1 ? 'record selected' : 'records selected'}
      >
        {groupField ? (
          <Select
            size="sm"
            value={null}
            onChange={handleBulkMove}
            options={(groupField.options ?? []).map((o) => ({
              value: o.value,
              label: o.label,
            }))}
            placeholder={`Set ${groupField.label.toLowerCase()}…`}
            aria-label={`Set ${groupField.label} for selected records`}
          />
        ) : null}
        <Button
          variant="danger"
          size="sm"
          iconLeft={Trash2}
          loading={bulkBusy}
          onClick={handleBulkDelete}
        >
          Delete
        </Button>
      </BulkBar>

      {createOpen ? (
        <CreateRecordDialog
          object={object}
          projectId={activeProjectId}
          relationResolver={relationResolver}
          onClose={() => setCreateOpen(false)}
          onCreated={refresh}
        />
      ) : null}

      {lostPrompt ? (
        <LostReasonDialog
          stageLabel={lostPrompt.stageLabel}
          reasons={lostPrompt.reasons}
          onSubmit={(reason) => lostPrompt.resolve(reason)}
          onCancel={() => lostPrompt.resolve(null)}
        />
      ) : null}

      {approvalPrompt ? (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open && !requestingApproval) setApprovalPrompt(null);
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Approval required</DialogTitle>
              <DialogDescription>
                {approvalPrompt.message} Request it now? The card stays where
                it is until the request is approved.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="ghost"
                disabled={requestingApproval}
                onClick={() => setApprovalPrompt(null)}
              >
                Not now
              </Button>
              <Button
                variant="primary"
                loading={requestingApproval}
                onClick={submitApprovalRequest}
              >
                Request approval
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}

export default RecordSurface;
