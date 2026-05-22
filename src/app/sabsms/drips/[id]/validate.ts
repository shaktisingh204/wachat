/**
 * Drip builder — pure validator.
 *
 * Used by both the builder UI (Page 13 §B.2 feature 13 "Validate") and
 * the save server action (which refuses to persist an invalid drip).
 *
 * Kept side-effect free so it can be reused on the server, in the
 * browser, and in `node:test` without pulling in Next.js, React, Mongo,
 * or the SabSMS engine. The shape it validates (`DraftDrip`) is a
 * superset of `SabsmsDrip` from `@/lib/sabsms/types` — the builder uses
 * a more permissive draft form so half-built drips can still round-trip
 * through the canvas.
 *
 * Pure function exported: `validateDrip(drip)`.
 *
 *   Detects:
 *     - orphan nodes (no incoming or outgoing edges, excluding `start`
 *       and `exit` typed nodes)
 *     - cycles via DFS three-colour marking
 *     - missing template ids on `message` nodes
 *     - contradictory exit conditions (replied AND not-replied, etc.)
 *     - branches with no consequent (true/false outgoing edge missing)
 */

export type DraftDripNodeKind =
  | "start"
  | "message"
  | "wait"
  | "branch"
  | "exit";

export interface DraftDripNode {
  id: string;
  kind: DraftDripNodeKind;

  // message
  templateId?: string;

  // wait
  waitSeconds?: number;
  waitMode?: "relative" | "absolute";
  waitAbsoluteAt?: string;

  // branch
  branchOn?: "replied" | "clicked" | "opened";
  branchWithinSeconds?: number;

  // per-step
  quietHours?: { start: string; end: string };
  timeWindow?: { start: string; end: string };
  skipOnWeekend?: boolean;
  throttlePerSecond?: number;
  providerOverride?: string;
  abSplit?: { variantBTemplateId: string; bPercent: number };
}

export interface DraftDripEdge {
  /** `${fromNodeId}->${toNodeId}` for stability across reorders. */
  id: string;
  from: string;
  to: string;
  /** For branch nodes the edge carries the truth value of the condition. */
  branchValue?: "true" | "false";
}

export interface DraftDripExitConditions {
  replied?: boolean;
  clicked?: boolean;
  converted?: boolean;
  unsubscribed?: boolean;
  /** Negations are only used by future hand-rolled rules. They make
   *  validation possible without breaking the simple boolean shape. */
  notReplied?: boolean;
  notClicked?: boolean;
  notConverted?: boolean;
}

export interface DraftDrip {
  id?: string;
  name: string;
  enabled: boolean;
  entryTrigger:
    | { kind: "manual" }
    | { kind: "segment_join"; segmentId: string }
    | { kind: "event"; eventKey: string };
  nodes: DraftDripNode[];
  edges: DraftDripEdge[];
  exitConditions?: DraftDripExitConditions;
}

export interface DripValidationResult {
  ok: boolean;
  errors: string[];
}

const CONTRADICTORY_PAIRS: Array<[keyof DraftDripExitConditions, keyof DraftDripExitConditions]> = [
  ["replied", "notReplied"],
  ["clicked", "notClicked"],
  ["converted", "notConverted"],
];

/**
 * Validate a drip definition. Pure — returns errors instead of throwing
 * so callers can render them inline next to the misbehaving nodes.
 */
export function validateDrip(drip: DraftDrip): DripValidationResult {
  const errors: string[] = [];

  if (!drip.name || drip.name.trim().length === 0) {
    errors.push("Drip name is required.");
  }
  if (!Array.isArray(drip.nodes) || drip.nodes.length === 0) {
    errors.push("Drip has no steps — add at least one message or branch.");
    return { ok: false, errors };
  }
  if (!Array.isArray(drip.edges)) {
    errors.push("Drip edges are malformed.");
    return { ok: false, errors };
  }

  // ─── 1. id uniqueness and basic node sanity ───────────────────────────
  const nodeIds = new Set<string>();
  for (const n of drip.nodes) {
    if (!n.id || typeof n.id !== "string") {
      errors.push("A node is missing its id.");
      continue;
    }
    if (nodeIds.has(n.id)) {
      errors.push(`Duplicate node id: ${n.id}.`);
    }
    nodeIds.add(n.id);
  }

  // Every edge must reference real nodes.
  for (const e of drip.edges) {
    if (!nodeIds.has(e.from)) {
      errors.push(`Edge ${e.id} references missing source node ${e.from}.`);
    }
    if (!nodeIds.has(e.to)) {
      errors.push(`Edge ${e.id} references missing target node ${e.to}.`);
    }
  }

  // ─── 2. per-kind constraints ──────────────────────────────────────────
  for (const n of drip.nodes) {
    if (n.kind === "message" && (!n.templateId || n.templateId.trim() === "")) {
      errors.push(`Message step "${n.id}" is missing a templateId.`);
    }
    if (n.kind === "wait") {
      if (n.waitMode === "absolute") {
        if (!n.waitAbsoluteAt) {
          errors.push(`Wait step "${n.id}" is set to absolute but has no waitAbsoluteAt.`);
        }
      } else {
        const ws = n.waitSeconds ?? 0;
        if (!Number.isFinite(ws) || ws < 0) {
          errors.push(`Wait step "${n.id}" has an invalid waitSeconds.`);
        }
      }
    }
    if (n.kind === "branch") {
      if (!n.branchOn) {
        errors.push(`Branch step "${n.id}" is missing branchOn.`);
      }
      // branches with no consequent
      const outgoing = drip.edges.filter((e) => e.from === n.id);
      const hasTrue = outgoing.some((e) => e.branchValue === "true");
      const hasFalse = outgoing.some((e) => e.branchValue === "false");
      if (!hasTrue || !hasFalse) {
        errors.push(`Branch "${n.id}" must have both a true and false outgoing edge.`);
      }
    }
  }

  // ─── 3. orphan detection ──────────────────────────────────────────────
  const incoming = new Map<string, number>();
  const outgoing = new Map<string, number>();
  for (const n of drip.nodes) {
    incoming.set(n.id, 0);
    outgoing.set(n.id, 0);
  }
  for (const e of drip.edges) {
    incoming.set(e.to, (incoming.get(e.to) ?? 0) + 1);
    outgoing.set(e.from, (outgoing.get(e.from) ?? 0) + 1);
  }
  for (const n of drip.nodes) {
    const inCount = incoming.get(n.id) ?? 0;
    const outCount = outgoing.get(n.id) ?? 0;
    if (n.kind === "start") {
      if (inCount > 0) {
        errors.push(`Start node "${n.id}" must not have incoming edges.`);
      }
      continue;
    }
    if (n.kind === "exit") {
      if (outCount > 0) {
        errors.push(`Exit node "${n.id}" must not have outgoing edges.`);
      }
      continue;
    }
    if (inCount === 0 && outCount === 0) {
      errors.push(`Node "${n.id}" is orphaned (no edges).`);
    }
  }

  // Exactly one start node required.
  const starts = drip.nodes.filter((n) => n.kind === "start");
  if (starts.length === 0) {
    errors.push("Drip is missing a start node.");
  } else if (starts.length > 1) {
    errors.push("Drip has more than one start node.");
  }

  // ─── 4. cycle detection (3-colour DFS) ────────────────────────────────
  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const colour = new Map<string, number>();
  for (const n of drip.nodes) colour.set(n.id, WHITE);
  const adj = new Map<string, string[]>();
  for (const n of drip.nodes) adj.set(n.id, []);
  for (const e of drip.edges) {
    const list = adj.get(e.from);
    if (list) list.push(e.to);
  }

  let cycleFound = false;
  function visit(u: string) {
    if (cycleFound) return;
    colour.set(u, GRAY);
    for (const v of adj.get(u) ?? []) {
      const c = colour.get(v) ?? WHITE;
      if (c === GRAY) {
        cycleFound = true;
        errors.push(`Cycle detected involving node "${u}" → "${v}".`);
        return;
      }
      if (c === WHITE) visit(v);
    }
    colour.set(u, BLACK);
  }
  for (const n of drip.nodes) {
    if ((colour.get(n.id) ?? WHITE) === WHITE) visit(n.id);
  }

  // ─── 5. exit-condition contradictions ─────────────────────────────────
  const ec = drip.exitConditions ?? {};
  for (const [a, b] of CONTRADICTORY_PAIRS) {
    if (ec[a] && ec[b]) {
      errors.push(`Contradictory exit conditions: "${a}" and "${b}" cannot both be set.`);
    }
  }

  return { ok: errors.length === 0, errors };
}

/**
 * Convert a `DraftDrip` to the engine-shaped `SabsmsDrip.steps` array.
 * Used by the save action when persisting. Branch + start + exit nodes
 * compile out to a linear `SabsmsDripStep[]` per the current engine
 * contract — the rich draft graph lives on the doc as `nodes`/`edges`
 * but the engine reads `steps` for execution.
 */
export function compileDripToSteps(drip: DraftDrip): Array<{
  templateId: string;
  waitSeconds: number;
  conditions?: Array<{ kind: "replied" | "clicked" | "opened"; within: number }>;
}> {
  const steps: Array<{
    templateId: string;
    waitSeconds: number;
    conditions?: Array<{ kind: "replied" | "clicked" | "opened"; within: number }>;
  }> = [];

  const byId = new Map(drip.nodes.map((n) => [n.id, n]));
  const adj = new Map<string, string[]>();
  for (const n of drip.nodes) adj.set(n.id, []);
  for (const e of drip.edges) {
    const list = adj.get(e.from);
    if (list) list.push(e.to);
  }
  const start = drip.nodes.find((n) => n.kind === "start");
  if (!start) return steps;

  let cursor: string | undefined = (adj.get(start.id) ?? [])[0];
  const seen = new Set<string>();
  let pendingConditions: Array<{ kind: "replied" | "clicked" | "opened"; within: number }> = [];
  let pendingWait = 0;

  while (cursor && !seen.has(cursor)) {
    seen.add(cursor);
    const node = byId.get(cursor);
    if (!node) break;
    if (node.kind === "wait") {
      pendingWait += node.waitSeconds ?? 0;
    } else if (node.kind === "branch" && node.branchOn) {
      pendingConditions.push({
        kind: node.branchOn,
        within: node.branchWithinSeconds ?? 86_400,
      });
    } else if (node.kind === "message" && node.templateId) {
      steps.push({
        templateId: node.templateId,
        waitSeconds: pendingWait,
        conditions: pendingConditions.length > 0 ? pendingConditions : undefined,
      });
      pendingWait = 0;
      pendingConditions = [];
    } else if (node.kind === "exit") {
      break;
    }
    cursor = (adj.get(cursor) ?? [])[0];
  }
  return steps;
}
