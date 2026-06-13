/**
 * SabCRM — territory management — PURE model + matcher.
 *
 * The structural twin of `./scoring.ts` and `./access-compiler.ts`: a
 * `'server-only'`- and I/O-free module so the unit tests (`tsx --test`) AND the
 * `'use client'` settings page can import the types + deterministic tree /
 * matching logic directly. The Mongo + write-back side effects live in
 * `./territory.server.ts`, which re-exports everything here.
 *
 * ## Model
 *
 * A {@link Territory} forms a forest via `parentId` edges (a root has
 * `parentId == null`). Each territory carries a flat list of
 * {@link TerritoryRule}s — every rule is a single {@link FilterCondition}
 * (the SAME operator vocabulary the records engine + scoring already use, see
 * `./records-filter.ts` / `./scoring.ts`). A record is STAMPED with the FIRST
 * territory (in evaluation order) whose rule set matches; rule-set matching is
 * ALL / ANY per the territory's `match` mode (default `all`).
 *
 * Managers roll up: a territory lists `managerUserIds`, and a manager of a
 * PARENT territory also manages every descendant (so access can roll up to a
 * region head). {@link managersForTerritory} returns the effective manager set
 * for one territory (self + ancestors), and {@link territorySubtree} returns a
 * territory + all of its descendants (the set whose records a manager may see).
 *
 * ## Storage envelope (see `./territory.server.ts`)
 *
 * The stamped territory id is a plain string at `data.territoryId` and the
 * compute meta rides the reserved `data.__territory`
 * (`{ territoryId, ruleId, matchedAt }`) — exactly the AI-fields scalar
 * envelope, so the records engine's table/board/filter tree renders it with
 * zero engine change and the write never bumps the record's `updatedAt`.
 *
 * SECURITY: this module is pure and side-effect free. The access roll-up it
 * powers (territory → owners → accessible-by set) is enforced only behind an
 * explicit, default-OFF per-project flag in the server layer — see
 * `./territory.server.ts` `territoryAccessUserIds` and the read-path snippet in
 * the action file. Nothing here widens access on its own.
 */

import type { FilterCondition } from './records-filter';
import { evalCondition } from './scoring';

/** How a territory's rules combine when matching a record. */
export type TerritoryMatchMode = 'all' | 'any';

/** One assignment rule: a single typed condition reusing the filter vocabulary. */
export interface TerritoryRule {
  /** Stable id (for React keys + the per-record stamp meta). */
  id: string;
  /** Optional human label shown in the editor + the "why" breakdown. */
  label?: string;
  /** The condition, reusing the records engine's filter vocabulary. */
  condition: FilterCondition;
}

/** A node in the territory forest (the doc shape minus the Mongo `_id`). */
export interface Territory {
  id: string;
  projectId: string;
  /** The object slug this territory assigns over, e.g. `accounts`. */
  objectSlug: string;
  name: string;
  /** Parent territory id, or `null`/absent for a root. */
  parentId?: string | null;
  enabled: boolean;
  /** ALL conditions must match (`all`) or ANY (`any`). Default `all`. */
  match: TerritoryMatchMode;
  /** The assignment rules evaluated against a record's `data`. */
  rules: TerritoryRule[];
  /** User ids that manage this territory (own + roll up to descendants). */
  managerUserIds: string[];
  /**
   * Evaluation order among siblings / the whole set — lower wins ties when two
   * territories both match a record. Stable, deterministic.
   */
  order: number;
  createdAt: string;
  updatedAt: string;
}

/** Shape accepted by the save action (server stamps id / timestamps / project). */
export interface TerritoryInput {
  /** Present → update; absent → insert. */
  id?: string;
  objectSlug: string;
  name: string;
  parentId?: string | null;
  enabled?: boolean;
  match?: TerritoryMatchMode;
  rules?: TerritoryRule[];
  managerUserIds?: string[];
  order?: number;
}

/** Result of assigning a record to a territory. */
export interface TerritoryAssignment {
  /** The matched territory id, or null when nothing matched. */
  territoryId: string | null;
  /** The matched territory (for the "why" breakdown), or null. */
  territory: Territory | null;
}

/** A rendered tree node: a territory plus its already-built children. */
export interface TerritoryTreeNode {
  territory: Territory;
  children: TerritoryTreeNode[];
}

/* -------------------------------------------------------------------------- */
/* Tree construction                                                           */
/* -------------------------------------------------------------------------- */

/** Normalise a (possibly absent / nullish) parent id to a string key or ''. */
function parentKey(t: Pick<Territory, 'parentId'>): string {
  return t.parentId == null ? '' : String(t.parentId);
}

/**
 * Build the territory forest from a flat list. Orphans (a `parentId` pointing
 * at a missing/absent node) are treated as roots so nothing is ever dropped.
 * Siblings are ordered by `order` then `name` then `id` (stable, deterministic).
 * Cycle-safe: a node already attached is never re-attached.
 */
export function buildTerritoryTree(
  territories: Territory[],
): TerritoryTreeNode[] {
  const byId = new Map<string, Territory>();
  for (const t of territories) {
    if (t.id) byId.set(t.id, t);
  }
  const childrenOf = new Map<string, Territory[]>();
  const roots: Territory[] = [];
  for (const t of territories) {
    if (!t.id) continue;
    const pk = parentKey(t);
    if (pk && byId.has(pk) && pk !== t.id) {
      const arr = childrenOf.get(pk) ?? [];
      arr.push(t);
      childrenOf.set(pk, arr);
    } else {
      roots.push(t); // root or orphan
    }
  }

  const cmp = (a: Territory, b: Territory): number =>
    (a.order ?? 0) - (b.order ?? 0) ||
    a.name.localeCompare(b.name) ||
    a.id.localeCompare(b.id);

  const seen = new Set<string>();
  const build = (t: Territory): TerritoryTreeNode => {
    seen.add(t.id);
    const kids = (childrenOf.get(t.id) ?? [])
      .filter((c) => !seen.has(c.id)) // cycle guard
      .sort(cmp)
      .map(build);
    return { territory: t, children: kids };
  };

  const out = roots.sort(cmp).map(build);
  // Cycle survivors: nodes whose only ancestry is a cycle (no real root) are
  // never reached above. Surface each unvisited node as its own root so a
  // corrupt parent chain can never make a territory disappear.
  for (const ter of territories) {
    if (ter.id && !seen.has(ter.id)) out.push(build(ter));
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/* Subtree + managers                                                          */
/* -------------------------------------------------------------------------- */

/**
 * The set of territory ids in `rootId`'s subtree (the root + all descendants,
 * transitively) via BFS over `parentId` edges. Pure + cycle-safe. Returns `[]`
 * when `rootId` is not present.
 */
export function territorySubtree(
  territories: Territory[],
  rootId: string,
): string[] {
  if (!rootId) return [];
  const present = new Set(territories.filter((t) => t.id).map((t) => t.id));
  if (!present.has(rootId)) return [];

  const childrenOf = new Map<string, string[]>();
  for (const t of territories) {
    if (!t.id) continue;
    const pk = parentKey(t);
    if (pk && pk !== t.id) {
      const arr = childrenOf.get(pk) ?? [];
      arr.push(t.id);
      childrenOf.set(pk, arr);
    }
  }

  const out = new Set<string>();
  const queue = [rootId];
  while (queue.length > 0) {
    const id = queue.shift() as string;
    if (out.has(id)) continue; // cycle guard
    out.add(id);
    for (const childId of childrenOf.get(id) ?? []) {
      if (!out.has(childId)) queue.push(childId);
    }
  }
  return [...out];
}

/**
 * The effective manager user-id set for one territory: its own
 * `managerUserIds` PLUS the managers of every ANCESTOR (a parent manager rolls
 * down into children). Pure + cycle-safe; returns `[]` for an unknown id.
 */
export function managersForTerritory(
  territories: Territory[],
  territoryId: string,
): string[] {
  if (!territoryId) return [];
  const byId = new Map<string, Territory>();
  for (const t of territories) {
    if (t.id) byId.set(t.id, t);
  }
  if (!byId.has(territoryId)) return [];

  const out = new Set<string>();
  const seen = new Set<string>();
  let cursor: string | undefined = territoryId;
  while (cursor && byId.has(cursor) && !seen.has(cursor)) {
    seen.add(cursor);
    const t: Territory = byId.get(cursor) as Territory;
    for (const uid of t.managerUserIds ?? []) {
      if (uid) out.add(String(uid));
    }
    cursor = t.parentId == null ? undefined : String(t.parentId);
  }
  return [...out];
}

/**
 * Inverse roll-up: every territory id that `userId` effectively manages — the
 * territories where they are listed as a manager, PLUS all descendants of
 * each (managing a region manages its sub-regions). Pure + cycle-safe.
 *
 * This is the set whose records a manager may see when the (default-OFF)
 * territory access roll-up is enabled — see `./territory.server.ts`.
 */
export function territoriesManagedByUser(
  territories: Territory[],
  userId: string,
): string[] {
  if (!userId) return [];
  const direct = territories.filter((t) =>
    (t.managerUserIds ?? []).some((u) => String(u) === String(userId)),
  );
  const out = new Set<string>();
  for (const t of direct) {
    if (!t.id) continue;
    for (const id of territorySubtree(territories, t.id)) out.add(id);
  }
  return [...out];
}

/* -------------------------------------------------------------------------- */
/* Assignment (matching)                                                       */
/* -------------------------------------------------------------------------- */

/** Whether a single territory's rule set matches a record's `data` bag. */
export function territoryMatches(
  territory: Pick<Territory, 'rules' | 'match'>,
  data: Record<string, unknown>,
): boolean {
  const rules = (territory.rules ?? []).filter((r) => r?.condition);
  if (rules.length === 0) return false; // a rule-less territory never auto-stamps
  const mode: TerritoryMatchMode = territory.match === 'any' ? 'any' : 'all';
  if (mode === 'any') {
    return rules.some((r) => evalCondition(data, r.condition));
  }
  return rules.every((r) => evalCondition(data, r.condition));
}

/**
 * The id of the first rule (in order) that fires for a matching territory, used
 * for the "why" breakdown / stamp meta. Returns undefined when none fire (only
 * meaningful for `any`-mode partial matches; for `all` every rule fired).
 */
function firstMatchedRuleId(
  territory: Pick<Territory, 'rules'>,
  data: Record<string, unknown>,
): string | undefined {
  for (const r of territory.rules ?? []) {
    if (r?.condition && evalCondition(data, r.condition)) return r.id;
  }
  return undefined;
}

/**
 * Assign a record to a territory: evaluate the enabled territories in a
 * deterministic order (`order` then `name` then `id`) and return the FIRST
 * whose rule set matches. Pure + deterministic; no I/O. Disabled territories
 * and rule-less territories are skipped. Returns `{ territoryId: null }` when
 * nothing matches.
 */
export function assignTerritory(
  record: { data?: Record<string, unknown> } | Record<string, unknown>,
  territories: Territory[],
): TerritoryAssignment {
  const data = ((record as { data?: Record<string, unknown> })?.data ??
    record ??
    {}) as Record<string, unknown>;
  const ordered = [...territories]
    .filter((t) => t.enabled !== false && (t.rules?.length ?? 0) > 0)
    .sort(
      (a, b) =>
        (a.order ?? 0) - (b.order ?? 0) ||
        a.name.localeCompare(b.name) ||
        a.id.localeCompare(b.id),
    );
  for (const t of ordered) {
    if (territoryMatches(t, data)) {
      return { territoryId: t.id, territory: t };
    }
  }
  return { territoryId: null, territory: null };
}

/** Convenience: the rule id that drove an assignment (for the stamp meta). */
export function assignmentRuleId(
  territory: Territory | null,
  data: Record<string, unknown>,
): string | undefined {
  if (!territory) return undefined;
  return firstMatchedRuleId(territory, data);
}

/** Distinct field keys referenced by a territory's rule conditions. */
export function territorySourceFields(
  territory: Pick<Territory, 'rules'>,
): string[] {
  const out = new Set<string>();
  for (const r of territory.rules ?? []) {
    if (r?.condition?.field) out.add(r.condition.field);
  }
  return [...out];
}
