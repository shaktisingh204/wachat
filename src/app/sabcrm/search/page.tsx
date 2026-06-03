'use client';

export const dynamic = 'force-dynamic';

/**
 * SabCRM — global record search (`/sabcrm/search`), Twenty look.
 *
 * Twenty's "command menu / search" parity as an always-visible page: one search
 * box that fans out across the five standard objects in the active project and
 * merges the hits into per-object groups, each row linking to the record's
 * detail page (`/sabcrm/<object>/<id>`).
 *
 * Data model
 * ----------
 * `searchRecordsForPickerAction(targetObject, search, limit?, projectId?)` is a
 * *per-object* label search returning `SabcrmPickerOption[]` (`{ id, label,
 * object }`). To search "everything" we fan the query out across the five
 * standard slugs (companies / people / opportunities / notes / tasks) and group
 * the results by object. A monotonic request id guards against out-of-order
 * async responses.
 *
 * Client Component. The surrounding `src/app/sabcrm/layout.tsx` enforces auth /
 * onboarding / `RBACGuard`, mounts the project provider, and renders this inside
 * `TwentyAppFrame` (the `.sabcrm-twenty` scope). Every action below
 * independently re-runs the full session → project → RBAC (`sabcrm:view`) →
 * plan gate, so the page fails closed (calm empty / error states) for anyone who
 * slips past the layout guard.
 *
 * Twenty look only (`.st-*` + `../my-work/my-work.css`). NO ZoruUI / Tailwind /
 * clay.
 */

import * as React from 'react';
import Link from 'next/link';
import {
  Search,
  Database,
  Loader2,
  AlertTriangle,
  Building2,
  Users,
  Briefcase,
  StickyNote,
  CheckCircle2,
  type LucideIcon,
} from 'lucide-react';

import { searchRecordsForPickerAction } from '@/app/actions/sabcrm.actions';
import type { SabcrmPickerOption } from '@/app/actions/sabcrm.actions.types';
import { TwentyPageHeader } from '@/components/sabcrm/twenty';
import { useProject } from '@/context/project-context';

import '../my-work/my-work.css';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Base route every SabCRM page lives under (matches the live page links). */
const CRM_BASE_PATH = '/sabcrm';
/** Debounce window before a query is committed to the network. */
const SEARCH_DEBOUNCE_MS = 250;
/** Minimum query length before we search (the action matches a label substring). */
const MIN_QUERY_LEN = 2;
/** Per-object cap for hits. */
const SEARCH_PER_OBJECT = 6;

/** The five standard objects search fans out across. */
interface SearchTarget {
  slug: string;
  /** Plural header label, e.g. "Companies". */
  labelPlural: string;
  /** Singular per-hit "kind" hint, e.g. "Company". */
  labelSingular: string;
  icon: LucideIcon;
}

const SEARCH_TARGETS: readonly SearchTarget[] = [
  { slug: 'companies', labelPlural: 'Companies', labelSingular: 'Company', icon: Building2 },
  { slug: 'people', labelPlural: 'People', labelSingular: 'Person', icon: Users },
  { slug: 'opportunities', labelPlural: 'Opportunities', labelSingular: 'Opportunity', icon: Briefcase },
  { slug: 'notes', labelPlural: 'Notes', labelSingular: 'Note', icon: StickyNote },
  { slug: 'tasks', labelPlural: 'Tasks', labelSingular: 'Task', icon: CheckCircle2 },
] as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** One object's slice of the merged results. */
interface ResultGroup {
  target: SearchTarget;
  options: SabcrmPickerOption[];
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SabcrmSearchPage(): React.JSX.Element {
  const { activeProjectId } = useProject();

  // Search box (raw) → committed (debounced) query.
  const [input, setInput] = React.useState('');
  const [query, setQuery] = React.useState('');

  // Results.
  const [groups, setGroups] = React.useState<ResultGroup[]>([]);
  const [searching, setSearching] = React.useState(false);
  const [searchError, setSearchError] = React.useState<string | null>(null);

  // Monotonic request id so out-of-order async responses are ignored.
  const reqIdRef = React.useRef(0);

  // Debounce the search box → committed `query`.
  React.useEffect(() => {
    const t = setTimeout(() => setQuery(input.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [input]);

  // Fan the committed query out across the standard objects.
  React.useEffect(() => {
    const q = query;
    if (q.length < MIN_QUERY_LEN) {
      setGroups([]);
      setSearching(false);
      setSearchError(null);
      return;
    }

    let cancelled = false;
    const myReq = ++reqIdRef.current;
    setSearching(true);
    setSearchError(null);

    void Promise.all(
      SEARCH_TARGETS.map((target) =>
        searchRecordsForPickerAction(
          target.slug,
          q,
          SEARCH_PER_OBJECT,
          activeProjectId ?? undefined,
        ),
      ),
    ).then((results) => {
      if (cancelled || myReq !== reqIdRef.current) return; // superseded

      const merged: ResultGroup[] = [];
      let firstError: string | null = null;
      results.forEach((res, i) => {
        if (!res.ok) {
          if (!firstError) firstError = res.error;
          return;
        }
        if (res.data.length > 0) {
          merged.push({ target: SEARCH_TARGETS[i]!, options: res.data });
        }
      });

      setGroups(merged);
      // Only surface an error when *every* object failed (gate denial) and
      // nothing came back — partial failures degrade silently.
      setSearchError(merged.length === 0 ? firstError : null);
      setSearching(false);
    });

    return () => {
      cancelled = true;
    };
  }, [query, activeProjectId]);

  const hasQuery = query.length >= MIN_QUERY_LEN;
  const totalHits = groups.reduce((n, g) => n + g.options.length, 0);

  // ---- Render --------------------------------------------------------------

  return (
    <div className="stw-page">
      <TwentyPageHeader title="Search" icon={Search} />

      <div className="stw-searchbox">
        <span className="stw-searchbox__icon" aria-hidden="true">
          <Search size={18} />
        </span>
        <input
          className="stw-searchbox__input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Search records across every object…"
          autoFocus
          aria-label="Search records"
        />
        {searching ? (
          <span className="stw-searchbox__spin" aria-hidden="true">
            <Loader2 size={16} className="st-spin" />
          </span>
        ) : null}
      </div>

      {searchError ? (
        <div className="st-banner" role="alert">
          <AlertTriangle size={16} className="st-banner__icon" aria-hidden="true" />
          <span>{searchError}</span>
        </div>
      ) : !hasQuery ? (
        <div className="st-empty">
          <span className="st-empty__icon" aria-hidden="true">
            <Search size={20} />
          </span>
          <p className="st-empty__title">Start typing to search</p>
          <p className="st-empty__desc">
            Search by name across companies, people, opportunities, notes and
            tasks in this workspace.
          </p>
        </div>
      ) : searching && totalHits === 0 ? (
        <ResultsSkeleton />
      ) : totalHits === 0 ? (
        <div className="st-empty">
          <span className="st-empty__icon" aria-hidden="true">
            <Database size={20} />
          </span>
          <p className="st-empty__title">No matching records</p>
          <p className="st-empty__desc">
            Nothing matches &ldquo;{query}&rdquo;. Try a different term or check
            another object.
          </p>
        </div>
      ) : (
        <div className="stw-groups">
          {groups.map((group) => {
            const Icon = group.target.icon;
            return (
              <section key={group.target.slug} className="stw-group">
                <header className="stw-group__head">
                  <Icon size={15} aria-hidden="true" />
                  {group.target.labelPlural}
                  <span className="stw-group__count">{group.options.length}</span>
                </header>
                <ul className="stw-hits">
                  {group.options.map((option) => (
                    <li key={`${option.object}:${option.id}`}>
                      <Link
                        href={`${CRM_BASE_PATH}/${option.object}/${option.id}`}
                        className="stw-hit"
                      >
                        <span className="stw-hit__label">
                          {option.label || 'Untitled'}
                        </span>
                        <span className="stw-hit__kind">
                          {group.target.labelSingular}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading state
// ---------------------------------------------------------------------------

function ResultsSkeleton(): React.JSX.Element {
  return (
    <div className="stw-groups" aria-hidden="true">
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="stw-group" style={{ padding: 'var(--st-space-3)' }}>
          <div
            className="st-skeleton"
            style={{ height: 16, width: 120, marginBottom: 'var(--st-space-3)' }}
          />
          <div className="st-skeleton st-skeleton-row" style={{ height: 28 }} />
          <div className="st-skeleton st-skeleton-row" style={{ height: 28 }} />
          <div
            className="st-skeleton st-skeleton-row"
            style={{ height: 28, width: '75%' }}
          />
        </div>
      ))}
    </div>
  );
}
