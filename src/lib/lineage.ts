/**
 * Lineage helpers — pure, server-safe utilities for the cross-feature
 * data lineage chain described in `crm_function_plan.md` §13.5.
 *
 * The shape of a `LineageRef` and the union `LineageKind` are owned by
 * `src/lib/definitions.ts` so they remain the single source of truth
 * across UI, server actions, and database persistence. Anything in
 * here is just glue around that type — no React, no Mongo, no I/O.
 */

import type { LineageKind, LineageRef } from './definitions';

/**
 * Append one or more refs to an existing lineage list, deduping by
 * `(kind, id)` so a given doc never appears twice in the chain. The
 * input `existing` list is not mutated.
 */
export function appendLineage(
    existing: LineageRef[] | undefined,
    refs: LineageRef[] | LineageRef,
): LineageRef[] {
    const list = existing ? [...existing] : [];
    const incoming = Array.isArray(refs) ? refs : [refs];
    for (const ref of incoming) {
        if (!list.some((x) => x.kind === ref.kind && x.id === ref.id)) {
            list.push(ref);
        }
    }
    return list;
}

/**
 * Build the lineage array for a newly-converted child doc by copying
 * the parent's lineage and appending the parent itself. The new doc
 * should persist the returned array as its own `lineage` field.
 *
 * Example: when converting Quotation → Invoice, call this with the
 * quotation as `parent` and assign the result to the new invoice.
 */
export function buildLineageFromParent(parent: {
    kind: LineageKind;
    id: string;
    no?: string;
    status?: string;
    lineage?: LineageRef[];
}): LineageRef[] {
    return appendLineage(parent.lineage, {
        kind: parent.kind,
        id: parent.id,
        no: parent.no,
        status: parent.status,
        createdAt: new Date().toISOString(),
    });
}
