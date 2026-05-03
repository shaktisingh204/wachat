/**
 * Critical-path engine for Gantt charts.
 *
 * Algorithm: classical CPM (Critical Path Method).
 *   1. Topological sort of the dependency DAG.
 *   2. Forward pass to compute Earliest Start (ES) and Earliest Finish
 *      (EF) for every task.
 *   3. Backward pass to compute Latest Start (LS) and Latest Finish
 *      (LF) using project finish = max(EF).
 *   4. Slack (total float) = LS - ES = LF - EF. Tasks with slack 0 are
 *      on the critical path.
 *
 * All durations are in *days* (use 0 for milestones). Lag/lead is not
 * modeled here — encode it via item duration if needed.
 */
import type { GanttItem, ID } from './types';

export interface CpmNode {
  id: ID;
  durationDays: number;
  earliestStart: number;
  earliestFinish: number;
  latestStart: number;
  latestFinish: number;
  /** Total float — same as `latestStart - earliestStart`. */
  slack: number;
  critical: boolean;
}

export interface CpmResult {
  /** Ordered list of node ids on the critical path (one of possibly many). */
  criticalPath: ID[];
  nodes: Map<ID, CpmNode>;
  /** Earliest possible project completion (days). */
  projectDuration: number;
}

export class CycleError extends Error {
  constructor(public cycle: ID[]) {
    super(`Dependency cycle detected: ${cycle.join(' -> ')}`);
    this.name = 'CycleError';
  }
}

/** Kahn-style topological sort. Throws `CycleError` if not a DAG. */
export function topoSort(items: GanttItem[]): ID[] {
  const indeg = new Map<ID, number>();
  const byId = new Map<ID, GanttItem>();
  for (const it of items) {
    byId.set(it.id, it);
    indeg.set(it.id, 0);
  }
  for (const it of items) {
    for (const dep of it.dependsOn) {
      if (!byId.has(dep)) {
        throw new Error(`Item ${it.id} depends on unknown item ${dep}`);
      }
      indeg.set(it.id, (indeg.get(it.id) ?? 0) + 1);
    }
  }
  const queue: ID[] = [];
  for (const [id, n] of indeg) if (n === 0) queue.push(id);
  const out: ID[] = [];
  while (queue.length) {
    const id = queue.shift() as ID;
    out.push(id);
    for (const it of items) {
      if (it.dependsOn.includes(id)) {
        const next = (indeg.get(it.id) ?? 0) - 1;
        indeg.set(it.id, next);
        if (next === 0) queue.push(it.id);
      }
    }
  }
  if (out.length !== items.length) {
    const remaining = items
      .map((i) => i.id)
      .filter((id) => !out.includes(id));
    throw new CycleError(remaining);
  }
  return out;
}

/** Run the full CPM forward + backward pass. */
export function runCpm(items: GanttItem[]): CpmResult {
  const order = topoSort(items);
  const byId = new Map<ID, GanttItem>(items.map((i) => [i.id, i]));
  const nodes = new Map<ID, CpmNode>();

  // Forward pass — Earliest Start / Finish.
  for (const id of order) {
    const it = byId.get(id) as GanttItem;
    const predES = it.dependsOn.map((d) => {
      const n = nodes.get(d);
      if (!n) throw new Error(`Predecessor ${d} not yet computed`);
      return n.earliestFinish;
    });
    const es = Math.max(
      it.earliestStart ?? 0,
      ...(predES.length ? predES : [0]),
    );
    const ef = es + it.durationDays;
    nodes.set(id, {
      id,
      durationDays: it.durationDays,
      earliestStart: es,
      earliestFinish: ef,
      latestStart: 0,
      latestFinish: 0,
      slack: 0,
      critical: false,
    });
  }

  const projectDuration = [...nodes.values()].reduce(
    (m, n) => Math.max(m, n.earliestFinish),
    0,
  );

  // Backward pass — Latest Start / Finish.
  for (let i = order.length - 1; i >= 0; i--) {
    const id = order[i];
    const it = byId.get(id) as GanttItem;
    const node = nodes.get(id) as CpmNode;
    const succLS: number[] = [];
    for (const other of items) {
      if (other.dependsOn.includes(id)) {
        const succ = nodes.get(other.id);
        if (succ) succLS.push(succ.latestStart);
      }
    }
    const lf = succLS.length ? Math.min(...succLS) : projectDuration;
    const ls = lf - it.durationDays;
    node.latestFinish = lf;
    node.latestStart = ls;
    node.slack = ls - node.earliestStart;
    node.critical = Math.abs(node.slack) < 1e-9;
  }

  // Build one concrete critical path by walking critical predecessors
  // back from the latest-finishing critical node.
  const criticals = [...nodes.values()].filter((n) => n.critical);
  const path: ID[] = [];
  if (criticals.length) {
    const end = criticals.reduce((best, n) =>
      n.earliestFinish > best.earliestFinish ? n : best,
    );
    const visited = new Set<ID>();
    let cur: CpmNode | undefined = end;
    while (cur && !visited.has(cur.id)) {
      visited.add(cur.id);
      path.unshift(cur.id);
      const it = byId.get(cur.id) as GanttItem;
      const curES: number = cur.earliestStart;
      const next: CpmNode | undefined = it.dependsOn
        .map((d) => nodes.get(d))
        .filter((n): n is CpmNode => !!n && n.critical)
        .find((n) => Math.abs(n.earliestFinish - curES) < 1e-9);
      cur = next;
    }
  }

  return { criticalPath: path, nodes, projectDuration };
}

/**
 * Convenience entry point — returns the ordered list of node ids that
 * sit on (one) critical path. Matches the spec signature.
 */
export function computeCriticalPath(items: GanttItem[]): ID[] {
  return runCpm(items).criticalPath;
}

/** Per-task slack/float lookup (in days). */
export function computeSlack(items: GanttItem[]): Map<ID, number> {
  const { nodes } = runCpm(items);
  const out = new Map<ID, number>();
  for (const [id, n] of nodes) out.set(id, n.slack);
  return out;
}
