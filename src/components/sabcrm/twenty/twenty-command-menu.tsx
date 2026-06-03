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
  type LucideIcon,
} from 'lucide-react';

import { searchRecordsForPickerAction } from '@/app/actions/sabcrm.actions';
import type { SabcrmPickerOption } from '@/app/actions/sabcrm.actions.types';

import './twenty-command-menu.css';

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

/* =========================================================================
   Flattened item model (for keyboard navigation)
   ========================================================================= */
interface CmdItem {
  /** Unique key across the whole menu. */
  key: string;
  /** Destination route — pushed on Enter / click. */
  href: string;
  label: string;
  meta?: string;
  icon: LucideIcon;
}

interface RecordResult extends SabcrmPickerOption {
  slug: string;
}

const SEARCH_DEBOUNCE_MS = 200;
const PER_OBJECT_LIMIT = 5;

export interface TwentyCommandMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Active SabCRM project id, forwarded to the record-search action. */
  projectId?: string;
}

export function TwentyCommandMenu({
  open,
  onOpenChange,
  projectId,
}: TwentyCommandMenuProps): React.JSX.Element | null {
  const router = useRouter();
  const inputRef = React.useRef<HTMLInputElement>(null);

  const [query, setQuery] = React.useState('');
  const [records, setRecords] = React.useState<RecordResult[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [activeIndex, setActiveIndex] = React.useState(0);

  // Reset transient state every time the menu opens.
  React.useEffect(() => {
    if (open) {
      setQuery('');
      setRecords([]);
      setError(null);
      setLoading(false);
      setActiveIndex(0);
      // Autofocus once the panel has mounted.
      const id = window.setTimeout(() => inputRef.current?.focus(), 0);
      return () => window.clearTimeout(id);
    }
    return undefined;
  }, [open]);

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

  // Filtered static commands.
  const navItems = React.useMemo<CmdItem[]>(() => {
    const term = query.trim().toLowerCase();
    const matches = term
      ? NAV_COMMANDS.filter((c) => c.label.toLowerCase().includes(term))
      : NAV_COMMANDS;
    return matches.map((c) => ({
      key: c.id,
      href: c.href,
      label: c.label,
      meta: 'Navigate',
      icon: c.icon,
    }));
  }, [query]);

  const recordItems = React.useMemo<CmdItem[]>(
    () =>
      records.map((r) => ({
        key: `rec-${r.slug}-${r.id}`,
        href: `/sabcrm/${r.slug}/${r.id}`,
        label: r.label || 'Untitled',
        meta: OBJECT_LABEL[r.slug] ?? r.object,
        icon: OBJECT_ICON[r.slug] ?? Search,
      })),
    [records],
  );

  // Flattened, ordered list used for keyboard navigation.
  const flatItems = React.useMemo<CmdItem[]>(
    () => [...navItems, ...recordItems],
    [navItems, recordItems],
  );

  // Keep the active index within bounds when the result set changes.
  React.useEffect(() => {
    setActiveIndex((prev) => {
      if (flatItems.length === 0) return 0;
      return Math.min(prev, flatItems.length - 1);
    });
  }, [flatItems.length]);

  const navigate = React.useCallback(
    (href: string) => {
      onOpenChange(false);
      router.push(href);
    },
    [onOpenChange, router],
  );

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
          if (item) navigate(item.href);
          break;
        }
        default:
          break;
      }
    },
    [flatItems, activeIndex, navigate, onOpenChange],
  );

  if (!open) return null;

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
        type="button"
        className={`st-cmdk-row${isActive ? ' is-active' : ''}`}
        onMouseMove={() => setActiveIndex(index)}
        onClick={() => navigate(item.href)}
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
            aria-label="Search commands and records"
          />
          <kbd className="st-cmdk-search__esc">Esc</kbd>
        </div>

        <div className="st-cmdk-body">
          {navItems.length > 0 ? (
            <div className="st-cmdk-group">
              <div className="st-cmdk-group__title">Navigate</div>
              {navItems.map(renderRow)}
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
      </div>
    </div>
  );
}

export default TwentyCommandMenu;
