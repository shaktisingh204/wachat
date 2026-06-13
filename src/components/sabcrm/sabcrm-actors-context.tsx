'use client';

/**
 * SabCRM — record / actor name resolver (context).
 *
 * ACTOR fields (`createdBy` / `updatedBy`) and RELATION fields (`company`,
 * `pointOfContact`, `owner`, `accountOwner`, `assignee`, …) store a raw record
 * **id**. Rendering that id verbatim shows an opaque `6a15…` hex instead of a
 * name. This provider resolves ids to `{ label, avatarUrl, shape }` so every
 * {@link TwentyFieldValue} ACTOR + RELATION cell paints a real name (people as
 * their FULL name), engine-independent.
 *
 * Resolution is two-tier so it works at ANY dataset size:
 *   1. **Warm pre-load** — workspace members + the most-recent companies/people/
 *      leads are loaded once per project for instant hits on the common case.
 *   2. **On-demand** — any id NOT in the warm set (e.g. a relation pointing at an
 *      old record beyond the pre-load) is resolved lazily: cells `request()` the
 *      ids they need, the provider batches them per object and resolves them via
 *      {@link resolveSabcrmRefsTw} (one round-trip; the server fans out to the
 *      engine). Results are cached; failures are remembered so we never re-fetch
 *      or loop. This removes the old hard cap where overflow ids showed as raw
 *      Mongo ids.
 *
 * Mounted high in the `/sabcrm` layout (inside `ProjectProvider`). Best-effort:
 * empty on failure / engine down; the hooks degrade to no-ops outside the
 * provider so cells fall back to the raw id.
 */

import * as React from 'react';

import { useProject } from '@/context/project-context';
import {
  listSabcrmRecordsTw,
  resolveSabcrmRefsTw,
} from '@/app/actions/sabcrm-twenty.actions';
import { personFullName } from '@/lib/sabcrm/record-label';

/** A resolved record reference: display label + optional avatar. */
export interface SabcrmRecordRef {
  label: string;
  avatarUrl?: string;
  shape: 'square' | 'round';
}

/** Resolve a record id to its full reference (or `undefined`). */
export type ResolveRecordRef = (id: string) => SabcrmRecordRef | undefined;
/** Ask the provider to resolve ids (of `object`) it doesn't yet know. */
export type RequestRecordRefs = (object: string, ids: string[]) => void;
/** Resolve a workspaceMember / record id to its display name (or `undefined`). */
export type ResolveActorName = (id: string) => string | undefined;

interface RecordRefContextValue {
  resolve: ResolveRecordRef;
  request: RequestRecordRefs;
}

const NOOP_CONTEXT: RecordRefContextValue = {
  resolve: () => undefined,
  request: () => undefined,
};
const NOOP_NAME_RESOLVER: ResolveActorName = () => undefined;

const RecordRefContext = React.createContext<RecordRefContextValue | null>(null);

/** Warm pre-load sources + how each maps to a label/avatar. */
const DIRECTORY_SOURCES: ReadonlyArray<{
  slug: string;
  limit: number;
  shape: 'square' | 'round';
  avatarKey?: string;
}> = [
  { slug: 'workspaceMembers', limit: 200, shape: 'round', avatarKey: 'avatarUrl' },
  { slug: 'companies', limit: 1500, shape: 'square', avatarKey: 'logoUrl' },
  { slug: 'people', limit: 1500, shape: 'round', avatarKey: 'avatarUrl' },
  { slug: 'leads', limit: 1500, shape: 'square' },
];

/** First non-empty trimmed string among the candidates. */
function firstStr(...candidates: unknown[]): string {
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c.trim();
  }
  return '';
}

/** Is this object slug person-like (round avatar, full-name label)? */
function isPersonSlug(slug: string): boolean {
  return /people|person|contact/i.test(slug) || /member|workspace/i.test(slug);
}

/** The avatar shape to draw for a record of the given object. */
function shapeForSlug(slug: string): 'square' | 'round' {
  return /compan/i.test(slug) ? 'square' : isPersonSlug(slug) ? 'round' : 'square';
}

/** Compute the label for a directory record from its slug + data. */
function labelForSlug(slug: string, data: Record<string, unknown>): string {
  if (isPersonSlug(slug)) {
    const full = personFullName(data);
    if (full) return full;
  }
  return firstStr(data.name, data.title, data.firstName, data.email);
}

export function SabcrmActorNameProvider({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const { activeProjectId } = useProject();
  const [refs, setRefs] = React.useState<Record<string, SabcrmRecordRef>>({});

  // Stable mirrors for the imperative on-demand machinery (kept out of render).
  const refsRef = React.useRef(refs);
  React.useEffect(() => {
    refsRef.current = refs;
  }, [refs]);
  const projectIdRef = React.useRef(activeProjectId);
  React.useEffect(() => {
    projectIdRef.current = activeProjectId;
  }, [activeProjectId]);

  const inflight = React.useRef<Set<string>>(new Set()); // "object:id" in flight
  const attempted = React.useRef<Set<string>>(new Set()); // "object:id" already tried
  const pending = React.useRef<Map<string, Set<string>>>(new Map()); // object -> ids
  const flushTimer = React.useRef<number | null>(null);

  // Warm pre-load (and a clean reset) whenever the active project changes.
  React.useEffect(() => {
    let cancelled = false;
    inflight.current.clear();
    attempted.current.clear();
    pending.current.clear();
    if (flushTimer.current != null) {
      window.clearTimeout(flushTimer.current);
      flushTimer.current = null;
    }
    setRefs({});
    (async () => {
      const results = await Promise.all(
        DIRECTORY_SOURCES.map((src) =>
          listSabcrmRecordsTw(src.slug, { limit: src.limit }, activeProjectId ?? undefined)
            .then((res) => ({ src, res }))
            .catch(() => ({ src, res: null as null })),
        ),
      );
      if (cancelled) return;
      const map: Record<string, SabcrmRecordRef> = {};
      for (const { src, res } of results) {
        if (!res || !res.ok) continue;
        for (const rec of res.data.records) {
          const data = (rec.data ?? {}) as Record<string, unknown>;
          const label = labelForSlug(src.slug, data);
          if (!label) continue;
          const avatarUrl = src.avatarKey ? firstStr(data[src.avatarKey]) : '';
          map[rec.id] = { label, avatarUrl: avatarUrl || undefined, shape: src.shape };
        }
      }
      setRefs((prev) => ({ ...prev, ...map }));
    })();
    return () => {
      cancelled = true;
    };
  }, [activeProjectId]);

  // Resolve the queued ids per object, merge results, remember attempts.
  const flush = React.useCallback(() => {
    flushTimer.current = null;
    const batches = pending.current;
    pending.current = new Map();
    batches.forEach((idSet, object) => {
      const ids = [...idSet];
      ids.forEach((id) => inflight.current.add(`${object}:${id}`));
      void resolveSabcrmRefsTw(object, ids, projectIdRef.current ?? undefined)
        .then((res) => {
          if (!res.ok) return;
          const shape = shapeForSlug(object);
          const add: Record<string, SabcrmRecordRef> = {};
          for (const r of res.data) {
            add[r.id] = { label: r.label, avatarUrl: r.avatarUrl, shape };
          }
          if (Object.keys(add).length) {
            setRefs((prev) => ({ ...prev, ...add }));
          }
        })
        .catch(() => {
          /* graceful: ids stay unresolved (show raw), marked attempted below */
        })
        .finally(() => {
          ids.forEach((id) => {
            inflight.current.delete(`${object}:${id}`);
            attempted.current.add(`${object}:${id}`); // never re-fetch / loop
          });
        });
    });
  }, []);

  const request = React.useCallback<RequestRecordRefs>(
    (object, ids) => {
      let added = false;
      for (const id of ids) {
        if (!id) continue;
        const key = `${object}:${id}`;
        if (refsRef.current[id] || inflight.current.has(key) || attempted.current.has(key)) {
          continue;
        }
        let set = pending.current.get(object);
        if (!set) {
          set = new Set();
          pending.current.set(object, set);
        }
        if (set.has(id)) continue;
        set.add(id);
        added = true;
      }
      if (added && flushTimer.current == null) {
        flushTimer.current = window.setTimeout(flush, 40);
      }
    },
    [flush],
  );

  const resolve = React.useCallback<ResolveRecordRef>(
    (id) => (id ? refs[id.trim()] : undefined),
    [refs],
  );

  const value = React.useMemo<RecordRefContextValue>(
    () => ({ resolve, request }),
    [resolve, request],
  );

  return <RecordRefContext.Provider value={value}>{children}</RecordRefContext.Provider>;
}

/**
 * Resolve a record id to its full reference (label + avatar). Returns a no-op
 * resolver outside a {@link SabcrmActorNameProvider}.
 */
export function useResolveRecordRef(): ResolveRecordRef {
  return (React.useContext(RecordRefContext) ?? NOOP_CONTEXT).resolve;
}

/**
 * Get the imperative `request(object, ids)` to lazily resolve ids not yet known.
 * No-op outside a {@link SabcrmActorNameProvider}.
 */
export function useRequestRecordRefs(): RequestRecordRefs {
  return (React.useContext(RecordRefContext) ?? NOOP_CONTEXT).request;
}

/**
 * Resolve a workspaceMember / record id to a display name. Adapts the record-ref
 * resolver so existing ACTOR call sites keep their `id → string` contract.
 * Returns a no-op resolver outside a {@link SabcrmActorNameProvider}.
 */
export function useResolveActorName(): ResolveActorName {
  const ctx = React.useContext(RecordRefContext);
  return React.useMemo<ResolveActorName>(() => {
    if (!ctx) return NOOP_NAME_RESOLVER;
    return (id) => ctx.resolve(id)?.label;
  }, [ctx]);
}
