'use client';

/**
 * SabCRM - Record Layout settings (`/dashboard/settings/crm/page-layouts`).
 *
 * Configure the tabs + widgets shown on each object's record page, the
 * SabNode-native re-implementation of Twenty's page-layout editor
 * (tabs -> widgets, see `docs/twenty-review/08-front-record-show-activities.md`).
 *
 * Layout:
 *   - Left rail: the object selector. Objects come from `listSabcrmObjectsTw`;
 *     picking one loads its saved layout via `getPageLayoutTw(object)`.
 *   - Right column: the editor. A vertical list of TABS, each can be renamed,
 *     reordered (up/down) and removed; each tab holds an ordered list of
 *     WIDGETS that can be added (via a type picker), renamed, reordered and
 *     removed.
 *
 * Persistence:
 *   - `savePageLayoutTw(object, tabs)` writes the working draft.
 *   - `resetPageLayoutTw(object)` clears overrides -> server default.
 *   - When an object has no stored layout, a sensible default is seeded
 *     locally (Fields tab + Notes / Tasks / Activity) so the editor is never
 *     empty.
 *
 * Every action independently re-runs the session -> project -> RBAC -> plan
 * pipeline server-side, so the page fails closed. States: skeletons while
 * objects / layout load, "no project" notice, empty object list, error
 * banners, and graceful degradation when the engine is unreachable.
 *
 * This is a client page: it imports only the server-action contract (no
 * `server-only` modules) and keeps all layout structure in React state.
 *
 * Pure 20ui: every control is a 20ui primitive, colour comes from `--st-*`
 * tokens scoped under the page's `.ui20` root.
 */

import * as React from 'react';
import {
  LayoutPanelTop,
  AlertTriangle,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  GripVertical,
  Save,
  RotateCcw,
  // widget-type glyphs
  AlignLeft,
  StickyNote,
  CheckSquare,
  Clock,
  Paperclip,
  Table2,
  FileText,
  BarChart3,
  Globe,
} from 'lucide-react';

import {
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageDescription,
  Button,
  IconButton,
  Input,
  Badge,
  Modal,
  Alert,
  EmptyState,
  Skeleton,
  useToast,
} from '@/components/sabcrm/20ui';
import { useProject } from '@/context/project-context';
import { listSabcrmObjectsTw } from '@/app/actions/sabcrm-twenty.actions';
import {
  getPageLayoutTw,
  savePageLayoutTw,
  resetPageLayoutTw,
} from '@/app/actions/sabcrm-page-layouts.actions';
import type { ObjectMetadata } from '@/lib/sabcrm/types';

// ---------------------------------------------------------------------------
// Wire shapes
//
// Declared locally to keep this client page free of any `server-only` import.
// Mirror the `getPageLayoutTw` / `savePageLayoutTw` contract documented in
// `@/app/actions/sabcrm-page-layouts.actions`:
//   layout = { object, tabs: [{ id, title, widgets: [{ id, type, title, config }] }] }
// ---------------------------------------------------------------------------

type WidgetType =
  | 'FIELDS'
  | 'NOTES'
  | 'TASKS'
  | 'TIMELINE'
  | 'FILES'
  | 'RECORD_TABLE'
  | 'RICH_TEXT'
  | 'GRAPH'
  | 'IFRAME';

interface LayoutWidget {
  id: string;
  type: WidgetType;
  title: string;
  config?: Record<string, unknown>;
}

interface LayoutTab {
  id: string;
  title: string;
  widgets: LayoutWidget[];
}

interface PageLayout {
  object: string;
  tabs: LayoutTab[];
}

// ---------------------------------------------------------------------------
// Widget catalog: type -> label, description and glyph for the picker + rows.
// ---------------------------------------------------------------------------

interface WidgetTypeInfo {
  label: string;
  desc: string;
  Icon: React.ElementType;
}

const WIDGET_TYPES: Record<WidgetType, WidgetTypeInfo> = {
  FIELDS: {
    label: 'Fields',
    desc: 'Grouped block of record fields, the classic details panel.',
    Icon: AlignLeft,
  },
  NOTES: {
    label: 'Notes',
    desc: 'Notes attached to this record.',
    Icon: StickyNote,
  },
  TASKS: {
    label: 'Tasks',
    desc: 'Tasks linked to this record.',
    Icon: CheckSquare,
  },
  TIMELINE: {
    label: 'Timeline',
    desc: 'Chronological activity feed for the record.',
    Icon: Clock,
  },
  FILES: {
    label: 'Files',
    desc: 'Attachments and files for this record.',
    Icon: Paperclip,
  },
  RECORD_TABLE: {
    label: 'Related list',
    desc: 'Embedded table of related records.',
    Icon: Table2,
  },
  RICH_TEXT: {
    label: 'Rich text',
    desc: 'A free-floating rich-text note in the layout.',
    Icon: FileText,
  },
  GRAPH: {
    label: 'Graph',
    desc: 'Data-viz chart (bar, line, pie, number).',
    Icon: BarChart3,
  },
  IFRAME: {
    label: 'Embed',
    desc: 'Embed an external URL in an iframe.',
    Icon: Globe,
  },
};

const WIDGET_TYPE_ORDER: WidgetType[] = [
  'FIELDS',
  'NOTES',
  'TASKS',
  'TIMELINE',
  'FILES',
  'RECORD_TABLE',
  'RICH_TEXT',
  'GRAPH',
  'IFRAME',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Best-effort unique id; falls back when `crypto.randomUUID` is unavailable. */
function makeId(prefix: string): string {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return `${prefix}_${crypto.randomUUID()}`;
    }
  } catch {
    /* ignore */
  }
  return `${prefix}_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

/** A fresh widget of the given type, titled with its catalog label. */
function makeWidget(type: WidgetType): LayoutWidget {
  return { id: makeId('w'), type, title: WIDGET_TYPES[type].label };
}

/**
 * The seeded default layout for an object with no stored override:
 * a Fields ("Details") tab plus an Activity tab carrying Notes / Tasks /
 * Timeline. Used both when the server returns no tabs and as the "reset"
 * preview before a save.
 */
function defaultLayout(object: string): PageLayout {
  return {
    object,
    tabs: [
      {
        id: makeId('tab'),
        title: 'Details',
        widgets: [makeWidget('FIELDS')],
      },
      {
        id: makeId('tab'),
        title: 'Activity',
        widgets: [makeWidget('NOTES'), makeWidget('TASKS'), makeWidget('TIMELINE')],
      },
    ],
  };
}

/**
 * Normalises an arbitrary server payload into a well-formed {@link PageLayout}.
 * Defends against missing ids / titles / unknown widget types so the editor
 * always has something coherent to render.
 */
function normalizeLayout(object: string, raw: unknown): PageLayout {
  const tabsRaw =
    raw && typeof raw === 'object' && Array.isArray((raw as PageLayout).tabs)
      ? (raw as PageLayout).tabs
      : null;

  if (!tabsRaw || tabsRaw.length === 0) return defaultLayout(object);

  const tabs: LayoutTab[] = tabsRaw.map((t) => {
    const widgetsRaw = Array.isArray(t?.widgets) ? t.widgets : [];
    const widgets: LayoutWidget[] = widgetsRaw.map((w) => {
      const type: WidgetType =
        w && typeof w.type === 'string' && w.type in WIDGET_TYPES
          ? (w.type as WidgetType)
          : 'FIELDS';
      return {
        id: typeof w?.id === 'string' && w.id ? w.id : makeId('w'),
        type,
        title:
          typeof w?.title === 'string' && w.title.trim()
            ? w.title
            : WIDGET_TYPES[type].label,
        config:
          w && typeof w.config === 'object' && w.config
            ? (w.config as Record<string, unknown>)
            : undefined,
      };
    });
    return {
      id: typeof t?.id === 'string' && t.id ? t.id : makeId('tab'),
      title: typeof t?.title === 'string' && t.title.trim() ? t.title : 'Untitled tab',
      widgets,
    };
  });

  return { object, tabs };
}

/** Immutably move an array item by `delta` (clamped). Returns the same ref if no-op. */
function moveItem<T>(arr: T[], index: number, delta: number): T[] {
  const next = index + delta;
  if (next < 0 || next >= arr.length) return arr;
  const copy = arr.slice();
  const [item] = copy.splice(index, 1);
  copy.splice(next, 0, item);
  return copy;
}

// ---------------------------------------------------------------------------
// Widget type picker dialog
// ---------------------------------------------------------------------------

interface TypePickerProps {
  open: boolean;
  onPick: (type: WidgetType) => void;
  onClose: () => void;
}

function TypePicker({ open, onPick, onClose }: TypePickerProps): React.JSX.Element {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add widget"
      description="Pick a widget type to append to this tab."
      size="md"
    >
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {WIDGET_TYPE_ORDER.map((type) => {
          const info = WIDGET_TYPES[type];
          const { Icon } = info;
          return (
            <Button
              key={type}
              variant="outline"
              onClick={() => onPick(type)}
              className="!h-auto items-start !justify-start gap-3 !p-3 text-left"
            >
              <span className="flex w-full items-start gap-3">
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--st-radius-sm)] bg-[var(--st-bg-secondary)] text-[var(--st-text-secondary)]"
                  aria-hidden="true"
                >
                  <Icon size={18} />
                </span>
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-sm font-medium text-[var(--st-text)]">
                    {info.label}
                  </span>
                  <span className="whitespace-normal text-xs font-normal leading-snug text-[var(--st-text-secondary)]">
                    {info.desc}
                  </span>
                </span>
              </span>
            </Button>
          );
        })}
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Widget row
// ---------------------------------------------------------------------------

interface WidgetRowProps {
  widget: LayoutWidget;
  index: number;
  total: number;
  onRename: (id: string, title: string) => void;
  onMove: (id: string, delta: number) => void;
  onRemove: (id: string) => void;
}

function WidgetRow({
  widget,
  index,
  total,
  onRename,
  onMove,
  onRemove,
}: WidgetRowProps): React.JSX.Element {
  const info = WIDGET_TYPES[widget.type];
  const { Icon } = info;
  return (
    <div className="flex items-center gap-2 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg)] p-2">
      <span className="cursor-grab text-[var(--st-text-tertiary)]" aria-hidden="true">
        <GripVertical size={14} />
      </span>
      <span
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--st-radius-sm)] bg-[var(--st-bg-secondary)] text-[var(--st-text-secondary)]"
        aria-hidden="true"
        title={info.label}
      >
        <Icon size={15} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-wide text-[var(--st-text-tertiary)]">
          {info.label}
        </span>
        <Input
          inputSize="sm"
          value={widget.title}
          aria-label="Widget title"
          onChange={(e) => onRename(widget.id, e.target.value)}
          placeholder={info.label}
        />
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <IconButton
          label="Move widget up"
          icon={ChevronUp}
          size="sm"
          onClick={() => onMove(widget.id, -1)}
          disabled={index === 0}
        />
        <IconButton
          label="Move widget down"
          icon={ChevronDown}
          size="sm"
          onClick={() => onMove(widget.id, 1)}
          disabled={index === total - 1}
        />
        <IconButton
          label="Remove widget"
          icon={Trash2}
          size="sm"
          variant="danger"
          onClick={() => onRemove(widget.id)}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab card
// ---------------------------------------------------------------------------

interface TabCardProps {
  tab: LayoutTab;
  index: number;
  total: number;
  onRenameTab: (id: string, title: string) => void;
  onMoveTab: (id: string, delta: number) => void;
  onRemoveTab: (id: string) => void;
  onAddWidget: (tabId: string) => void;
  onRenameWidget: (tabId: string, widgetId: string, title: string) => void;
  onMoveWidget: (tabId: string, widgetId: string, delta: number) => void;
  onRemoveWidget: (tabId: string, widgetId: string) => void;
}

function TabCard({
  tab,
  index,
  total,
  onRenameTab,
  onMoveTab,
  onRemoveTab,
  onAddWidget,
  onRenameWidget,
  onMoveWidget,
  onRemoveWidget,
}: TabCardProps): React.JSX.Element {
  return (
    <div className="rounded-[var(--st-radius-lg)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-3">
      <div className="flex items-center gap-2">
        <span className="cursor-grab text-[var(--st-text-tertiary)]" aria-hidden="true">
          <GripVertical size={15} />
        </span>
        <div className="min-w-0 flex-1">
          <Input
            inputSize="sm"
            value={tab.title}
            aria-label="Tab title"
            onChange={(e) => onRenameTab(tab.id, e.target.value)}
            placeholder="Tab title"
          />
        </div>
        <span className="shrink-0 whitespace-nowrap text-xs text-[var(--st-text-secondary)]">
          {tab.widgets.length} widget{tab.widgets.length !== 1 ? 's' : ''}
        </span>
        <div className="flex shrink-0 items-center gap-1">
          <IconButton
            label="Move tab up"
            icon={ChevronUp}
            size="sm"
            onClick={() => onMoveTab(tab.id, -1)}
            disabled={index === 0}
          />
          <IconButton
            label="Move tab down"
            icon={ChevronDown}
            size="sm"
            onClick={() => onMoveTab(tab.id, 1)}
            disabled={index === total - 1}
          />
          <IconButton
            label={total <= 1 ? 'A layout needs at least one tab' : 'Remove tab'}
            icon={Trash2}
            size="sm"
            variant="danger"
            onClick={() => onRemoveTab(tab.id)}
            disabled={total <= 1}
          />
        </div>
      </div>

      {tab.widgets.length === 0 ? (
        <p className="mt-3 rounded-[var(--st-radius)] border border-dashed border-[var(--st-border)] px-3 py-4 text-center text-sm text-[var(--st-text-secondary)]">
          No widgets yet. Add one to fill this tab.
        </p>
      ) : (
        <div className="mt-3 flex flex-col gap-2">
          {tab.widgets.map((w, wi) => (
            <WidgetRow
              key={w.id}
              widget={w}
              index={wi}
              total={tab.widgets.length}
              onRename={(id, title) => onRenameWidget(tab.id, id, title)}
              onMove={(id, delta) => onMoveWidget(tab.id, id, delta)}
              onRemove={(id) => onRemoveWidget(tab.id, id)}
            />
          ))}
        </div>
      )}

      <div className="mt-3">
        <Button variant="secondary" iconLeft={Plus} onClick={() => onAddWidget(tab.id)}>
          Add widget
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeletons
// ---------------------------------------------------------------------------

function EditorSkeleton(): React.JSX.Element {
  return (
    <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
      <div className="flex flex-col gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} height={34} radius={6} />
        ))}
      </div>
      <div className="flex flex-col gap-4">
        <Skeleton height={140} radius={10} />
        <Skeleton height={140} radius={10} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SabcrmPageLayoutsSettingsPage(): React.JSX.Element {
  const { activeProjectId, isLoadingProject } = useProject();
  const { toast } = useToast();

  // Object list
  const [objects, setObjects] = React.useState<ObjectMetadata[]>([]);
  const [objectsLoading, setObjectsLoading] = React.useState(true);
  const [objectsError, setObjectsError] = React.useState<string | null>(null);

  // Selected object + its working layout
  const [selectedSlug, setSelectedSlug] = React.useState<string | null>(null);
  const [layout, setLayout] = React.useState<PageLayout | null>(null);
  const [layoutLoading, setLayoutLoading] = React.useState(false);
  const [layoutError, setLayoutError] = React.useState<string | null>(null);

  // Mutation / draft state
  const [dirty, setDirty] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [resetting, setResetting] = React.useState(false);

  // Add-widget dialog -> which tab to append to
  const [pickerTabId, setPickerTabId] = React.useState<string | null>(null);

  // ----- Loaders -----

  const loadObjects = React.useCallback(async (projectId: string) => {
    setObjectsLoading(true);
    setObjectsError(null);
    try {
      const res = await listSabcrmObjectsTw(projectId);
      if (res.ok) {
        setObjects(res.data);
        // Auto-select the first object so the editor isn't empty on entry.
        setSelectedSlug((prev) => prev ?? res.data[0]?.slug ?? null);
      } else {
        setObjectsError(res.error);
      }
    } catch {
      setObjectsError('Objects could not be loaded. The service may be unavailable.');
    } finally {
      setObjectsLoading(false);
    }
  }, []);

  const loadLayout = React.useCallback(async (projectId: string, slug: string) => {
    setLayoutLoading(true);
    setLayoutError(null);
    setDirty(false);
    try {
      const res = await getPageLayoutTw(slug, projectId);
      if (res.ok) {
        setLayout(normalizeLayout(slug, res.data));
      } else {
        setLayoutError(res.error);
        setLayout(null);
      }
    } catch {
      setLayoutError(
        "This object's layout could not be loaded. The service may be unavailable.",
      );
      setLayout(null);
    } finally {
      setLayoutLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (isLoadingProject) return;
    if (!activeProjectId) {
      setObjectsLoading(false);
      return;
    }
    void loadObjects(activeProjectId);
  }, [activeProjectId, isLoadingProject, loadObjects]);

  React.useEffect(() => {
    if (!activeProjectId || !selectedSlug) return;
    void loadLayout(activeProjectId, selectedSlug);
  }, [activeProjectId, selectedSlug, loadLayout]);

  // ----- Layout mutators (all immutable, all flag dirty) -----

  /** Apply a transform to the working tabs and mark the draft dirty. */
  const mutateTabs = React.useCallback((fn: (tabs: LayoutTab[]) => LayoutTab[]) => {
    setLayout((prev) => (prev ? { ...prev, tabs: fn(prev.tabs) } : prev));
    setDirty(true);
  }, []);

  const handleAddTab = React.useCallback(() => {
    mutateTabs((tabs) => [
      ...tabs,
      { id: makeId('tab'), title: `Tab ${tabs.length + 1}`, widgets: [] },
    ]);
  }, [mutateTabs]);

  const handleRenameTab = React.useCallback(
    (id: string, title: string) => {
      mutateTabs((tabs) => tabs.map((t) => (t.id === id ? { ...t, title } : t)));
    },
    [mutateTabs],
  );

  const handleMoveTab = React.useCallback(
    (id: string, delta: number) => {
      mutateTabs((tabs) => {
        const i = tabs.findIndex((t) => t.id === id);
        return i < 0 ? tabs : moveItem(tabs, i, delta);
      });
    },
    [mutateTabs],
  );

  const handleRemoveTab = React.useCallback(
    (id: string) => {
      mutateTabs((tabs) => (tabs.length <= 1 ? tabs : tabs.filter((t) => t.id !== id)));
    },
    [mutateTabs],
  );

  const handleAddWidget = React.useCallback(
    (type: WidgetType) => {
      if (!pickerTabId) return;
      const tabId = pickerTabId;
      mutateTabs((tabs) =>
        tabs.map((t) =>
          t.id === tabId ? { ...t, widgets: [...t.widgets, makeWidget(type)] } : t,
        ),
      );
      setPickerTabId(null);
    },
    [mutateTabs, pickerTabId],
  );

  const handleRenameWidget = React.useCallback(
    (tabId: string, widgetId: string, title: string) => {
      mutateTabs((tabs) =>
        tabs.map((t) =>
          t.id === tabId
            ? {
                ...t,
                widgets: t.widgets.map((w) =>
                  w.id === widgetId ? { ...w, title } : w,
                ),
              }
            : t,
        ),
      );
    },
    [mutateTabs],
  );

  const handleMoveWidget = React.useCallback(
    (tabId: string, widgetId: string, delta: number) => {
      mutateTabs((tabs) =>
        tabs.map((t) => {
          if (t.id !== tabId) return t;
          const i = t.widgets.findIndex((w) => w.id === widgetId);
          return i < 0 ? t : { ...t, widgets: moveItem(t.widgets, i, delta) };
        }),
      );
    },
    [mutateTabs],
  );

  const handleRemoveWidget = React.useCallback(
    (tabId: string, widgetId: string) => {
      mutateTabs((tabs) =>
        tabs.map((t) =>
          t.id === tabId
            ? { ...t, widgets: t.widgets.filter((w) => w.id !== widgetId) }
            : t,
        ),
      );
    },
    [mutateTabs],
  );

  // ----- Persistence -----

  const handleSave = React.useCallback(async () => {
    if (!activeProjectId || !selectedSlug || !layout) return;
    setSaving(true);
    try {
      const res = await savePageLayoutTw(selectedSlug, layout.tabs, activeProjectId);
      if (res.ok) {
        setDirty(false);
        toast.success('Layout saved.');
        // Re-normalise from whatever the server echoes back, when provided.
        if (res.data) setLayout(normalizeLayout(selectedSlug, res.data));
      } else {
        toast.error(res.error);
      }
    } catch {
      toast.error('Failed to save the layout. The service may be unavailable.');
    } finally {
      setSaving(false);
    }
  }, [activeProjectId, selectedSlug, layout, toast]);

  const handleReset = React.useCallback(async () => {
    if (!activeProjectId || !selectedSlug) return;
    setResetting(true);
    try {
      // `resetPageLayoutTw` clears the override and reports `{ ok }`. It does
      // not echo the layout, so re-fetch the now-default layout to show it.
      const res = await resetPageLayoutTw(selectedSlug, activeProjectId);
      if (res.ok) {
        const after = await getPageLayoutTw(selectedSlug, activeProjectId);
        setLayout(normalizeLayout(selectedSlug, after.ok ? after.data : null));
        setDirty(false);
        toast.success('Layout reset to default.');
      } else {
        toast.error(res.error);
      }
    } catch {
      toast.error('Failed to reset the layout. The service may be unavailable.');
    } finally {
      setResetting(false);
    }
  }, [activeProjectId, selectedSlug, toast]);

  // ----- Derived -----

  const selectedObject = React.useMemo(
    () => objects.find((o) => o.slug === selectedSlug) ?? null,
    [objects, selectedSlug],
  );

  const busy = saving || resetting;

  // ----- Render -----

  return (
    <div className="ui20 min-h-full bg-[var(--st-bg)] px-6 py-6 text-[var(--st-text)]">
      <div className="mx-auto w-full max-w-5xl">
        <PageHeader>
          <PageHeaderHeading>
            <PageTitle>Record Layout</PageTitle>
            <PageDescription>
              Configure the tabs and widgets that appear on each object&apos;s record
              page. Pick an object, then arrange its tabs and the widgets inside them.
              Changes apply to every record of that object.
            </PageDescription>
          </PageHeaderHeading>
        </PageHeader>

        {isLoadingProject || objectsLoading ? (
          <EditorSkeleton />
        ) : !activeProjectId ? (
          <div className="mt-8">
            <EmptyState
              icon={AlertTriangle}
              tone="warning"
              title="No project selected"
              description="Select a project to configure its record layouts."
            />
          </div>
        ) : objectsError ? (
          <Alert tone="danger" icon={AlertTriangle} className="mt-6">
            {objectsError}
          </Alert>
        ) : objects.length === 0 ? (
          <div className="mt-8">
            <EmptyState
              icon={LayoutPanelTop}
              title="No objects found"
              description="This workspace has no CRM objects yet, or they could not be loaded."
            />
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
            {/* Object selector rail */}
            <nav className="flex flex-col gap-1" aria-label="Objects">
              <span className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-[var(--st-text-tertiary)]">
                Objects
              </span>
              {objects.map((obj) => {
                const active = obj.slug === selectedSlug;
                return (
                  <Button
                    key={obj.slug}
                    variant={active ? 'secondary' : 'ghost'}
                    iconLeft={LayoutPanelTop}
                    block
                    className="justify-start"
                    onClick={() => setSelectedSlug(obj.slug)}
                    aria-current={active ? 'true' : undefined}
                  >
                    {obj.labelPlural}
                  </Button>
                );
              })}
            </nav>

            {/* Editor */}
            <div className="min-w-0">
              {layoutLoading ? (
                <div className="flex flex-col gap-4">
                  <Skeleton height={140} radius={10} />
                  <Skeleton height={140} radius={10} />
                </div>
              ) : layoutError ? (
                <Alert tone="danger" icon={AlertTriangle}>
                  {layoutError}
                </Alert>
              ) : layout ? (
                <>
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-base font-semibold text-[var(--st-text)]">
                        {selectedObject?.labelSingular ?? selectedSlug} record page
                      </h2>
                      <p className="mt-0.5 text-sm text-[var(--st-text-secondary)]">
                        {layout.tabs.length} tab
                        {layout.tabs.length !== 1 ? 's' : ''} ,{' '}
                        {layout.tabs.reduce((n, t) => n + t.widgets.length, 0)} widget
                        {layout.tabs.reduce((n, t) => n + t.widgets.length, 0) !== 1
                          ? 's'
                          : ''}
                      </p>
                    </div>
                    {dirty ? (
                      <Badge tone="warning" dot>
                        Unsaved changes
                      </Badge>
                    ) : null}
                  </div>

                  <div className="flex flex-col gap-4">
                    {layout.tabs.map((tab, ti) => (
                      <TabCard
                        key={tab.id}
                        tab={tab}
                        index={ti}
                        total={layout.tabs.length}
                        onRenameTab={handleRenameTab}
                        onMoveTab={handleMoveTab}
                        onRemoveTab={handleRemoveTab}
                        onAddWidget={setPickerTabId}
                        onRenameWidget={handleRenameWidget}
                        onMoveWidget={handleMoveWidget}
                        onRemoveWidget={handleRemoveWidget}
                      />
                    ))}
                  </div>

                  <div className="mt-4">
                    <Button variant="secondary" iconLeft={Plus} onClick={handleAddTab}>
                      Add tab
                    </Button>
                  </div>

                  {/* Sticky save bar */}
                  <div className="sticky bottom-0 mt-6 flex flex-wrap items-center gap-3 border-t border-[var(--st-border)] bg-[var(--st-bg)] py-3">
                    <span className="mr-auto text-sm text-[var(--st-text-secondary)]">
                      {dirty ? 'You have unsaved changes.' : 'All changes saved.'}
                    </span>
                    <Button
                      variant="secondary"
                      iconLeft={RotateCcw}
                      onClick={handleReset}
                      loading={resetting}
                      disabled={busy}
                      title="Discard overrides and restore the default layout"
                    >
                      Reset to default
                    </Button>
                    <Button
                      variant="primary"
                      iconLeft={Save}
                      onClick={handleSave}
                      loading={saving}
                      disabled={busy || !dirty}
                    >
                      Save layout
                    </Button>
                  </div>
                </>
              ) : (
                <EmptyState
                  icon={LayoutPanelTop}
                  title="Select an object"
                  description="Choose an object from the list to edit its record layout."
                />
              )}
            </div>
          </div>
        )}
      </div>

      <TypePicker
        open={pickerTabId != null}
        onPick={handleAddWidget}
        onClose={() => setPickerTabId(null)}
      />
    </div>
  );
}
