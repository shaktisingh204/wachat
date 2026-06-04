'use client';

/**
 * SabCRM — record / actor name resolver (context).
 *
 * ACTOR fields (`createdBy` / `updatedBy`) and RELATION fields (`company`,
 * `pointOfContact`, `owner`, `accountOwner`, `assignee`, …) store a raw record
 * **id**. Rendering that id verbatim shows an opaque `6a15…` hex instead of a
 * name (the exact bug seen on the Leads list: Company + Point of Contact columns
 * showing Mongo ids). This provider loads the project's directory records ONCE —
 * workspace members + companies + people + leads — and exposes a resolver from
 * `id → { label, avatarUrl, shape }`, so every {@link TwentyFieldValue} ACTOR
 * and RELATION cell across SabCRM paints a real name (and avatar) automatically,
 * with **people rendered as their FULL name** (First Last), engine-independent.
 *
 * Mounted high in the `/sabcrm` layout (inside `ProjectProvider`, whose
 * `activeProjectId` it reads). Best-effort: empty on failure / engine down, and
 * the hooks degrade to no-op resolvers when used outside the provider, so cells
 * simply fall back to the raw id.
 */

import * as React from 'react';

import { useProject } from '@/context/project-context';
import { listSabcrmRecordsTw } from '@/app/actions/sabcrm-twenty.actions';
import { personFullName } from '@/lib/sabcrm/record-label';

/** A resolved record reference: display label + optional avatar. */
export interface SabcrmRecordRef {
  label: string;
  avatarUrl?: string;
  shape: 'square' | 'round';
}

/** Resolve a record id to its full reference (or `undefined`). */
export type ResolveRecordRef = (id: string) => SabcrmRecordRef | undefined;
/** Resolve a workspaceMember / record id to its display name (or `undefined`). */
export type ResolveActorName = (id: string) => string | undefined;

const NOOP_REF_RESOLVER: ResolveRecordRef = () => undefined;
const NOOP_NAME_RESOLVER: ResolveActorName = () => undefined;

const RecordRefContext = React.createContext<ResolveRecordRef | null>(null);

/**
 * The directory objects loaded for resolution + how each maps to a label/avatar.
 * Members keep the existing 200 cap; the relation targets use a higher cap so
 * the common id references on a page resolve. Records beyond the cap fall back
 * to their id (rare for typical CRMs).
 */
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

/** Compute the label for a directory record from its slug + data. */
function labelForDirectoryRecord(slug: string, data: Record<string, unknown>): string {
  if (/people|person|contact/i.test(slug) || /member|workspace/i.test(slug)) {
    const full = personFullName(data);
    if (full) return full;
  }
  return firstStr(data.name, data.title, data.firstName, data.email);
}

/**
 * Loads the project's directory records (members + companies + people + leads)
 * and provides an `id → SabcrmRecordRef` resolver to the subtree. Reloads
 * whenever the active project changes.
 */
export function SabcrmActorNameProvider({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const { activeProjectId } = useProject();
  const [refs, setRefs] = React.useState<Record<string, SabcrmRecordRef>>({});

  React.useEffect(() => {
    let cancelled = false;
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
          const label = labelForDirectoryRecord(src.slug, data);
          if (!label) continue;
          const avatarUrl = src.avatarKey ? firstStr(data[src.avatarKey]) : '';
          map[rec.id] = {
            label,
            avatarUrl: avatarUrl || undefined,
            shape: src.shape,
          };
        }
      }
      setRefs(map);
    })();
    return () => {
      cancelled = true;
    };
  }, [activeProjectId]);

  const resolve = React.useCallback<ResolveRecordRef>(
    (id) => (id ? refs[id.trim()] : undefined),
    [refs],
  );

  return (
    <RecordRefContext.Provider value={resolve}>
      {children}
    </RecordRefContext.Provider>
  );
}

/**
 * Resolve a record id to its full reference (label + avatar). Returns a no-op
 * resolver outside a {@link SabcrmActorNameProvider}.
 */
export function useResolveRecordRef(): ResolveRecordRef {
  return React.useContext(RecordRefContext) ?? NOOP_REF_RESOLVER;
}

/**
 * Resolve a workspaceMember / record id to a display name. Adapts the record-ref
 * resolver so existing ACTOR call sites keep their `id → string` contract.
 * Returns a no-op resolver outside a {@link SabcrmActorNameProvider}.
 */
export function useResolveActorName(): ResolveActorName {
  const resolveRef = React.useContext(RecordRefContext);
  return React.useMemo<ResolveActorName>(() => {
    if (!resolveRef) return NOOP_NAME_RESOLVER;
    return (id) => resolveRef(id)?.label;
  }, [resolveRef]);
}
