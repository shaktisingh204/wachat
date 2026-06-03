'use client';

export const dynamic = 'force-dynamic';

/**
 * SabCRM — global record search (`/sabcrm/search`).
 *
 * Twenty's "command menu / search" parity as an always-visible page: one search
 * box that fans out across **every** object in the active project and merges the
 * hits into per-object groups, each linking to the record's detail page.
 *
 * Why a self-written inline page (not {@link SabcrmCommand})
 * ---------------------------------------------------------
 * `SabcrmCommand` is a *controlled modal* — it requires `open` / `onOpenChange`
 * and lives inside a `ZoruCommandDialog`, so it cannot run as a permanently
 * mounted page panel. This page therefore rebuilds the cross-object search on
 * top of the same gated action the palette uses.
 *
 * Data model
 * ----------
 * `searchRecordsForPickerAction(targetObject, search, limit?, projectId?)` is a
 * *per-object* search returning `SabcrmPickerOption[]` (`{ id, label, object }`),
 * matched against each object's label field. To search "everything" we first
 * load the object catalogue via {@link listObjectsAction}, then fan the query
 * out across those slugs (capped) and group the results by object — mirroring
 * the command palette's proven approach. A monotonic request id guards against
 * out-of-order async responses.
 *
 * This page is a Client Component: the surrounding `src/app/sabcrm/layout.tsx`
 * already enforces auth / onboarding / `RBACGuard`, mounts the project provider,
 * and opens the `.zoruui` scope. Every action below independently re-runs the
 * full session → project → RBAC (`sabcrm:view`) → plan gate, so the page fails
 * closed (calm empty/error states) for anyone who slips past the layout guard.
 */

import * as React from 'react';
import Link from 'next/link';
import { icons as lucideIcons, Database, Search, AlertTriangle } from 'lucide-react';

import {
  Input,
  Badge,
  Skeleton,
  EmptyState,
  Alert,
  ZoruAlertTitle,
  ZoruAlertDescription,
  Card,
  ZoruCardHeader,
  ZoruCardTitle,
  ZoruCardContent,
  PageHeader,
  ZoruPageHeading,
  ZoruPageEyebrow,
  ZoruPageTitle,
  ZoruPageDescription,
} from '@/components/zoruui';
import { useProject } from '@/context/project-context';
import {
  listObjectsAction,
  searchRecordsForPickerAction,
} from '@/app/actions/sabcrm.actions';
import type { SabcrmPickerOption } from '@/app/actions/sabcrm.actions.types';
import type { ObjectMetadata } from '@/lib/sabcrm/types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Base route every SabCRM page lives under (matches the live page links). */
const CRM_BASE_PATH = '/sabcrm';
/** Debounce window before a query is committed to the network. */
const SEARCH_DEBOUNCE_MS = 250;
/** Minimum query length before we search (the action matches a label substring). */
const MIN_QUERY_LEN = 2;
/** Per-object cap for hits, and the max number of objects we fan out to. */
const SEARCH_PER_OBJECT = 6;
const SEARCH_MAX_OBJECTS = 12;

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

/**
 * Resolve a lucide icon name (as stored on {@link ObjectMetadata.icon}) to a
 * node, falling back to a neutral glyph. Mirrors `sabcrm-command.tsx`.
 */
function objectIcon(name: string | undefined): React.ReactNode {
  if (name && name in lucideIcons) {
    const Icon = lucideIcons[name as keyof typeof lucideIcons];
    return <Icon className="h-4 w-4 text-zoru-ink-muted" />;
  }
  return <Database className="h-4 w-4 text-zoru-ink-muted" />;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** One object's slice of the merged results. */
interface ResultGroup {
  object: ObjectMetadata;
  options: SabcrmPickerOption[];
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SabcrmSearchPage() {
  const { activeProjectId } = useProject();

  // Object catalogue (loaded once per project).
  const [objects, setObjects] = React.useState<ObjectMetadata[]>([]);
  const [objectsError, setObjectsError] = React.useState<string | null>(null);
  const [loadingObjects, setLoadingObjects] = React.useState(true);

  // Search box (raw) → committed (debounced) query.
  const [input, setInput] = React.useState('');
  const [query, setQuery] = React.useState('');

  // Results.
  const [groups, setGroups] = React.useState<ResultGroup[]>([]);
  const [searching, setSearching] = React.useState(false);
  const [searchError, setSearchError] = React.useState<string | null>(null);

  // Monotonic request id so out-of-order async responses are ignored.
  const reqIdRef = React.useRef(0);

  // Load the object catalogue when the project changes.
  React.useEffect(() => {
    let cancelled = false;
    setLoadingObjects(true);
    setObjectsError(null);

    (async () => {
      const res = await listObjectsAction(activeProjectId ?? undefined);
      if (cancelled) return;
      if (!res.ok) {
        setObjectsError(res.error);
        setObjects([]);
      } else {
        setObjects(res.data);
      }
      setLoadingObjects(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [activeProjectId]);

  // Debounce the search box → committed `query`.
  React.useEffect(() => {
    const t = setTimeout(() => setQuery(input.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [input]);

  // Fan the committed query out across objects.
  React.useEffect(() => {
    const q = query;
    if (q.length < MIN_QUERY_LEN || objects.length === 0) {
      setGroups([]);
      setSearching(false);
      setSearchError(null);
      return;
    }

    let cancelled = false;
    const myReq = ++reqIdRef.current;
    setSearching(true);
    setSearchError(null);

    const targets = objects.slice(0, SEARCH_MAX_OBJECTS);

    void Promise.all(
      targets.map((obj) =>
        searchRecordsForPickerAction(
          obj.slug,
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
          merged.push({ object: targets[i], options: res.data });
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
  }, [query, objects, activeProjectId]);

  const hasQuery = query.length >= MIN_QUERY_LEN;
  const totalHits = groups.reduce((n, g) => n + g.options.length, 0);

  // ---- Render --------------------------------------------------------------

  return (
    <main className="mx-auto min-h-[100dvh] w-full max-w-4xl px-6 py-10 sm:px-8 sm:py-14">
      <PageHeader className="mb-8">
        <ZoruPageHeading>
          <ZoruPageEyebrow>Command menu</ZoruPageEyebrow>
          <ZoruPageTitle>Search</ZoruPageTitle>
          <ZoruPageDescription>
            Find any record across your CRM.
          </ZoruPageDescription>
        </ZoruPageHeading>
      </PageHeader>

      {/* Search box */}
      <div className="relative mb-6">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zoru-ink-muted" />
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Search records across every object…"
          className="pl-9"
          autoFocus
          aria-label="Search records"
        />
      </div>

      {/* Catalogue failed to load (RBAC-denied / plan-locked / load failure). */}
      {objectsError && !loadingObjects ? (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <ZoruAlertTitle>Search is unavailable</ZoruAlertTitle>
          <ZoruAlertDescription>{objectsError}</ZoruAlertDescription>
        </Alert>
      ) : searchError ? (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <ZoruAlertTitle>Couldn&rsquo;t search records</ZoruAlertTitle>
          <ZoruAlertDescription>{searchError}</ZoruAlertDescription>
        </Alert>
      ) : !hasQuery ? (
        <EmptyState
          icon={<Search />}
          title="Start typing to search"
          description="Search by name across contacts, companies, opportunities, tasks and every other object in this workspace."
        />
      ) : searching ? (
        <ResultsSkeleton />
      ) : totalHits === 0 ? (
        <EmptyState
          icon={<Database />}
          title="No matching records"
          description={`Nothing matches “${query}”. Try a different term or check another object.`}
        />
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <Card key={group.object.slug}>
              <ZoruCardHeader>
                <ZoruCardTitle className="flex items-center gap-2 text-base">
                  {objectIcon(group.object.icon)}
                  {group.object.labelPlural}
                  <Badge variant="secondary" className="ml-1">
                    {group.options.length}
                  </Badge>
                </ZoruCardTitle>
              </ZoruCardHeader>
              <ZoruCardContent className="pt-0">
                <ul className="divide-y divide-zoru-line">
                  {group.options.map((option) => (
                    <li key={`${option.object}:${option.id}`}>
                      <Link
                        href={`${CRM_BASE_PATH}/${option.object}/${option.id}`}
                        className="flex items-center justify-between gap-3 py-2.5 transition-colors hover:text-zoru-accent"
                      >
                        <span className="truncate font-medium text-zoru-ink">
                          {option.label || 'Untitled'}
                        </span>
                        <span className="shrink-0 text-xs text-zoru-ink-muted">
                          {group.object.labelSingular}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </ZoruCardContent>
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}

// ---------------------------------------------------------------------------
// Loading state
// ---------------------------------------------------------------------------

function ResultsSkeleton() {
  return (
    <div className="space-y-6">
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="space-y-3 rounded-xl border border-zoru-line p-4">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-3/4" />
        </div>
      ))}
    </div>
  );
}
