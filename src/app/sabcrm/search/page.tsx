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
 * Command-search parity
 * ---------------------
 *   - Each hit shows a `TwentyAvatar` (round for people-ish objects, the 4px
 *     rounded square logo shape otherwise) + label + match snippet + kind chip.
 *   - Keyboard navigation: ↑/↓ rove a single flat index ACROSS object-group
 *     boundaries (like Twenty's command menu), Enter opens the active (or first)
 *     hit, Escape clears the box. The roving cursor is exposed via ARIA
 *     combobox/listbox/option wiring + `aria-activedescendant`.
 *   - Recent searches persist to `localStorage` (best-effort, quota/SSR-safe)
 *     and surface as a quick-pick list when the box is empty.
 *
 * NB: We deliberately use the engine's single-round-trip `globalSearchTw`
 * (`sabcrmRecordsApi.searchAll`) rather than looping `listSabcrmRecordsTw` once
 * per object — same cross-object result, one network call instead of N, and it
 * is the existing gated action for this surface.
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
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Search,
  Database,
  Building2,
  Users,
  Briefcase,
  StickyNote,
  CheckCircle2,
  CircleDot,
  ArrowRight,
  Clock,
  CornerDownLeft,
  Plus,
  Settings,
  ChevronLeft,
  ChevronRight,
  Command,
  type LucideIcon,
} from 'lucide-react';

import { globalSearchTw } from '@/app/actions/sabcrm-search.actions';
import type { GlobalSearchHit } from '@/app/actions/sabcrm-search.actions.types';
import {
  listSabcrmObjectsTw,
  listSabcrmRecordsTw,
} from '@/app/actions/sabcrm-twenty.actions';
import type { ObjectMetadata } from '@/lib/sabcrm/types';
import { sabcrmRecordLabel } from '@/lib/sabcrm/record-label';
import type { SabcrmRustRecord } from '@/lib/rust-client/sabcrm-records';
import { TwentyPageHeader, TwentyAvatar } from '@/components/sabcrm/twenty';
import type { TwentyAvatarShape } from '@/components/sabcrm/twenty';
import {
  SearchInput,
  Button,
  IconButton,
  Alert,
  Spinner,
  Skeleton,
} from '@/components/sabcrm/20ui';
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
/** localStorage key for the recent-searches list (per browser, all projects). */
const RECENT_KEY = 'sabcrm.search.recent';
/** How many recent searches to keep / show. */
const RECENT_MAX = 6;
/** Page size for the expanded ("See all") full paginated result list. */
const EXPANDED_PAGE_SIZE = 25;
/** Max command-style verbs (Create … / Go to settings) shown above results. */
const MAX_VERBS = 6;

/**
 * Object slugs that render a CIRCULAR avatar (people / actors). Everything else
 * — companies, custom objects — uses Twenty's rounded-square logo shape.
 */
const ROUND_AVATAR_OBJECTS = new Set(['people', 'users', 'members']);

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

/**
 * A previewed hit decorated with its group descriptor + a global keyboard
 * index. Built once per render so arrow-key navigation can move across object
 * group boundaries as a single flat list (Twenty command-menu behaviour).
 */
interface FlatHit {
  hit: GlobalHit;
  descriptor: ObjectDescriptor;
  /** 0-based position in the flattened, keyboard-navigable list of preview hits. */
  index: number;
  /** Destination detail route (`/sabcrm/<object>/<id>`). */
  href: string;
}

/**
 * A command-style verb (Twenty command-menu "actions" section): a labelled,
 * keyboard-navigable row at the TOP of the results that NAVIGATES somewhere
 * rather than opening a record — "Create <Object>" (→ the object index) and a
 * static "Go to settings". Folded into the same roving keyboard index as the
 * hit rows so ↑/↓/Enter cross verbs and hits seamlessly.
 */
interface CommandVerb {
  /** Stable key for React + the keyboard cursor id. */
  key: string;
  icon: LucideIcon;
  /** Primary label, e.g. "Create Company". */
  label: string;
  /** Short kind chip on the right, e.g. "Create" / "Navigate". */
  kind: string;
  /** Destination route. */
  href: string;
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
 * Derives a record's display label from its `data` bag using the object's
 * metadata — preferring the explicit label field, then the first text/email
 * field, falling back to `<Singular> <last-6-of-id>`. Mirrors the list page's
 * `recordLabel` so the expanded full-result rows read identically.
 */
function recordLabel(object: ObjectMetadata | undefined, record: SabcrmRustRecord): string {
  // With metadata, the canonical helper handles people (full name) + isLabel.
  if (object) return sabcrmRecordLabel(object, record);
  // No metadata: best-effort scan of common title-ish keys.
  for (const key of ['name', 'title', 'label', 'subject', 'email']) {
    const raw = record.data[key];
    if (typeof raw === 'string' && raw.trim()) return raw;
  }
  return `Record ${record.id.slice(-6)}`;
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

/** Reads the recent-searches list from localStorage (SSR / quota-safe). */
function readRecent(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
      .slice(0, RECENT_MAX);
  } catch {
    return [];
  }
}

/** Persists the recent-searches list, swallowing quota / privacy errors. */
function writeRecent(list: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, RECENT_MAX)));
  } catch {
    /* private mode / quota — recent searches are best-effort only */
  }
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SabcrmSearchPage(): React.JSX.Element {
  const { activeProjectId } = useProject();
  const router = useRouter();

  // Search box (raw) → committed (debounced) query.
  const [input, setInput] = React.useState('');
  const [query, setQuery] = React.useState('');

  // Recent searches (localStorage). Hydrated on mount to stay SSR-safe.
  const [recent, setRecent] = React.useState<string[]>([]);
  React.useEffect(() => {
    setRecent(readRecent());
  }, []);

  // Keyboard "roving" index across the flattened preview hits (-1 = none).
  const [activeIndex, setActiveIndex] = React.useState(-1);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);

  // Object catalogue (slug → labels) for group headers; best-effort.
  // Mirrored into a ref so the (async, often-later) catalogue load can relabel
  // groups WITHOUT re-triggering the search effect's network call.
  const [catalogue, setCatalogue] = React.useState<
    Map<string, { labelSingular: string; labelPlural: string }>
  >(new Map());
  const catalogueRef = React.useRef(catalogue);
  catalogueRef.current = catalogue;

  // Full object metadata keyed by slug — powers the command verbs ("Create
  // <Object>") and the expanded full-result rows' label resolution. Loaded
  // alongside the label catalogue (same round-trip), best-effort.
  const [objectsBySlug, setObjectsBySlug] = React.useState<
    Map<string, ObjectMetadata>
  >(new Map());
  const objectsBySlugRef = React.useRef(objectsBySlug);
  objectsBySlugRef.current = objectsBySlug;

  // Results.
  const [groups, setGroups] = React.useState<ResultGroup[]>([]);
  const [total, setTotal] = React.useState(0);
  const [searching, setSearching] = React.useState(false);
  const [searchError, setSearchError] = React.useState<string | null>(null);

  // Monotonic request id so out-of-order async responses are ignored.
  const reqIdRef = React.useRef(0);

  // Expanded ("See all N") full paginated result list for ONE object slug.
  // `null` = the default grouped-preview mode; a slug = the full-list mode.
  const [expandedObject, setExpandedObject] = React.useState<string | null>(null);
  const [expandedPage, setExpandedPage] = React.useState(1);
  const [expandedRecords, setExpandedRecords] = React.useState<SabcrmRustRecord[]>([]);
  const [expandedTotal, setExpandedTotal] = React.useState(0);
  const [expandedLoading, setExpandedLoading] = React.useState(false);
  const [expandedError, setExpandedError] = React.useState<string | null>(null);
  const expandedReqRef = React.useRef(0);

  // Load the object catalogue once per project (labels for group headers).
  React.useEffect(() => {
    let cancelled = false;
    void listSabcrmObjectsTw(activeProjectId ?? undefined).then((res) => {
      if (cancelled || !res.ok) return; // headers degrade to fallbacks
      const next = new Map<
        string,
        { labelSingular: string; labelPlural: string }
      >();
      const full = new Map<string, ObjectMetadata>();
      for (const o of res.data) {
        next.set(o.slug, {
          labelSingular: o.labelSingular,
          labelPlural: o.labelPlural,
        });
        full.set(o.slug, o);
      }
      setCatalogue(next);
      setObjectsBySlug(full);
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

  // A new committed query collapses any expanded full-list back to the grouped
  // preview (the prior object may not even match the new term) and clears stale
  // expanded records.
  React.useEffect(() => {
    setExpandedObject(null);
    setExpandedPage(1);
    setExpandedRecords([]);
    setExpandedTotal(0);
    setExpandedError(null);
  }, [query]);

  // Load the full paginated record list for the expanded object via the records
  // engine. This is the "See all N" experience — real records, real pages, not
  // the capped preview the global-search endpoint returns. Degrades to a calm
  // error banner if the action is unavailable / the engine is down.
  React.useEffect(() => {
    if (!expandedObject || query.length < MIN_QUERY_LEN) return;

    let cancelled = false;
    const myReq = ++expandedReqRef.current;
    setExpandedLoading(true);
    setExpandedError(null);

    void listSabcrmRecordsTw(
      expandedObject,
      { q: query, page: expandedPage, limit: EXPANDED_PAGE_SIZE },
      activeProjectId ?? undefined,
    )
      .then((res) => {
        if (cancelled || myReq !== expandedReqRef.current) return;
        if (!res.ok) {
          setExpandedRecords([]);
          setExpandedTotal(0);
          setExpandedError(res.error);
          setExpandedLoading(false);
          return;
        }
        setExpandedRecords(res.data.records);
        setExpandedTotal(res.data.total);
        setExpandedError(null);
        setExpandedLoading(false);
      })
      .catch(() => {
        if (cancelled || myReq !== expandedReqRef.current) return;
        // The action may not exist in older builds — degrade gracefully.
        setExpandedRecords([]);
        setExpandedTotal(0);
        setExpandedError('Could not load the full result list.');
        setExpandedLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [expandedObject, expandedPage, query, activeProjectId]);

  // Open / close the expanded full-result list for a group.
  const openExpanded = React.useCallback((slug: string) => {
    setExpandedObject(slug);
    setExpandedPage(1);
  }, []);
  const closeExpanded = React.useCallback(() => {
    setExpandedObject(null);
    setExpandedPage(1);
  }, []);

  const hasQuery = query.length >= MIN_QUERY_LEN;

  // Flatten the previewed hits across all groups into a single keyboard-
  // navigable list (Twenty moves the selection across object boundaries).
  const flatHits = React.useMemo<FlatHit[]>(() => {
    const out: FlatHit[] = [];
    let i = 0;
    for (const group of groups) {
      for (const hit of group.hits.slice(0, PREVIEW_PER_GROUP)) {
        out.push({
          hit,
          descriptor: group.descriptor,
          index: i++,
          href: `${CRM_BASE_PATH}/${hit.object}/${hit.id}`,
        });
      }
    }
    return out;
  }, [groups]);

  // Command-style verbs (Twenty's command-menu "actions"): "Create <Object>"
  // for the objects whose label matches the query, plus a static "Go to
  // settings". They sit ABOVE the results and navigate (no record opened).
  const verbs = React.useMemo<CommandVerb[]>(() => {
    if (!hasQuery) return [];
    const q = query.toLowerCase();
    const out: CommandVerb[] = [];

    // Rank objects whose singular/plural label contains the query term; if
    // nothing matches (e.g. searching a person's name) still offer creates for
    // the objects that actually returned hits, so a "Create" is always handy.
    const objects = Array.from(objectsBySlug.values());
    const matching = objects.filter(
      (o) =>
        o.labelSingular.toLowerCase().includes(q) ||
        o.labelPlural.toLowerCase().includes(q) ||
        o.slug.toLowerCase().includes(q),
    );
    const source =
      matching.length > 0
        ? matching
        : groups
            .map((g) => objectsBySlug.get(g.descriptor.slug))
            .filter((o): o is ObjectMetadata => Boolean(o));

    for (const o of source) {
      if (out.length >= MAX_VERBS - 1) break;
      out.push({
        key: `create:${o.slug}`,
        icon: OBJECT_ICON[o.slug] ?? Plus,
        label: `Create ${o.labelSingular}`,
        kind: 'Create',
        // The object index page is where new records are authored (its create
        // drawer); navigating there is the gated, build-safe create entry.
        href: `${CRM_BASE_PATH}/${o.slug}`,
      });
    }

    // Always offer a jump to settings (Twenty's "Go to Settings" verb).
    out.push({
      key: 'goto:settings',
      icon: Settings,
      label: 'Go to settings',
      kind: 'Navigate',
      href: `${CRM_BASE_PATH}/settings`,
    });

    return out;
  }, [hasQuery, query, objectsBySlug, groups]);

  // Unified roving keyboard target list: verbs first, then preview hits. In the
  // expanded full-list mode we suppress this combined cursor (the page renders a
  // dedicated list with its own affordances).
  const navHrefs = React.useMemo<string[]>(() => {
    if (expandedObject) return [];
    return [...verbs.map((v) => v.href), ...flatHits.map((h) => h.href)];
  }, [verbs, flatHits, expandedObject]);

  /** Keyboard index → verb (0..verbs.length-1) or undefined when it's a hit. */
  const verbAtIndex = React.useCallback(
    (i: number): CommandVerb | undefined =>
      i >= 0 && i < verbs.length ? verbs[i] : undefined,
    [verbs],
  );

  // Reset the keyboard cursor whenever the navigable set changes.
  React.useEffect(() => {
    setActiveIndex(-1);
  }, [navHrefs]);

  // Scroll the active row into view as the cursor moves.
  React.useEffect(() => {
    if (activeIndex < 0 || !listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>(
      `[data-nav-index="${activeIndex}"]`,
    );
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  // Commit a query to the recent-searches list (dedupe, most-recent-first).
  const rememberSearch = React.useCallback((term: string) => {
    const t = term.trim();
    if (t.length < MIN_QUERY_LEN) return;
    setRecent((prev) => {
      const next = [t, ...prev.filter((r) => r.toLowerCase() !== t.toLowerCase())].slice(
        0,
        RECENT_MAX,
      );
      writeRecent(next);
      return next;
    });
  }, []);

  // Persist a committed query once it returns results worth remembering.
  React.useEffect(() => {
    if (hasQuery && !searchError && total > 0) rememberSearch(query);
  }, [hasQuery, searchError, total, query, rememberSearch]);

  const clearRecent = React.useCallback(() => {
    setRecent([]);
    writeRecent([]);
  }, []);

  // Keyboard navigation on the search box: ↑/↓ rove the unified verb+hit list,
  // Enter activates the cursor (or the first target), Escape clears the box or
  // backs out of the expanded full-list view.
  const onKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'ArrowDown') {
        if (navHrefs.length === 0) return;
        e.preventDefault();
        setActiveIndex((i) => (i + 1) % navHrefs.length);
      } else if (e.key === 'ArrowUp') {
        if (navHrefs.length === 0) return;
        e.preventDefault();
        setActiveIndex((i) => (i <= 0 ? navHrefs.length - 1 : i - 1));
      } else if (e.key === 'Enter') {
        const idx = activeIndex >= 0 ? activeIndex : navHrefs.length > 0 ? 0 : -1;
        const href = idx >= 0 ? navHrefs[idx] : undefined;
        if (href) {
          e.preventDefault();
          // Only commit a "search" to recents when opening a record hit, not a
          // verb (creating / navigating isn't a search worth remembering).
          if (!verbAtIndex(idx)) rememberSearch(query);
          router.push(href);
        }
      } else if (e.key === 'Escape') {
        if (expandedObject) {
          e.preventDefault();
          closeExpanded();
        } else if (input) {
          e.preventDefault();
          setInput('');
        }
      }
    },
    [
      navHrefs,
      activeIndex,
      verbAtIndex,
      query,
      input,
      expandedObject,
      closeExpanded,
      rememberSearch,
      router,
    ],
  );

  // ---- Render --------------------------------------------------------------

  return (
    <div className="stw-page">
      <TwentyPageHeader title="Search" icon={Search} />

      <div className="stw-searchbox">
        <SearchInput
          ref={inputRef}
          inputSize="lg"
          value={input}
          onValueChange={setInput}
          onKeyDown={onKeyDown}
          placeholder="Search everything: companies, people, opportunities"
          autoFocus
          autoComplete="off"
          spellCheck={false}
          role="combobox"
          aria-expanded={navHrefs.length > 0}
          aria-controls="stsg-results"
          aria-activedescendant={
            activeIndex >= 0 && !expandedObject
              ? `stsg-nav-${activeIndex}`
              : undefined
          }
          aria-label="Search all records"
        />
        {searching ? (
          <span
            className="stw-searchbox__spin"
            style={{ right: input ? 36 : 12 }}
          >
            <Spinner size="sm" label="Searching" />
          </span>
        ) : null}
      </div>

      {/* Results summary line (only once we have hits). */}
      {hasQuery && expandedObject ? (
        <p className="stsg-summary">
          <Button
            variant="ghost"
            size="sm"
            iconLeft={ChevronLeft}
            onClick={closeExpanded}
          >
            All results
          </Button>
          <span aria-hidden="true" className="stsg-summary__sep">
            /
          </span>
          <strong>{expandedTotal}</strong>
          {expandedTotal === 1 ? ' record' : ' records'} in{' '}
          <span className="stsg-summary__term">
            {descriptorFor(expandedObject, catalogue).labelPlural}
          </span>{' '}
          for{' '}
          <span className="stsg-summary__term">&ldquo;{query}&rdquo;</span>
        </p>
      ) : hasQuery && !searchError && total > 0 ? (
        <p className="stsg-summary">
          <strong>{total}</strong>
          {total === 1 ? ' result' : ' results'} for{' '}
          <span className="stsg-summary__term">&ldquo;{query}&rdquo;</span>
          {groups.length > 1 ? ` across ${groups.length} objects` : null}
        </p>
      ) : !hasQuery && recent.length > 0 ? (
        <p className="stsg-kbd-hint">
          <kbd className="stsg-kbd">↑</kbd>
          <kbd className="stsg-kbd">↓</kbd>
          to navigate
          <kbd className="stsg-kbd">
            <CornerDownLeft size={11} aria-hidden="true" />
          </kbd>
          to open
        </p>
      ) : null}

      {searchError ? (
        <Alert tone="danger" className="stsg-degraded">
          {searchError}
        </Alert>
      ) : !hasQuery ? (
        recent.length > 0 ? (
          <section className="stsg-recent" aria-label="Recent searches">
            <div className="stsg-recent__head">
              <span className="stsg-recent__title">
                <Clock size={13} aria-hidden="true" />
                Recent
              </span>
              <Button variant="ghost" size="sm" onClick={clearRecent}>
                Clear
              </Button>
            </div>
            <ul className="stsg-recent__list">
              {recent.map((term) => (
                <li key={term}>
                  <button
                    type="button"
                    className="stsg-recent__item"
                    onClick={() => {
                      setInput(term);
                      inputRef.current?.focus();
                    }}
                  >
                    <Search size={14} aria-hidden="true" />
                    <span className="stsg-recent__term">{term}</span>
                    <ArrowRight size={13} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : (
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
        )
      ) : expandedObject ? (
        <ExpandedResults
          slug={expandedObject}
          object={objectsBySlug.get(expandedObject)}
          descriptor={descriptorFor(expandedObject, catalogue)}
          records={expandedRecords}
          total={expandedTotal}
          page={expandedPage}
          loading={expandedLoading}
          error={expandedError}
          query={query}
          onPage={setExpandedPage}
          onBack={closeExpanded}
        />
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
        <div className="stw-groups" id="stsg-results" role="listbox" ref={listRef}>
          {/* Command-style verbs (Create … / Go to settings) above results. */}
          {verbs.length > 0 ? (
            <section className="stw-group stsg-verbs" aria-label="Actions">
              <header className="stw-group__head">
                <Command size={15} aria-hidden="true" />
                Actions
              </header>
              <ul className="stw-hits">
                {verbs.map((verb, i) => {
                  const VerbIcon = verb.icon;
                  const active = i === activeIndex;
                  return (
                    <li key={verb.key}>
                      <Link
                        id={`stsg-nav-${i}`}
                        data-nav-index={i}
                        data-active={active}
                        role="option"
                        aria-selected={active}
                        href={verb.href}
                        className="stw-hit stsg-hit stsg-verb"
                        onMouseEnter={() => setActiveIndex(i)}
                      >
                        <span className="stsg-verb__icon" aria-hidden="true">
                          <VerbIcon size={16} />
                        </span>
                        <span className="stsg-hit__body">
                          <span className="stw-hit__label">{verb.label}</span>
                        </span>
                        <span className="stw-hit__kind">{verb.kind}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}
          {groups.map((group) => {
            const { descriptor } = group;
            const Icon = descriptor.icon;
            const preview = group.hits.slice(0, PREVIEW_PER_GROUP);
            const overflow = group.hits.length - preview.length;
            const shape: TwentyAvatarShape = ROUND_AVATAR_OBJECTS.has(
              descriptor.slug,
            )
              ? 'round'
              : 'square';
            return (
              <section key={descriptor.slug} className="stw-group">
                <header className="stw-group__head">
                  <Icon size={15} aria-hidden="true" />
                  {descriptor.labelPlural}
                  <span className="stw-group__count">{group.hits.length}</span>
                </header>
                <ul className="stw-hits">
                  {preview.map((hit) => {
                    // Resolve this hit's slot in the flattened keyboard list,
                    // then offset by the verb rows that precede the hits.
                    const flat = flatHits.find(
                      (f) => f.hit.object === hit.object && f.hit.id === hit.id,
                    );
                    const navIndex =
                      flat ? verbs.length + flat.index : -1;
                    const active = navIndex >= 0 && navIndex === activeIndex;
                    return (
                      <li key={`${hit.object}:${hit.id}`}>
                        <Link
                          id={`stsg-nav-${navIndex}`}
                          data-nav-index={navIndex}
                          data-active={active}
                          role="option"
                          aria-selected={active}
                          href={`${CRM_BASE_PATH}/${hit.object}/${hit.id}`}
                          className="stw-hit stsg-hit"
                          onMouseEnter={() => setActiveIndex(navIndex)}
                          onClick={() => rememberSearch(query)}
                        >
                          <TwentyAvatar
                            name={hit.label || 'Untitled'}
                            size="sm"
                            shape={shape}
                            className="stsg-hit__avatar"
                          />
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
                    );
                  })}
                </ul>
                <Button
                  variant="ghost"
                  size="sm"
                  block
                  className="stsg-group__more"
                  iconRight={ArrowRight}
                  onClick={() => openExpanded(descriptor.slug)}
                  aria-label={`See all results in ${descriptor.labelPlural}`}
                >
                  {overflow > 0
                    ? `See all in ${descriptor.labelPlural}`
                    : `See all ${group.hits.length} in ${descriptor.labelPlural}`}
                </Button>
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
          className="stw-group p-[var(--st-space-3)]"
        >
          <Skeleton
            height={16}
            width={120}
            className="mb-[var(--st-space-3)]"
          />
          <Skeleton
            height={28}
            width="100%"
            className="block mt-2"
          />
          <Skeleton
            height={28}
            width="100%"
            className="block mt-2"
          />
          <Skeleton
            height={28}
            width="75%"
            className="block mt-2"
          />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Expanded ("See all N") full paginated result list for one object
// ---------------------------------------------------------------------------

interface ExpandedResultsProps {
  slug: string;
  object: ObjectMetadata | undefined;
  descriptor: ObjectDescriptor;
  records: SabcrmRustRecord[];
  total: number;
  page: number;
  loading: boolean;
  error: string | null;
  query: string;
  onPage: (page: number) => void;
  onBack: () => void;
}

/**
 * The "See all N" experience: a full, paginated record list for a single object
 * filtered by the active query — fetched through `listSabcrmRecordsTw` (the real
 * records engine, not the capped global-search preview). Each row links to the
 * record's detail page. Twenty look only (`.st-*` / `.stw-*` + `.stsg-*`).
 */
function ExpandedResults({
  slug,
  object,
  descriptor,
  records,
  total,
  page,
  loading,
  error,
  query,
  onPage,
  onBack,
}: ExpandedResultsProps): React.JSX.Element {
  const Icon = descriptor.icon;
  const shape: TwentyAvatarShape = ROUND_AVATAR_OBJECTS.has(slug)
    ? 'round'
    : 'square';
  const totalPages = Math.max(1, Math.ceil(total / EXPANDED_PAGE_SIZE));
  const from = total === 0 ? 0 : (page - 1) * EXPANDED_PAGE_SIZE + 1;
  const to = Math.min(page * EXPANDED_PAGE_SIZE, total);

  if (error) {
    return (
      <Alert tone="danger" className="stsg-degraded">
        {error}
      </Alert>
    );
  }

  return (
    <div className="stw-groups" id="stsg-results">
      <section className="stw-group">
        <header className="stw-group__head">
          <Icon size={15} aria-hidden="true" />
          {descriptor.labelPlural}
          <span className="stw-group__count">{total}</span>
        </header>

        {loading && records.length === 0 ? (
          <ResultsSkeleton />
        ) : records.length === 0 ? (
          <div className="st-empty">
            <span className="st-empty__icon" aria-hidden="true">
              <Database size={20} />
            </span>
            <p className="st-empty__title">No matching {descriptor.labelPlural}</p>
            <p className="st-empty__desc">
              Nothing in {descriptor.labelPlural} matches &ldquo;{query}&rdquo;.
            </p>
          </div>
        ) : (
          <ul className="stw-hits" role="listbox">
            {records.map((record) => {
              const label = recordLabel(object, record);
              return (
                <li key={record.id}>
                  <Link
                    role="option"
                    href={`${CRM_BASE_PATH}/${slug}/${record.id}`}
                    className="stw-hit stsg-hit"
                  >
                    <TwentyAvatar
                      name={label}
                      size="sm"
                      shape={shape}
                      className="stsg-hit__avatar"
                    />
                    <span className="stsg-hit__body">
                      <span className="stw-hit__label">
                        {highlight(label, query)}
                      </span>
                    </span>
                    <span className="stw-hit__kind">
                      {descriptor.labelSingular}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        {/* Pager + back affordance. */}
        <div className="stsg-pager">
          <Button
            variant="ghost"
            size="sm"
            iconLeft={ChevronLeft}
            onClick={onBack}
          >
            Back to all results
          </Button>
          {total > 0 ? (
            <div className="stsg-pager__nav">
              <span className="stsg-pager__range">
                {from}&ndash;{to} of {total}
              </span>
              <IconButton
                variant="outline"
                size="sm"
                icon={ChevronLeft}
                label="Previous page"
                disabled={page <= 1 || loading}
                onClick={() => onPage(Math.max(1, page - 1))}
              />
              <span className="stsg-pager__page">
                {page} / {totalPages}
              </span>
              <IconButton
                variant="outline"
                size="sm"
                icon={ChevronRight}
                label="Next page"
                disabled={page >= totalPages || loading}
                onClick={() => onPage(Math.min(totalPages, page + 1))}
              />
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
