'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Building2,
  Users,
  Briefcase,
  StickyNote,
  CheckCircle2,
  Settings,
  Search,
  LayoutDashboard,
  ListTodo,
  Keyboard,
  Clock,
  Star,
  type LucideIcon,
} from 'lucide-react';

import { searchRecordsForPickerAction } from '@/app/actions/sabcrm.actions';
import type { SabcrmPickerOption } from '@/app/actions/sabcrm.actions.types';
import { listSabcrmFavoritesTw } from '@/app/actions/sabcrm-twenty.actions';

import './twenty-command-menu.css';

/* =========================================================================
   Recently-viewed records — small localStorage helper

   We own this file, so we keep a self-contained list of the records the user
   most recently opened *through the menu*. It's read to render the "Recent"
   group when the query is empty, and pushed to whenever a record / recent /
   favorite row is selected. Capped + deduped, newest first.
   ========================================================================= */
const RECENTS_KEY = 'sabcrm:cmdk:recents';
const RECENTS_CAP = 8;

interface RecordRecent {
  /** URL object slug, e.g. "companies". */
  slug: string;
  /** Record id. */
  id: string;
  /** Display label captured at view time. */
  label: string;
}

function readRecents(): RecordRecent[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(RECENTS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (e): e is RecordRecent =>
          typeof e === 'object' &&
          e !== null &&
          typeof (e as RecordRecent).slug === 'string' &&
          typeof (e as RecordRecent).id === 'string' &&
          typeof (e as RecordRecent).label === 'string',
      )
      .slice(0, RECENTS_CAP);
  } catch {
    return [];
  }
}

function pushRecent(entry: RecordRecent): void {
  if (typeof window === 'undefined') return;
  try {
    const existing = readRecents().filter(
      (e) => !(e.slug === entry.slug && e.id === entry.id),
    );
    const next = [entry, ...existing].slice(0, RECENTS_CAP);
    window.localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable (private mode / quota) — recents simply won't persist */
  }
}

/** The exported helper, in case the host ever wants to seed recents directly. */
export const recordRecents = {
  read: readRecents,
  push: pushRecent,
};

/* =========================================================================
   Static "Navigate" commands
   ========================================================================= */
interface NavCommand {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
}

/** Object slugs we fan the record search out across. */
const SEARCH_OBJECT_SLUGS: readonly string[] = [
  'companies',
  'people',
  'opportunities',
  'notes',
  'tasks',
] as const;

const NAV_COMMANDS: readonly NavCommand[] = [
  { id: 'nav-companies', label: 'Companies', href: '/sabcrm/companies', icon: Building2 },
  { id: 'nav-people', label: 'People', href: '/sabcrm/people', icon: Users },
  { id: 'nav-opportunities', label: 'Opportunities', href: '/sabcrm/opportunities', icon: Briefcase },
  { id: 'nav-notes', label: 'Notes', href: '/sabcrm/notes', icon: StickyNote },
  { id: 'nav-tasks', label: 'Tasks', href: '/sabcrm/tasks', icon: CheckCircle2 },
  { id: 'nav-settings', label: 'Settings', href: '/sabcrm/settings', icon: Settings },
] as const;

/* =========================================================================
   "Actions" commands

   Each action either navigates to a route (most), or runs an in-app handler
   (e.g. opening the shortcuts help overlay). Routes to object-index pages use
   `?new=1` to hint the index to surface its create flow; the index renders
   fine without it, so this degrades gracefully.
   ========================================================================= */
type ActionRun = (ctx: { navigate: (href: string) => void; openHelp: () => void }) => void;

interface ActionCommand {
  id: string;
  label: string;
  icon: LucideIcon;
  /** Keywords (beyond the label) the action matches against in search. */
  keywords?: string;
  run: ActionRun;
}

const ACTION_COMMANDS: readonly ActionCommand[] = [
  {
    id: 'act-create-company',
    label: 'Create Company',
    icon: Building2,
    keywords: 'new add company',
    run: ({ navigate }) => navigate('/sabcrm/companies?new=1'),
  },
  {
    id: 'act-create-person',
    label: 'Create Person',
    icon: Users,
    keywords: 'new add person contact',
    run: ({ navigate }) => navigate('/sabcrm/people?new=1'),
  },
  {
    id: 'act-create-opportunity',
    label: 'Create Opportunity',
    icon: Briefcase,
    keywords: 'new add opportunity deal',
    run: ({ navigate }) => navigate('/sabcrm/opportunities?new=1'),
  },
  {
    id: 'act-create-note',
    label: 'Create Note',
    icon: StickyNote,
    keywords: 'new add note',
    run: ({ navigate }) => navigate('/sabcrm/notes?new=1'),
  },
  {
    id: 'act-create-task',
    label: 'Create Task',
    icon: CheckCircle2,
    keywords: 'new add task todo',
    run: ({ navigate }) => navigate('/sabcrm/tasks?new=1'),
  },
  {
    id: 'act-open-dashboard',
    label: 'Open Dashboard',
    icon: LayoutDashboard,
    keywords: 'home dashboard overview',
    run: ({ navigate }) => navigate('/sabcrm/dashboard'),
  },
  {
    id: 'act-my-work',
    label: 'My Work',
    icon: ListTodo,
    keywords: 'my work assigned tasks mine',
    run: ({ navigate }) => navigate('/sabcrm/my-work'),
  },
  {
    id: 'act-open-settings',
    label: 'Open Settings',
    icon: Settings,
    keywords: 'settings preferences configuration',
    run: ({ navigate }) => navigate('/sabcrm/settings'),
  },
  {
    id: 'act-search',
    label: 'Search…',
    icon: Search,
    keywords: 'search find records',
    run: ({ navigate }) => navigate('/sabcrm/search'),
  },
  {
    id: 'act-shortcuts',
    label: 'Keyboard shortcuts',
    icon: Keyboard,
    keywords: 'keyboard shortcuts help keys hotkeys bindings',
    run: ({ openHelp }) => openHelp(),
  },
] as const;

/** Human-readable label for an object slug (used in record-row meta). */
const OBJECT_LABEL: Record<string, string> = {
  companies: 'Company',
  people: 'Person',
  opportunities: 'Opportunity',
  notes: 'Note',
  tasks: 'Task',
};

const OBJECT_ICON: Record<string, LucideIcon> = {
  companies: Building2,
  people: Users,
  opportunities: Briefcase,
  notes: StickyNote,
  tasks: CheckCircle2,
};

/**
 * Best-effort label for a favorite, which carries only `{ object, recordId }`
 * (no record name). Mirrors the sidebar's favorite labelling.
 */
function favoriteLabel(object: string, recordId: string): string {
  const objLabel = OBJECT_LABEL[object] ?? object;
  return `${objLabel} · ${recordId.slice(-6)}`;
}

/* =========================================================================
   Keyboard-shortcuts help reference
   ========================================================================= */
interface ShortcutEntry {
  keys: readonly string[];
  label: string;
}

const SHORTCUTS: readonly ShortcutEntry[] = [
  { keys: ['⌘', 'K'], label: 'Open command menu' },
  { keys: ['/'], label: 'Open & search' },
  { keys: ['↑', '↓'], label: 'Navigate items' },
  { keys: ['↵'], label: 'Select item' },
  { keys: ['Esc'], label: 'Close' },
  { keys: ['?'], label: 'Toggle this help' },
] as const;

/* =========================================================================
   Flattened item model (for keyboard navigation)
   ========================================================================= */
interface CmdItem {
  /** Unique key across the whole menu. */
  key: string;
  label: string;
  meta?: string;
  icon: LucideIcon;
  /** Invoked on Enter / click. */
  onSelect: () => void;
}

interface RecordResult extends SabcrmPickerOption {
  slug: string;
}

/** A favorite as surfaced in the menu (object slug + record id). */
interface FavoriteEntry {
  object: string;
  recordId: string;
}

const SEARCH_DEBOUNCE_MS = 200;
const PER_OBJECT_LIMIT = 5;

export interface TwentyCommandMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Active SabCRM project id, forwarded to the record-search action. */
  projectId?: string;
  /**
   * Whether the keyboard-shortcuts help overlay is visible. Optional: when the
   * host does not control it, the component self-manages help state and listens
   * for the `?` shortcut itself.
   */
  helpOpen?: boolean;
  /** Toggle the keyboard-shortcuts help overlay. */
  onHelpOpenChange?: (open: boolean) => void;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  return target.isContentEditable;
}

export function TwentyCommandMenu({
  open,
  onOpenChange,
  projectId,
  helpOpen: helpOpenProp,
  onHelpOpenChange,
}: TwentyCommandMenuProps): React.JSX.Element | null {
  const router = useRouter();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);

  // Uncontrolled fallback for the help overlay when the host doesn't drive it.
  const isHelpControlled = helpOpenProp !== undefined;
  const [helpOpenLocal, setHelpOpenLocal] = React.useState(false);
  const helpOpen = isHelpControlled ? helpOpenProp : helpOpenLocal;
  const setHelpOpen = React.useCallback(
    (next: boolean) => {
      if (isHelpControlled) onHelpOpenChange?.(next);
      else setHelpOpenLocal(next);
    },
    [isHelpControlled, onHelpOpenChange],
  );

  const [query, setQuery] = React.useState('');
  const [records, setRecords] = React.useState<RecordResult[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [activeIndex, setActiveIndex] = React.useState(0);

  // Empty-query sections.
  const [recents, setRecents] = React.useState<RecordRecent[]>([]);
  const [favorites, setFavorites] = React.useState<FavoriteEntry[]>([]);

  // Reset transient state every time the menu opens; refresh recents/favorites.
  React.useEffect(() => {
    if (open) {
      setQuery('');
      setRecords([]);
      setError(null);
      setLoading(false);
      setActiveIndex(0);
      setRecents(readRecents());
      // Autofocus once the panel has mounted.
      const id = window.setTimeout(() => inputRef.current?.focus(), 0);
      return () => window.clearTimeout(id);
    }
    return undefined;
  }, [open]);

  // Load favorites whenever the menu opens (non-blocking, graceful on failure).
  React.useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    void (async () => {
      const res = await listSabcrmFavoritesTw(projectId);
      if (cancelled) return;
      setFavorites(
        res.ok
          ? res.data.map((f) => ({ object: f.object, recordId: f.recordId }))
          : [],
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [open, projectId]);

  // Debounced record search, fanned out across the known object slugs.
  React.useEffect(() => {
    if (!open) return undefined;

    const term = query.trim();
    if (term.length === 0) {
      setRecords([]);
      setLoading(false);
      setError(null);
      return undefined;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    const handle = window.setTimeout(() => {
      void (async () => {
        try {
          const settled = await Promise.all(
            SEARCH_OBJECT_SLUGS.map(async (slug) => {
              const res = await searchRecordsForPickerAction(
                slug,
                term,
                PER_OBJECT_LIMIT,
                projectId,
              );
              if (!res.ok) return { slug, options: [] as SabcrmPickerOption[] };
              return { slug, options: res.data };
            }),
          );
          if (cancelled) return;

          const flat: RecordResult[] = settled.flatMap(({ slug, options }) =>
            options.map((opt) => ({ ...opt, slug })),
          );
          setRecords(flat);
          setActiveIndex(0);
        } catch {
          if (!cancelled) {
            setError('Search is unavailable right now.');
            setRecords([]);
          }
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [open, query, projectId]);

  const navigate = React.useCallback(
    (href: string) => {
      onOpenChange(false);
      router.push(href);
    },
    [onOpenChange, router],
  );

  /**
   * Open a record: record it in the recents list (capped + deduped), then
   * navigate. Used by record search results, recents, and favorites alike.
   */
  const openRecord = React.useCallback(
    (slug: string, id: string, label: string) => {
      pushRecent({ slug, id, label });
      setRecents(readRecents());
      navigate(`/sabcrm/${slug}/${id}`);
    },
    [navigate],
  );

  const openHelp = React.useCallback(() => {
    onOpenChange(false);
    setHelpOpen(true);
  }, [onOpenChange, setHelpOpen]);

  // When the help overlay is uncontrolled, listen for the `?` shortcut here so
  // it works even if the host never wires `helpOpen`/`onHelpOpenChange`.
  React.useEffect(() => {
    if (isHelpControlled) return undefined;
    function onDocKeyDown(event: KeyboardEvent): void {
      if (
        event.key === '?' &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        !isEditableTarget(event.target)
      ) {
        event.preventDefault();
        onOpenChange(false);
        setHelpOpenLocal((prev) => !prev);
      }
    }
    document.addEventListener('keydown', onDocKeyDown);
    return () => document.removeEventListener('keydown', onDocKeyDown);
  }, [isHelpControlled, onOpenChange]);

  // Filtered "Navigate" commands.
  const navItems = React.useMemo<CmdItem[]>(() => {
    const term = query.trim().toLowerCase();
    const matches = term
      ? NAV_COMMANDS.filter((c) => c.label.toLowerCase().includes(term))
      : NAV_COMMANDS;
    return matches.map((c) => ({
      key: c.id,
      label: c.label,
      meta: 'Navigate',
      icon: c.icon,
      onSelect: () => navigate(c.href),
    }));
  }, [query, navigate]);

  // Filtered "Actions" commands.
  const actionItems = React.useMemo<CmdItem[]>(() => {
    const term = query.trim().toLowerCase();
    const matches = term
      ? ACTION_COMMANDS.filter(
          (c) =>
            c.label.toLowerCase().includes(term) ||
            (c.keywords?.toLowerCase().includes(term) ?? false),
        )
      : ACTION_COMMANDS;
    return matches.map((c) => ({
      key: c.id,
      label: c.label,
      meta: 'Action',
      icon: c.icon,
      onSelect: () => c.run({ navigate, openHelp }),
    }));
  }, [query, navigate, openHelp]);

  const recordItems = React.useMemo<CmdItem[]>(
    () =>
      records.map((r) => ({
        key: `rec-${r.slug}-${r.id}`,
        label: r.label || 'Untitled',
        meta: OBJECT_LABEL[r.slug] ?? r.object,
        icon: OBJECT_ICON[r.slug] ?? Search,
        onSelect: () => openRecord(r.slug, r.id, r.label || 'Untitled'),
      })),
    [records, openRecord],
  );

  // Empty-query "Recent" group (from localStorage).
  const recentItems = React.useMemo<CmdItem[]>(
    () =>
      recents.map((r) => ({
        key: `recent-${r.slug}-${r.id}`,
        label: r.label || 'Untitled',
        meta: OBJECT_LABEL[r.slug] ?? r.slug,
        icon: OBJECT_ICON[r.slug] ?? Clock,
        onSelect: () => openRecord(r.slug, r.id, r.label || 'Untitled'),
      })),
    [recents, openRecord],
  );

  // Empty-query "Favorites" group (from the Rust engine).
  const favoriteItems = React.useMemo<CmdItem[]>(
    () =>
      favorites.map((f) => {
        const label = favoriteLabel(f.object, f.recordId);
        return {
          key: `fav-${f.object}-${f.recordId}`,
          label,
          meta: OBJECT_LABEL[f.object] ?? f.object,
          icon: OBJECT_ICON[f.object] ?? Star,
          onSelect: () => openRecord(f.object, f.recordId, label),
        };
      }),
    [favorites, openRecord],
  );

  // Recent/Favorites only show when the query is empty.
  const showSuggestions = query.trim().length === 0;
  const visibleRecentItems = showSuggestions ? recentItems : [];
  const visibleFavoriteItems = showSuggestions ? favoriteItems : [];

  // Flattened, ordered list used for keyboard navigation. Recents + favorites
  // sit above the static Navigate/Actions groups when the query is empty.
  const flatItems = React.useMemo<CmdItem[]>(
    () => [
      ...visibleRecentItems,
      ...visibleFavoriteItems,
      ...navItems,
      ...actionItems,
      ...recordItems,
    ],
    [
      visibleRecentItems,
      visibleFavoriteItems,
      navItems,
      actionItems,
      recordItems,
    ],
  );

  // Keep the active index within bounds when the result set changes.
  React.useEffect(() => {
    setActiveIndex((prev) => {
      if (flatItems.length === 0) return 0;
      return Math.min(prev, flatItems.length - 1);
    });
  }, [flatItems.length]);

  const onKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      switch (event.key) {
        case 'Escape':
          event.preventDefault();
          onOpenChange(false);
          break;
        case 'ArrowDown':
          event.preventDefault();
          setActiveIndex((prev) =>
            flatItems.length === 0 ? 0 : (prev + 1) % flatItems.length,
          );
          break;
        case 'ArrowUp':
          event.preventDefault();
          setActiveIndex((prev) =>
            flatItems.length === 0
              ? 0
              : (prev - 1 + flatItems.length) % flatItems.length,
          );
          break;
        case 'Enter': {
          event.preventDefault();
          const item = flatItems[activeIndex];
          if (item) item.onSelect();
          break;
        }
        case 'Tab': {
          // Focus trap: keep Tab/Shift+Tab inside the dialog.
          const panel = panelRef.current;
          if (!panel) break;
          const focusables = panel.querySelectorAll<HTMLElement>(
            'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
          );
          if (focusables.length === 0) {
            event.preventDefault();
            break;
          }
          const first = focusables[0]!;
          const last = focusables[focusables.length - 1]!;
          const activeEl = document.activeElement;
          if (event.shiftKey && activeEl === first) {
            event.preventDefault();
            last.focus();
          } else if (!event.shiftKey && activeEl === last) {
            event.preventDefault();
            first.focus();
          }
          break;
        }
        default:
          break;
      }
    },
    [flatItems, activeIndex, onOpenChange],
  );

  // ----- Keyboard-shortcuts help overlay (standalone, can show on its own) ---
  const helpOverlay = helpOpen ? (
    <div
      className="st-cmdk-overlay"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) setHelpOpen(false);
      }}
    >
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
      <div
        className="st-cmdk-panel st-cmdk-panel--help"
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard shortcuts"
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            setHelpOpen(false);
          }
        }}
        tabIndex={-1}
        ref={(node) => {
          // Focus the panel so Escape works without an input inside.
          if (node) node.focus();
        }}
      >
        <div className="st-cmdk-help__header">
          <Keyboard size={18} aria-hidden="true" />
          <span className="st-cmdk-help__title">Keyboard shortcuts</span>
          <kbd className="st-cmdk-search__esc">Esc</kbd>
        </div>
        <div className="st-cmdk-help__list">
          {SHORTCUTS.map((s) => (
            <div className="st-cmdk-help__row" key={s.label}>
              <span className="st-cmdk-help__label">{s.label}</span>
              <span className="st-cmdk-help__keys">
                {s.keys.map((k, i) => (
                  <kbd className="st-cmdk-kbd" key={`${s.label}-${i}`}>
                    {k}
                  </kbd>
                ))}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  ) : null;

  if (!open) return helpOverlay;

  const showEmpty =
    query.trim().length > 0 && !loading && !error && flatItems.length === 0;

  let flatCursor = 0;
  const renderRow = (item: CmdItem): React.JSX.Element => {
    const index = flatCursor;
    flatCursor += 1;
    const Icon = item.icon;
    const isActive = index === activeIndex;
    return (
      <button
        key={item.key}
        id={`st-cmdk-opt-${index}`}
        type="button"
        role="option"
        aria-selected={isActive}
        className={`st-cmdk-row${isActive ? ' is-active' : ''}`}
        onMouseMove={() => setActiveIndex(index)}
        onClick={() => item.onSelect()}
      >
        <span className="st-cmdk-row__icon">
          <Icon size={16} aria-hidden="true" />
        </span>
        <span className="st-cmdk-row__label">{item.label}</span>
        {item.meta ? <span className="st-cmdk-row__meta">{item.meta}</span> : null}
      </button>
    );
  };

  return (
    <>
      <div
        className="st-cmdk-overlay"
        role="presentation"
        onMouseDown={(e) => {
          // Backdrop click (not a click that bubbled from the panel) closes.
          if (e.target === e.currentTarget) onOpenChange(false);
        }}
      >
        {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
        <div
          ref={panelRef}
          className="st-cmdk-panel"
          role="dialog"
          aria-modal="true"
          aria-label="Command menu"
          onKeyDown={onKeyDown}
        >
          <div className="st-cmdk-search">
            <Search className="st-cmdk-search__icon" size={18} aria-hidden="true" />
            <input
              ref={inputRef}
              type="text"
              className="st-cmdk-search__input"
              placeholder="Search commands and records…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              spellCheck={false}
              autoComplete="off"
              role="combobox"
              aria-expanded
              aria-controls="st-cmdk-listbox"
              aria-activedescendant={
                flatItems.length > 0 ? `st-cmdk-opt-${activeIndex}` : undefined
              }
              aria-label="Search commands and records"
            />
            <kbd className="st-cmdk-search__esc">Esc</kbd>
          </div>

          <div className="st-cmdk-body" id="st-cmdk-listbox" role="listbox" aria-label="Results">
            {visibleRecentItems.length > 0 ? (
              <div className="st-cmdk-group st-cmdk-group--recent">
                <div className="st-cmdk-group__title">Recent</div>
                {visibleRecentItems.map(renderRow)}
              </div>
            ) : null}

            {visibleFavoriteItems.length > 0 ? (
              <div className="st-cmdk-group st-cmdk-group--favorites">
                <div className="st-cmdk-group__title">Favorites</div>
                {visibleFavoriteItems.map(renderRow)}
              </div>
            ) : null}

            {navItems.length > 0 ? (
              <div className="st-cmdk-group">
                <div className="st-cmdk-group__title">Navigate</div>
                {navItems.map(renderRow)}
              </div>
            ) : null}

            {actionItems.length > 0 ? (
              <div className="st-cmdk-group">
                <div className="st-cmdk-group__title">Actions</div>
                {actionItems.map(renderRow)}
              </div>
            ) : null}

            {recordItems.length > 0 ? (
              <div className="st-cmdk-group">
                <div className="st-cmdk-group__title">Records</div>
                {recordItems.map(renderRow)}
              </div>
            ) : null}

            {loading ? (
              <div className="st-cmdk-status" role="status">
                Searching…
              </div>
            ) : null}

            {error ? (
              <div className="st-cmdk-status st-cmdk-status--error" role="status">
                {error}
              </div>
            ) : null}

            {showEmpty ? (
              <div className="st-cmdk-status" role="status">
                No results for “{query.trim()}”.
              </div>
            ) : null}
          </div>

          <div className="st-cmdk-footer">
            <span className="st-cmdk-footer__hint">
              <kbd className="st-cmdk-kbd">↑</kbd>
              <kbd className="st-cmdk-kbd">↓</kbd>
              <span>navigate</span>
            </span>
            <span className="st-cmdk-footer__hint">
              <kbd className="st-cmdk-kbd">↵</kbd>
              <span>select</span>
            </span>
            <button
              type="button"
              className="st-cmdk-footer__help"
              onClick={openHelp}
            >
              <kbd className="st-cmdk-kbd">?</kbd>
              <span>shortcuts</span>
            </button>
          </div>
        </div>
      </div>
      {helpOverlay}
    </>
  );
}

export default TwentyCommandMenu;
