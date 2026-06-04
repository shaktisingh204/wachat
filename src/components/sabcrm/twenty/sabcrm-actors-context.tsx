'use client';

/**
 * SabCRM — workspace-member name resolver (context).
 *
 * ACTOR fields (`createdBy` / `updatedBy`) and member RELATION fields store a
 * raw workspaceMember / user **id**. Rendering that id verbatim shows an opaque
 * `6a15…` hex instead of a person. This provider loads the project's
 * `workspaceMembers` records ONCE and exposes an `id → display name` resolver,
 * so every {@link TwentyFieldValue} ACTOR cell across SabCRM (list table, board,
 * record detail, summary widgets) paints the person's name automatically — no
 * per-screen prop threading.
 *
 * Mounted high in the `/sabcrm` layout (inside `ProjectProvider`, whose
 * `activeProjectId` it reads). Best-effort: empty on failure / engine down, and
 * `useResolveActorName()` degrades to a no-op resolver when used outside the
 * provider, so ACTOR cells simply fall back to the raw id.
 */

import * as React from 'react';

import { useProject } from '@/context/project-context';
import { listSabcrmRecordsTw } from '@/app/actions/sabcrm-twenty.actions';

/** Resolve a workspaceMember / user id to its display name (or `undefined`). */
export type ResolveActorName = (id: string) => string | undefined;

const NOOP_RESOLVER: ResolveActorName = () => undefined;

const ActorNameContext = React.createContext<ResolveActorName | null>(null);

/** The CRM object slug whose records hold one entry per team member. */
const MEMBERS_OBJECT_SLUG = 'workspaceMembers';
/** Upper bound on members fetched for the resolver map. */
const MEMBERS_LIMIT = 200;

/** First non-empty trimmed string among the candidates. */
function firstStr(...candidates: unknown[]): string {
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c.trim();
  }
  return '';
}

/**
 * Loads the project's workspace members and provides an `id → name` resolver to
 * the subtree. Reloads whenever the active project changes.
 */
export function SabcrmActorNameProvider({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const { activeProjectId } = useProject();
  const [names, setNames] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await listSabcrmRecordsTw(
        MEMBERS_OBJECT_SLUG,
        { limit: MEMBERS_LIMIT },
        activeProjectId ?? undefined,
      );
      if (cancelled || !res.ok) return;
      const map: Record<string, string> = {};
      for (const rec of res.data.records) {
        const d = rec.data ?? {};
        const name =
          firstStr(d.name) ||
          [firstStr(d.firstName), firstStr(d.lastName)]
            .filter(Boolean)
            .join(' ')
            .trim() ||
          firstStr(d.email);
        if (name) map[rec.id] = name;
      }
      setNames(map);
    })();
    return () => {
      cancelled = true;
    };
  }, [activeProjectId]);

  const resolve = React.useCallback<ResolveActorName>(
    (id) => (id ? names[id.trim()] : undefined),
    [names],
  );

  return (
    <ActorNameContext.Provider value={resolve}>
      {children}
    </ActorNameContext.Provider>
  );
}

/**
 * Resolve a workspaceMember / user id to a name. Returns a no-op resolver when
 * called outside a {@link SabcrmActorNameProvider}, so callers can use it
 * unconditionally and degrade to showing the raw id.
 */
export function useResolveActorName(): ResolveActorName {
  return React.useContext(ActorNameContext) ?? NOOP_RESOLVER;
}
