'use client';

/**
 * SabCRM — Functions settings: local + server persistence hook.
 *
 * Functions on this page are *definitions only* — a place to author and keep
 * serverless / logic function snippets. There is no execution backend wired up
 * yet, so definitions are stored both in `localStorage` (instant, per-device
 * cache) and in the gated CRM settings document on the backend (server is the
 * source of truth, so definitions follow the user across devices).
 *
 * The pattern mirrors `accounts/page.tsx` → `useConnectedAccounts`:
 *   1. On mount: read from localStorage instantly (no hydration flash).
 *   2. When `sync.phase === 'ready' && sync.remote` → adopt the server list.
 *   3. On every real mutation → `void sync.save(nextList)` (fire-and-forget).
 *   4. localStorage write-through is kept on every change.
 *
 * Fails closed: server unreachable / RBAC / plan denied never throws or blocks —
 * the page keeps working off localStorage, same as before.
 */

import * as React from 'react';
import { useSettingsSync } from '../use-settings-sync';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type FunctionRuntime = 'node' | 'deno';

export interface CrmFunction {
  /** Stable client-generated id. */
  id: string;
  /** Display + (eventual) invocation name. */
  name: string;
  /** Target runtime for the eventual engine. */
  runtime: FunctionRuntime;
  /** The function source — stored verbatim, never executed. */
  code: string;
  /** Free-text note describing when this function is meant to run. */
  trigger: string;
  /** ISO timestamps. */
  createdAt: string;
  updatedAt: string;
}

/** Fields the editor can mutate. */
export type CrmFunctionDraft = Pick<
  CrmFunction,
  'name' | 'runtime' | 'code' | 'trigger'
>;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'sabcrm.settings.functions.v1';

export const RUNTIME_LABELS: Record<FunctionRuntime, string> = {
  node: 'Node.js',
  deno: 'Deno',
};

const STARTER_CODE = `// This is a definition only — it is not executed yet.
// When the SabCRM function engine is available, the exported
// handler below will run on the selected runtime.

export default async function handler(event, context) {
  // event:   the record / trigger payload
  // context: workspace + auth metadata
  return { ok: true };
}
`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Crypto-backed id with a Math.random fallback for older runtimes. */
function makeId(): string {
  try {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return `fn_${crypto.randomUUID()}`;
    }
  } catch {
    /* fall through */
  }
  return `fn_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

function isRuntime(value: unknown): value is FunctionRuntime {
  return value === 'node' || value === 'deno';
}

/** Best-effort validation/normalisation of a single persisted record. */
function normalize(raw: unknown): CrmFunction | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== 'string' || typeof r.name !== 'string') return null;
  const now = new Date().toISOString();
  return {
    id: r.id,
    name: r.name,
    runtime: isRuntime(r.runtime) ? r.runtime : 'node',
    code: typeof r.code === 'string' ? r.code : '',
    trigger: typeof r.trigger === 'string' ? r.trigger : '',
    createdAt: typeof r.createdAt === 'string' ? r.createdAt : now,
    updatedAt: typeof r.updatedAt === 'string' ? r.updatedAt : now,
  };
}

function readStore(): CrmFunction[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(normalize)
      .filter((f): f is CrmFunction => f !== null);
  } catch {
    return [];
  }
}

function writeStore(items: CrmFunction[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    /* storage unavailable — keep in-memory state only */
  }
}

// ---------------------------------------------------------------------------
// Server-sync coercion
// ---------------------------------------------------------------------------

/** Coerce the raw server slice into a clean function list (or null). */
function coerceFunctions(raw: unknown): CrmFunction[] | null {
  if (!Array.isArray(raw)) return null;
  return raw.map(normalize).filter((f): f is CrmFunction => f !== null);
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export interface UseFunctionsResult {
  functions: CrmFunction[];
  /** True until the first read from storage completes (avoids hydration flash). */
  ready: boolean;
  /** True when the backend settings service is unreachable (UI-only hint). */
  offline: boolean;
  /** Creates a new function with starter content and returns it. */
  create: () => CrmFunction;
  /** Applies a draft to an existing function; no-op if the id is unknown. */
  update: (id: string, draft: CrmFunctionDraft) => void;
  /** Removes a function. */
  remove: (id: string) => void;
}

export function useFunctions(): UseFunctionsResult {
  const [functions, setFunctions] = React.useState<CrmFunction[]>([]);
  const [ready, setReady] = React.useState(false);
  const sync = useSettingsSync<CrmFunction[]>('functions', coerceFunctions);

  // Hydrate once on mount from localStorage (instant, no network wait).
  React.useEffect(() => {
    setFunctions(readStore());
    setReady(true);
  }, []);

  // When the server resolves a stored list, adopt it as the source of truth.
  React.useEffect(() => {
    if (sync.phase !== 'ready' || !sync.remote) return;
    setFunctions(sync.remote);
  }, [sync.phase, sync.remote]);

  // Persist through every change to localStorage (but only after the initial
  // hydration so we never clobber on first paint).
  React.useEffect(() => {
    if (!ready) return;
    writeStore(functions);
  }, [functions, ready]);

  // Fire-and-forget server save — separated from the localStorage effect so
  // the server write happens only on real mutations, not on server-adopt above.
  const persist = React.useCallback(
    (next: CrmFunction[]) => {
      void sync.save(next);
    },
    [sync],
  );

  const create = React.useCallback((): CrmFunction => {
    const now = new Date().toISOString();
    const fn: CrmFunction = {
      id: makeId(),
      name: `untitled-function-${functions.length + 1}`,
      runtime: 'node',
      code: STARTER_CODE,
      trigger: '',
      createdAt: now,
      updatedAt: now,
    };
    setFunctions((prev) => {
      const next = [fn, ...prev];
      persist(next);
      return next;
    });
    return fn;
  }, [functions.length, persist]);

  const update = React.useCallback(
    (id: string, draft: CrmFunctionDraft) => {
      setFunctions((prev) => {
        const next = prev.map((fn) =>
          fn.id === id
            ? { ...fn, ...draft, updatedAt: new Date().toISOString() }
            : fn,
        );
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const remove = React.useCallback(
    (id: string) => {
      setFunctions((prev) => {
        const next = prev.filter((fn) => fn.id !== id);
        persist(next);
        return next;
      });
    },
    [persist],
  );

  return { functions, ready, offline: sync.phase === 'offline', create, update, remove };
}
