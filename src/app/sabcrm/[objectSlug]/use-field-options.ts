'use client';

/**
 * useFieldOptions — lazily resolve value-set-backed options for the record
 * surfaces.
 *
 * SELECT / MULTI_SELECT fields that reference a global value-set
 * (`settings.valueSetId`) must show the SET's active options, not the field's
 * (empty) inline list. This hook scans the object's fields for such references
 * and, once per (object, field, project), fetches the resolved active options
 * via the gated `getFieldOptionsTw` action. It exposes:
 *
 *   - `resolveField(field)` — a field with its `options` swapped to the resolved
 *     set, or the field unchanged when nothing is resolved yet (or it has no
 *     reference). Used at every `RecordCell` call site.
 *   - `resolveFields(fields)` — the same applied across a field list (for the
 *     detail surface, which hands `fields` to `RecordDetail` wholesale).
 *
 * Degrade-gracefully by construction: a missing set, a `{ ok: false }` result,
 * or the engine being down simply leaves the field's own inline `options` in
 * place — the form keeps working exactly as it does today. Fields WITHOUT a
 * value-set reference are never fetched.
 */

import * as React from 'react';

import type { FieldMetadata } from '@/lib/sabcrm/types';
import { getFieldOptionsTw } from '@/app/actions/sabcrm-fieldoptions.actions';
import {
  applyResolvedOptions,
  applyResolvedOptionsToFields,
  valueSetFieldKeys,
  type ResolvedOptionsMap,
} from './field-options';

export interface UseFieldOptions {
  /** Field with resolved value-set options (or unchanged on miss/failure). */
  resolveField: (field: FieldMetadata) => FieldMetadata;
  /** `resolveField` applied across a field list (same ref when unchanged). */
  resolveFields: (fields: FieldMetadata[]) => FieldMetadata[];
}

export function useFieldOptions(
  objectSlug: string,
  fields: FieldMetadata[] | undefined,
  projectId: string | null | undefined,
): UseFieldOptions {
  const [resolved, setResolved] = React.useState<ResolvedOptionsMap>({});

  // The value-set-referencing field keys — only these trigger a fetch. A stable
  // string key lets the effect re-run only when the actual set of keys changes.
  const keys = React.useMemo(
    () => valueSetFieldKeys(fields ?? []),
    [fields],
  );
  const keysSig = keys.join(',');

  // Reset the cache when the object or project changes — resolved options are
  // scoped to (objectSlug, projectId).
  React.useEffect(() => {
    setResolved({});
  }, [objectSlug, projectId]);

  React.useEffect(() => {
    if (!objectSlug || keys.length === 0) return;
    let cancelled = false;
    void (async () => {
      const entries = await Promise.all(
        keys.map(async (key) => {
          const res = await getFieldOptionsTw(
            objectSlug,
            key,
            projectId ?? undefined,
          );
          // Only adopt a NON-EMPTY result; an empty list falls back to inline
          // options (degrade gracefully — never blank out a working picker).
          return res.ok && res.data.length > 0
            ? ([key, res.data] as const)
            : null;
        }),
      );
      if (cancelled) return;
      const next: ResolvedOptionsMap = {};
      for (const e of entries) if (e) next[e[0]] = e[1];
      if (Object.keys(next).length > 0) setResolved(next);
    })();
    return () => {
      cancelled = true;
    };
    // keysSig captures the field-key set; objectSlug/projectId scope the fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [objectSlug, projectId, keysSig]);

  const resolveField = React.useCallback(
    (field: FieldMetadata) => applyResolvedOptions(field, resolved),
    [resolved],
  );
  const resolveFields = React.useCallback(
    (list: FieldMetadata[]) => applyResolvedOptionsToFields(list, resolved),
    [resolved],
  );

  return { resolveField, resolveFields };
}
