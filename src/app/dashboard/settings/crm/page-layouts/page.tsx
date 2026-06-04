'use client';

/**
 * SabCRM — Record Layout settings (`/dashboard/settings/crm/page-layouts`),
 * Twenty-style.
 *
 * Configure the tabs + widgets shown on each object's record page — the
 * SabNode-native re-implementation of Twenty's page-layout editor
 * (tabs → widgets, see `docs/twenty-review/08-front-record-show-activities.md`).
 *
 * Layout:
 *   - Left rail: the object selector. Objects come from `listSabcrmObjectsTw`;
 *     picking one loads its saved layout via `getPageLayoutTw(object)`.
 *   - Right column: the editor. A vertical list of TABS — each can be renamed,
 *     reordered (up/down) and removed; each tab holds an ordered list of
 *     WIDGETS that can be added (via a type picker), renamed, reordered and
 *     removed.
 *
 * Persistence:
 *   - `savePageLayoutTw(object, tabs)` writes the working draft.
 *   - `resetPageLayoutTw(object)` clears overrides → server default.
 *   - When an object has no stored layout, a sensible default is seeded
 *     locally (Fields tab + Notes / Tasks / Activity) so the editor is never
 *     empty.
 *
 * Every action independently re-runs the session → project → RBAC → plan
 * pipeline server-side, so the page fails closed. States: skeletons while
 * objects / layout load, "no project" notice, empty object list, error
 * banners, and graceful degradation when the engine is unreachable.
 *
 * This is a client page: it imports only the server-action contract (no
 * `server-only` modules) and keeps all layout structure in React state.
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
  X,
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

import { TwentyPageHeader, TwentyButton } from '@/components/sabcrm/twenty';
import { useProject } from '@/context/project-context';
import { listSabcrmObjectsTw } from '@/app/actions/sabcrm-twenty.actions';
import {
  getPageLayoutTw,
  savePageLayoutTw,
  resetPageLayoutTw,
} from '@/app/actions/sabcrm-page-layouts.actions';
import type { ObjectMetadata } from '@/lib/sabcrm/types';

import '@/styles/sabcrm-twenty.css';
import '../settings-twenty.css';
import './page-layouts.css';

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
// Widget catalog — type → label, description and glyph for the picker + rows.
// ---------------------------------------------------------------------------

interface WidgetTypeInfo {
  label: string;
  desc: string;
  Icon: React.ElementType;
}

const WIDGET_TYPES: Record<WidgetType, WidgetTypeInfo> = {
  FIELDS: {
    label: 'Fields',
    desc: 'Grouped block of record fields — the classic details panel.',
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
    desc: 'Data-viz chart (bar / line / pie / number).',
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
  onPick: (type: WidgetType) => void;
  onClose: () => void;
}

function TypePicker({ onPick, onClose }: TypePickerProps): React.JSX.Element {
  return (
    <div
      className="st-dialog-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Add widget"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="st-dialog" style={{ maxWidth: 560 }}>
        <div className="st-dialog__header">
          <h2 className="st-dialog__title">Add widget</h2>
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
          <div className="stpl-typegrid">
            {WIDGET_TYPE_ORDER.map((type) => {
              const info = WIDGET_TYPES[type];
              const { Icon } = info;
              return (
                <button
                  key={type}
                  type="button"
                  className="stpl-typecard"
                  onClick={() => onPick(type)}
                >
                  <span className="stpl-typecard__icon" aria-hidden="true">
                    <Icon size={18} />
                  </span>
                  <span>
                    <span className="stpl-typecard__name">{info.label}</span>
                    <span className="stpl-typecard__desc">{info.desc}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
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
    <div className="stpl-widget">
      <span className="stpl-widget__grip" aria-hidden="true">
        <GripVertical size={14} />
      </span>
      <span className="stpl-widget__badge" aria-hidden="true" title={info.label}>
        <Icon size={15} />
      </span>
      <div className="stpl-widget__body">
        <span className="stpl-widget__type">{info.label}</span>
        <input
          className="stpl-widget__titleinput"
          value={widget.title}
          aria-label="Widget title"
          onChange={(e) => onRename(widget.id, e.target.value)}
          placeholder={info.label}
        />
      </div>
      <div className="stpl-widget__actions">
        <button
          type="button"
          className="stpl-iconbtn"
          onClick={() => onMove(widget.id, -1)}
          disabled={index === 0}
          aria-label="Move widget up"
          title="Move up"
        >
          <ChevronUp size={15} />
        </button>
        <button
          type="button"
          className="stpl-iconbtn"
          onClick={() => onMove(widget.id, 1)}
          disabled={index === total - 1}
          aria-label="Move widget down"
          title="Move down"
        >
          <ChevronDown size={15} />
        </button>
        <button
          type="button"
          className="stpl-iconbtn stpl-iconbtn--danger"
          onClick={() => onRemove(widget.id)}
          aria-label="Remove widget"
          title="Remove widget"
        >
          <Trash2 size={15} />
        </button>
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
    <div className="stpl-tab">
      <div className="stpl-tab__head">
        <span className="stpl-tab__grip" aria-hidden="true">
          <GripVertical size={15} />
        </span>
        <input
          className="stpl-titleinput"
          value={tab.title}
          aria-label="Tab title"
          onChange={(e) => onRenameTab(tab.id, e.target.value)}
          placeholder="Tab title"
        />
        <span className="stpl-tab__count">
          {tab.widgets.length} widget{tab.widgets.length !== 1 ? 's' : ''}
        </span>
        <button
          type="button"
          className="stpl-iconbtn"
          onClick={() => onMoveTab(tab.id, -1)}
          disabled={index === 0}
          aria-label="Move tab up"
          title="Move tab up"
        >
          <ChevronUp size={15} />
        </button>
        <button
          type="button"
          className="stpl-iconbtn"
          onClick={() => onMoveTab(tab.id, 1)}
          disabled={index === total - 1}
          aria-label="Move tab down"
          title="Move tab down"
        >
          <ChevronDown size={15} />
        </button>
        <button
          type="button"
          className="stpl-iconbtn stpl-iconbtn--danger"
          onClick={() => onRemoveTab(tab.id)}
          disabled={total <= 1}
          aria-label="Remove tab"
          title={total <= 1 ? 'A layout needs at least one tab' : 'Remove tab'}
        >
          <Trash2 size={15} />
        </button>
      </div>

      {tab.widgets.length === 0 ? (
        <div className="stpl-widgets-empty">
          No widgets yet — add one to fill this tab.
        </div>
      ) : (
        <div className="stpl-widgets">
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

      <div className="stpl-addwidget">
        <TwentyButton variant="secondary" icon={Plus} onClick={() => onAddWidget(tab.id)}>
          Add widget
        </TwentyButton>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeletons
// ---------------------------------------------------------------------------

function EditorSkeleton(): React.JSX.Element {
  return (
    <div className="stpl-shell">
      <div className="stpl-rail">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="stpl-skel stpl-skel--rail" />
        ))}
      </div>
      <div>
        <div className="stpl-skel stpl-skel--card" />
        <div className="stpl-skel stpl-skel--card" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SabcrmPageLayoutsSettingsPage(): React.JSX.Element {
  const { activeProjectId, isLoadingProject } = useProject();

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
  const [saveMsg, setSaveMsg] = React.useState<{ kind: 'ok' | 'error'; text: string } | null>(
    null,
  );

  // Add-widget dialog → which tab to append to
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

  const loadLayout = React.useCallback(
    async (projectId: string, slug: string) => {
      setLayoutLoading(true);
      setLayoutError(null);
      setSaveMsg(null);
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
        setLayoutError('This object’s layout could not be loaded. The service may be unavailable.');
        setLayout(null);
      } finally {
        setLayoutLoading(false);
      }
    },
    [],
  );

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
  const mutateTabs = React.useCallback(
    (fn: (tabs: LayoutTab[]) => LayoutTab[]) => {
      setLayout((prev) => (prev ? { ...prev, tabs: fn(prev.tabs) } : prev));
      setDirty(true);
      setSaveMsg(null);
    },
    [],
  );

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
    setSaveMsg(null);
    try {
      const res = await savePageLayoutTw(selectedSlug, layout.tabs, activeProjectId);
      if (res.ok) {
        setDirty(false);
        setSaveMsg({ kind: 'ok', text: 'Layout saved.' });
        // Re-normalise from whatever the server echoes back, when provided.
        if (res.data) setLayout(normalizeLayout(selectedSlug, res.data));
      } else {
        setSaveMsg({ kind: 'error', text: res.error });
      }
    } catch {
      setSaveMsg({
        kind: 'error',
        text: 'Failed to save the layout. The service may be unavailable.',
      });
    } finally {
      setSaving(false);
    }
  }, [activeProjectId, selectedSlug, layout]);

  const handleReset = React.useCallback(async () => {
    if (!activeProjectId || !selectedSlug) return;
    setResetting(true);
    setSaveMsg(null);
    try {
      // `resetPageLayoutTw` clears the override and reports `{ ok }` — it does
      // not echo the layout, so re-fetch the now-default layout to show it.
      const res = await resetPageLayoutTw(selectedSlug, activeProjectId);
      if (res.ok) {
        const after = await getPageLayoutTw(selectedSlug, activeProjectId);
        setLayout(
          normalizeLayout(selectedSlug, after.ok ? after.data : null),
        );
        setDirty(false);
        setSaveMsg({ kind: 'ok', text: 'Layout reset to default.' });
      } else {
        setSaveMsg({ kind: 'error', text: res.error });
      }
    } catch {
      setSaveMsg({
        kind: 'error',
        text: 'Failed to reset the layout. The service may be unavailable.',
      });
    } finally {
      setResetting(false);
    }
  }, [activeProjectId, selectedSlug]);

  // ----- Derived -----

  const selectedObject = React.useMemo(
    () => objects.find((o) => o.slug === selectedSlug) ?? null,
    [objects, selectedSlug],
  );

  const busy = saving || resetting;

  // ----- Render -----

  return (
    <div className="st-page">
      <div className="st-settings">
        <TwentyPageHeader title="Record Layout" icon={LayoutPanelTop} />
        <p className="st-settings__intro">
          Configure the tabs and widgets that appear on each object&apos;s record
          page. Pick an object, then arrange its tabs and the widgets inside
          them. Changes apply to every record of that object.
        </p>

        {isLoadingProject || objectsLoading ? (
          <EditorSkeleton />
        ) : !activeProjectId ? (
          <div className="st-empty">
            <span className="st-empty__icon">
              <AlertTriangle size={20} />
            </span>
            <h2 className="st-empty__title">No project selected</h2>
            <p className="st-empty__desc">
              Select a project to configure its record layouts.
            </p>
          </div>
        ) : objectsError ? (
          <div className="st-banner">
            <AlertTriangle className="st-banner__icon" size={16} />
            <span>{objectsError}</span>
          </div>
        ) : objects.length === 0 ? (
          <div className="st-empty">
            <span className="st-empty__icon">
              <LayoutPanelTop size={20} />
            </span>
            <h2 className="st-empty__title">No objects found</h2>
            <p className="st-empty__desc">
              This workspace has no CRM objects yet, or they could not be loaded.
            </p>
          </div>
        ) : (
          <div className="stpl-shell">
            {/* Object selector rail */}
            <nav className="stpl-rail" aria-label="Objects">
              <span className="stpl-rail__label">Objects</span>
              {objects.map((obj) => (
                <button
                  key={obj.slug}
                  type="button"
                  className={
                    'stpl-obj' + (obj.slug === selectedSlug ? ' is-active' : '')
                  }
                  onClick={() => setSelectedSlug(obj.slug)}
                  aria-current={obj.slug === selectedSlug ? 'true' : undefined}
                >
                  <span className="stpl-obj__icon" aria-hidden="true">
                    <LayoutPanelTop size={15} />
                  </span>
                  <span className="stpl-obj__label">{obj.labelPlural}</span>
                </button>
              ))}
            </nav>

            {/* Editor */}
            <div className="stpl-editor">
              {layoutLoading ? (
                <>
                  <div className="stpl-skel stpl-skel--card" />
                  <div className="stpl-skel stpl-skel--card" />
                </>
              ) : layoutError ? (
                <div className="st-banner">
                  <AlertTriangle className="st-banner__icon" size={16} />
                  <span>{layoutError}</span>
                </div>
              ) : layout ? (
                <>
                  <div className="stpl-editor__head">
                    <div>
                      <h2 className="stpl-editor__title">
                        {selectedObject?.labelSingular ?? selectedSlug} record page
                      </h2>
                      <p className="stpl-editor__sub">
                        {layout.tabs.length} tab
                        {layout.tabs.length !== 1 ? 's' : ''} ·{' '}
                        {layout.tabs.reduce((n, t) => n + t.widgets.length, 0)}{' '}
                        widget
                        {layout.tabs.reduce((n, t) => n + t.widgets.length, 0) !== 1
                          ? 's'
                          : ''}
                      </p>
                    </div>
                    {dirty ? (
                      <span className="stpl-dirty">
                        <span className="stpl-dirty__dot" aria-hidden="true" />
                        Unsaved changes
                      </span>
                    ) : null}
                  </div>

                  <div className="stpl-tabs">
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

                  <TwentyButton
                    className="stpl-addtab"
                    variant="secondary"
                    icon={Plus}
                    onClick={handleAddTab}
                  >
                    Add tab
                  </TwentyButton>

                  {/* Sticky save bar */}
                  <div className="stpl-savebar">
                    {saveMsg ? (
                      <span
                        className={
                          'stpl-savebar__msg ' +
                          (saveMsg.kind === 'error' ? 'is-error' : 'is-ok')
                        }
                      >
                        {saveMsg.text}
                      </span>
                    ) : (
                      <span className="stpl-savebar__msg is-ok">
                        {dirty
                          ? 'You have unsaved changes.'
                          : 'All changes saved.'}
                      </span>
                    )}
                    <TwentyButton
                      variant="secondary"
                      icon={RotateCcw}
                      onClick={handleReset}
                      disabled={busy}
                      title="Discard overrides and restore the default layout"
                    >
                      {resetting ? 'Resetting…' : 'Reset to default'}
                    </TwentyButton>
                    <TwentyButton
                      variant="primary"
                      icon={Save}
                      onClick={handleSave}
                      disabled={busy || !dirty}
                    >
                      {saving ? 'Saving…' : 'Save layout'}
                    </TwentyButton>
                  </div>
                </>
              ) : (
                <div className="st-empty">
                  <span className="st-empty__icon">
                    <LayoutPanelTop size={20} />
                  </span>
                  <h2 className="st-empty__title">Select an object</h2>
                  <p className="st-empty__desc">
                    Choose an object from the list to edit its record layout.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {pickerTabId ? (
        <TypePicker onPick={handleAddWidget} onClose={() => setPickerTabId(null)} />
      ) : null}
    </div>
  );
}
