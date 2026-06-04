'use client';

/**
 * SabCRM — Functions settings: local persistence hook.
 *
 * Functions on this page are *definitions only* — a place to author and keep
 * serverless / logic function snippets. There is no execution backend wired up
 * yet, so everything persists client-side in `localStorage` under a single
 * versioned key. This mirrors the lightweight "prefs" pattern used elsewhere in
 * SabCRM settings: read once on mount, write through on every mutation, and
 * fail gracefully when storage is unavailable (private mode / SSR).
 *
 * Nothing here talks to the network. When the execution engine lands, these
 * definitions become the seed payload for it.
 */

import * as React from 'react';

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
// Hook
// ---------------------------------------------------------------------------

export interface UseFunctionsResult {
  functions: CrmFunction[];
  /** True until the first read from storage completes (avoids hydration flash). */
  ready: boolean;
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

  // Hydrate once on mount.
  React.useEffect(() => {
    setFunctions(readStore());
    setReady(true);
  }, []);

  // Persist through every change (but only after the initial hydration).
  React.useEffect(() => {
    if (!ready) return;
    writeStore(functions);
  }, [functions, ready]);

  const create = React.useCallback((): CrmFunction => {
    const now = new Date().toISOString();
    const existing = readStore().length + functions.length;
    const fn: CrmFunction = {
      id: makeId(),
      name: `untitled-function-${existing + 1}`,
      runtime: 'node',
      code: STARTER_CODE,
      trigger: '',
      createdAt: now,
      updatedAt: now,
    };
    setFunctions((prev) => [fn, ...prev]);
    return fn;
  }, [functions.length]);

  const update = React.useCallback((id: string, draft: CrmFunctionDraft) => {
    setFunctions((prev) =>
      prev.map((fn) =>
        fn.id === id
          ? { ...fn, ...draft, updatedAt: new Date().toISOString() }
          : fn,
      ),
    );
  }, []);

  const remove = React.useCallback((id: string) => {
    setFunctions((prev) => prev.filter((fn) => fn.id !== id));
  }, []);

  return { functions, ready, create, update, remove };
}
