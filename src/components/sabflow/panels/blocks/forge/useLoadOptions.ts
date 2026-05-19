/**
 * React hook that resolves a Forge field's dynamic options against
 * `/api/sabflow/load-options`.
 *
 * Re-fetches whenever any of these change:
 *   • the selected credential
 *   • the value of any field listed in `field.loadOptionsDependsOn`
 *   • the field id itself (defensive)
 *
 * Phase 3 of the n8n parity plan will extend this with debounced search
 * and pagination. Today it makes one request per dep-key change and
 * returns the full result.
 */
'use client';

import { useEffect, useRef, useState } from 'react';
import type {
  ForgeField,
  ForgeSelectOption,
} from '@/lib/sabflow/forge/types';

export type UseLoadOptionsArgs = {
  blockId: string;
  actionId?: string;
  field: ForgeField;
  options: Record<string, unknown>;
  credentialId?: string;
};

export type UseLoadOptionsResult = {
  items: ForgeSelectOption[] | null;
  loading: boolean;
  error: string | null;
};

/** Build a stable string key that changes when any dep changes. */
function buildDepKey(args: UseLoadOptionsArgs): string {
  const deps = args.field.loadOptionsDependsOn ?? [];
  const depValues: Record<string, unknown> = {};
  for (const k of deps) depValues[k] = args.options[k] ?? null;
  return JSON.stringify({
    blockId: args.blockId,
    actionId: args.actionId ?? null,
    fieldId: args.field.id,
    credentialId: args.credentialId ?? null,
    deps: depValues,
  });
}

export function useLoadOptions(args: UseLoadOptionsArgs): UseLoadOptionsResult {
  const [items, setItems] = useState<ForgeSelectOption[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const depKey = buildDepKey(args);
  const lastKey = useRef<string | null>(null);

  useEffect(() => {
    if (typeof args.field.loadOptions !== 'function') return;
    if (lastKey.current === depKey) return;
    lastKey.current = depKey;

    const ac = new AbortController();
    setLoading(true);
    setError(null);

    fetch('/api/sabflow/load-options', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        blockId: args.blockId,
        fieldId: args.field.id,
        actionId: args.actionId,
        credentialId: args.credentialId,
        options: args.options,
      }),
      signal: ac.signal,
    })
      .then(async (res) => {
        const json = (await res.json().catch(() => ({}))) as {
          options?: ForgeSelectOption[];
          error?: string;
        };
        if (!res.ok) throw new Error(json.error ?? `Failed (${res.status})`);
        if (ac.signal.aborted) return;
        setItems(Array.isArray(json.options) ? json.options : []);
      })
      .catch((err: unknown) => {
        if (ac.signal.aborted) return;
        setError(err instanceof Error ? err.message : 'Failed to load options');
      })
      .finally(() => {
        if (!ac.signal.aborted) setLoading(false);
      });

    return () => ac.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depKey]);

  return { items, loading, error };
}
