'use client';

export const dynamic = 'force-dynamic';

/**
 * SabCRM — global record search (`/sabcrm/search`), Twenty look.
 *
 * Twenty's "command menu / records search" parity as an always-visible page:
 * one search box that runs a single **cross-object** query through the records
 * engine and merges the hits into per-object groups, each row linking to the
 * record's detail page (`/sabcrm/<object>/<id>`).
 *
 * Data model
 * ----------
 * `globalSearchTw(q, projectId?)` is the engine's true global-search endpoint:
 * one round-trip returns a flat, ranked list of hits across EVERY object the
 * caller can read —
 *
 *     ActionResult<{ object: string; id: string; label: string; snippet?: string }[]>
 *
 * We group that flat list by `object` (preserving the engine's rank order) and
 * decorate each group with its plural label + icon from `listSabcrmObjectsTw`
 * (the shared object catalogue), so custom objects render correctly too. A
 * monotonic request id guards against out-of-order async responses.
 *
 * Client Component. The surrounding `src/app/sabcrm/layout.tsx` enforces auth /
 * onboarding / `RBACGuard`, mounts the project provider, and renders this inside
 * `TwentyAppFrame` (the `.sabcrm-twenty` scope). Both actions independently
 * re-run the full session → project → RBAC (`sabcrm:view`) → plan gate, so the
 * page fails closed (calm empty / error states) for anyone who slips past the
 * layout guard, and degrades quietly if the engine is down.
 *
 * Twenty look only (`.st-*` + `../my-work/my-work.css` base classes + this
 * page's `./search-global.css`). NO ZoruUI / Tailwind / clay.
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
  CircleDot,
  ArrowRight,
  type LucideIcon,
} from 'lucide-react';

import { globalSearchTw } from '@/app/actions/sabcrm-search.actions';
import type { GlobalSearchHit } from '@/app/actions/sabcrm-search.actions.types';
import { listSabcrmObjectsTw } from '@/app/actions/sabcrm-twenty.actions';
import { TwentyPageHeader } from '@/components/sabcrm/twenty';
import { useProject } from '@/context/project-context';

import '../my-work/my-work.css';
import './search-global.css';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Base route every SabCRM page lives under (matches the live page links). */
const CRM_BASE_PATH = '/sabcrm';
/** Debounce window before a query is committed to the network. */
const SEARCH_DEBOUNCE_MS = 250;
/** Minimum query length before we search (the engine matches a substring). */
const MIN_QUERY_LEN = 2;
/** Per-group preview cap — extra hits collapse behind a "view all" footer. */
const PREVIEW_PER_GROUP = 6;

/**
 * Lucide icons for the five standard object slugs (the vendored Twenty look
 * hardcodes these; `ObjectMetadata.icon` carries a ZORU/lucide name string that
 * we only consult to confirm the slug, never to load a ZoruUI component here).
 */
const OBJECT_ICON: Record<string, LucideIcon> = {
  companies: Building2,
  people: Users,
  opportunities: Briefcase,
  notes: StickyNote,
  tasks: CheckCircle2,
};

/** Fallback singular/plural labels when an object is missing from the catalogue. */
const FALLBACK_LABEL: Record<string, { singular: string; plural: string }> = {
  companies: { singular: 'Company', plural: 'Companies' },
  people: { singular: 'Person', plural: 'People' },
  opportunities: { singular: 'Opportunity', plural: 'Opportunities' },
  notes: { singular: 'Note', plural: 'Notes' },
  tasks: { singular: 'Task', plural: 'Tasks' },
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** One cross-object hit as returned by `globalSearchTw` (`{ object, id, label, snippet? }`). */
type GlobalHit = GlobalSearchHit;

/** Display descriptor for an object slug (icon + labels). */
interface ObjectDescriptor {
  slug: string;
  labelSingular: string;
  labelPlural: string;
  icon: LucideIcon;
}

/** One object's slice of the merged results, in engine rank order. */
interface ResultGroup {
  descriptor: ObjectDescriptor;
  hits: GlobalHit[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Title-cases a raw slug for an unknown/custom object fallback label. */
function humanizeSlug(slug: string): string {
  const words = slug.replace(/[-_]+/g, ' ').trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : slug;
}

/** Resolves a slug → display descriptor from the catalogue, with fallbacks. */
function descriptorFor(
  slug: string,
  catalogue: Map<string, { labelSingular: string; labelPlural: string }>,
): ObjectDescriptor {
  const meta = catalogue.get(slug);
  const fallback = FALLBACK_LABEL[slug];
  const human = humanizeSlug(slug);
  return {
    slug,
    labelSingular: meta?.labelSingular ?? fallback?.singular ?? human,
    labelPlural: meta?.labelPlural ?? fallback?.plural ?? human,
    icon: OBJECT_ICON[slug] ?? CircleDot,
  };
}

/**
 * Splits `text` around the first case-insensitive occurrence of `term` so the
 * match can be wrapped in a `<mark>`. Pure string work — no HTML injection.
 */
function highlight(text: string, term: string): React.ReactNode {
  if (!term) return text;
  const idx = text.toLowerCase().indexOf(term.toLowerCase());
  if (idx < 0) return text;
  const before = text.slice(0, idx);
  const match = text.slice(idx, idx + term.length);
  const after = text.slice(idx + term.length);
  return (
    <>
      {before}
      <mark className="stsg-mark">{match}</mark>
      {after}
    </>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SabcrmSearchPage(): React.JSX.Element {
  const { activeProjectId } = useProject();

  // Search box (raw) → committed (debounced) query.
  const [input, setInput] = React.useState('');
  const [query, setQuery] = React.useState('');

  // Object catalogue (slug → labels) for group headers; best-effort.
  // Mirrored into a ref so the (async, often-later) catalogue load can relabel
  // groups WITHOUT re-triggering the search effect's network call.
  const [catalogue, setCatalogue] = React.useState<
    Map<string, { labelSingular: string; labelPlural: string }>
  >(new Map());
  const catalogueRef = React.useRef(catalogue);
  catalogueRef.current = catalogue;

  // Results.
  const [groups, setGroups] = React.useState<ResultGroup[]>([]);
  const [total, setTotal] = React.useState(0);
  const [searching, setSearching] = React.useState(false);
  const [searchError, setSearchError] = React.useState<string | null>(null);

  // Monotonic request id so out-of-order async responses are ignored.
  const reqIdRef = React.useRef(0);

  // Load the object catalogue once per project (labels for group headers).
  React.useEffect(() => {
    let cancelled = false;
    void listSabcrmObjectsTw(activeProjectId ?? undefined).then((res) => {
      if (cancelled || !res.ok) return; // headers degrade to fallbacks
      const next = new Map<
        string,
        { labelSingular: string; labelPlural: string }
      >();
      for (const o of res.data) {
        next.set(o.slug, {
          labelSingular: o.labelSingular,
          labelPlural: o.labelPlural,
        });
      }
      setCatalogue(next);
    });
    return () => {
      cancelled = true;
    };
  }, [activeProjectId]);

  // Debounce the search box → committed `query`.
  React.useEffect(() => {
    const t = setTimeout(() => setQuery(input.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [input]);

  // Run the single cross-object global search for the committed query.
  React.useEffect(() => {
    const q = query;
    if (q.length < MIN_QUERY_LEN) {
      setGroups([]);
      setTotal(0);
      setSearching(false);
      setSearchError(null);
      return;
    }

    let cancelled = false;
    const myReq = ++reqIdRef.current;
    setSearching(true);
    setSearchError(null);

    void globalSearchTw(q, activeProjectId ?? undefined).then((res) => {
      if (cancelled || myReq !== reqIdRef.current) return; // superseded

      if (!res.ok) {
        // Engine down / gate denial: surface a calm banner, clear results.
        setGroups([]);
        setTotal(0);
        setSearchError(res.error);
        setSearching(false);
        return;
      }

      // Group the flat, ranked hit list by object — first-seen order wins so
      // the engine's cross-object ranking is preserved across the page.
      const order: string[] = [];
      const byObject = new Map<string, GlobalHit[]>();
      for (const hit of res.data) {
        let bucket = byObject.get(hit.object);
        if (!bucket) {
          bucket = [];
          byObject.set(hit.object, bucket);
          order.push(hit.object);
        }
        bucket.push(hit);
      }

      const merged: ResultGroup[] = order.map((slug) => ({
        descriptor: descriptorFor(slug, catalogueRef.current),
        hits: byObject.get(slug)!,
      }));

      setGroups(merged);
      setTotal(res.data.length);
      setSearchError(null);
      setSearching(false);
    });

    return () => {
      cancelled = true;
    };
  }, [query, activeProjectId]);

  // When the catalogue arrives after results are already shown, upgrade the
  // group headers from fallback labels to the real ones — no re-search.
  React.useEffect(() => {
    setGroups((prev) =>
      prev.length === 0
        ? prev
        : prev.map((g) => ({
            ...g,
            descriptor: descriptorFor(g.descriptor.slug, catalogue),
          })),
    );
  }, [catalogue]);

  const hasQuery = query.length >= MIN_QUERY_LEN;

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
          placeholder="Search everything — companies, people, opportunities…"
          autoFocus
          aria-label="Search all records"
        />
        {searching ? (
          <span className="stw-searchbox__spin" aria-hidden="true">
            <Loader2 size={16} className="st-spin" />
          </span>
        ) : null}
      </div>

      {/* Results summary line (only once we have hits). */}
      {hasQuery && !searchError && total > 0 ? (
        <p className="stsg-summary">
          <strong>{total}</strong>
          {total === 1 ? ' result' : ' results'} for{' '}
          <span className="stsg-summary__term">&ldquo;{query}&rdquo;</span>
          {groups.length > 1 ? ` across ${groups.length} objects` : null}
        </p>
      ) : null}

      {searchError ? (
        <div className="st-banner stsg-degraded" role="alert">
          <AlertTriangle
            size={16}
            className="st-banner__icon"
            aria-hidden="true"
          />
          <span>{searchError}</span>
        </div>
      ) : !hasQuery ? (
        <div className="st-empty">
          <span className="st-empty__icon" aria-hidden="true">
            <Search size={20} />
          </span>
          <p className="st-empty__title">Start typing to search</p>
          <p className="st-empty__desc">
            One search across every object in this workspace — companies,
            people, opportunities, notes, tasks and your custom records.
          </p>
        </div>
      ) : searching && groups.length === 0 ? (
        <ResultsSkeleton />
      ) : groups.length === 0 ? (
        <div className="st-empty">
          <span className="st-empty__icon" aria-hidden="true">
            <Database size={20} />
          </span>
          <p className="st-empty__title">No matching records</p>
          <p className="st-empty__desc">
            Nothing matches &ldquo;{query}&rdquo;. Try a different term.
          </p>
        </div>
      ) : (
        <div className="stw-groups">
          {groups.map((group) => {
            const { descriptor } = group;
            const Icon = descriptor.icon;
            const preview = group.hits.slice(0, PREVIEW_PER_GROUP);
            const overflow = group.hits.length - preview.length;
            return (
              <section key={descriptor.slug} className="stw-group">
                <header className="stw-group__head">
                  <Icon size={15} aria-hidden="true" />
                  {descriptor.labelPlural}
                  <span className="stw-group__count">{group.hits.length}</span>
                </header>
                <ul className="stw-hits">
                  {preview.map((hit) => (
                    <li key={`${hit.object}:${hit.id}`}>
                      <Link
                        href={`${CRM_BASE_PATH}/${hit.object}/${hit.id}`}
                        className="stw-hit stsg-hit"
                      >
                        <span className="stsg-hit__body">
                          <span className="stw-hit__label">
                            {hit.label
                              ? highlight(hit.label, query)
                              : 'Untitled'}
                          </span>
                          {hit.snippet ? (
                            <span className="stsg-hit__snippet">
                              {highlight(hit.snippet, query)}
                            </span>
                          ) : null}
                        </span>
                        <span className="stw-hit__kind">
                          {descriptor.labelSingular}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
                {overflow > 0 ? (
                  <Link
                    href={`${CRM_BASE_PATH}/${descriptor.slug}`}
                    className="stsg-group__more"
                  >
                    View all {group.hits.length} in {descriptor.labelPlural}
                    <ArrowRight size={13} aria-hidden="true" />
                  </Link>
                ) : null}
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
        <div
          key={i}
          className="stw-group"
          style={{ padding: 'var(--st-space-3)' }}
        >
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
