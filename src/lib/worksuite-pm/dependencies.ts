/**
 * Task-dependency (blocker) graph utilities.
 *
 *   - `buildBlockerGraph(deps)` — adjacency map from blocker -> blocked.
 *   - `findCycles(deps)` — returns each cycle as an ordered list of ids.
 *   - `wouldCreateCycle(deps, fromId, toId)` — guard before insert.
 *   - `topoOrder(deps, taskIds)` — execution order respecting blockers.
 */
import type { Dependency, ID } from './types';

export type BlockerGraph = Map<ID, Set<ID>>;

export function buildBlockerGraph(deps: Dependency[]): BlockerGraph {
  const g: BlockerGraph = new Map();
  for (const d of deps) {
    const set = g.get(d.fromTaskId) ?? new Set<ID>();
    set.add(d.toTaskId);
    g.set(d.fromTaskId, set);
    if (!g.has(d.toTaskId)) g.set(d.toTaskId, new Set());
  }
  return g;
}

/** Tarjan-style SCC scan, returning every component with size >= 2. */
export function findCycles(deps: Dependency[]): ID[][] {
  const g = buildBlockerGraph(deps);
  const ids = [...g.keys()];

  let index = 0;
  const indices = new Map<ID, number>();
  const lowlink = new Map<ID, number>();
  const onStack = new Set<ID>();
  const stack: ID[] = [];
  const out: ID[][] = [];

  const strongconnect = (v: ID): void => {
    indices.set(v, index);
    lowlink.set(v, index);
    index++;
    stack.push(v);
    onStack.add(v);
    for (const w of g.get(v) ?? []) {
      if (!indices.has(w)) {
        strongconnect(w);
        lowlink.set(v, Math.min(lowlink.get(v) ?? 0, lowlink.get(w) ?? 0));
      } else if (onStack.has(w)) {
        lowlink.set(v, Math.min(lowlink.get(v) ?? 0, indices.get(w) ?? 0));
      }
    }
    if (lowlink.get(v) === indices.get(v)) {
      const scc: ID[] = [];
      let w: ID;
      do {
        w = stack.pop() as ID;
        onStack.delete(w);
        scc.push(w);
      } while (w !== v);
      if (scc.length > 1) out.push(scc.reverse());
      else if (scc.length === 1 && (g.get(scc[0])?.has(scc[0]) ?? false)) {
        out.push(scc); // self-loop
      }
    }
  };

  for (const v of ids) if (!indices.has(v)) strongconnect(v);
  return out;
}

export function hasCycle(deps: Dependency[]): boolean {
  return findCycles(deps).length > 0;
}

/** Pre-flight guard for adding a dependency edge. */
export function wouldCreateCycle(
  deps: Dependency[],
  fromTaskId: ID,
  toTaskId: ID,
): boolean {
  if (fromTaskId === toTaskId) return true;
  const g = buildBlockerGraph(deps);
  // BFS from `toTaskId` — if we can reach `fromTaskId`, adding the
  // edge would close a cycle.
  const visited = new Set<ID>();
  const q: ID[] = [toTaskId];
  while (q.length) {
    const cur = q.shift() as ID;
    if (cur === fromTaskId) return true;
    if (visited.has(cur)) continue;
    visited.add(cur);
    for (const next of g.get(cur) ?? []) q.push(next);
  }
  return false;
}

/**
 * Topological order of `taskIds` honoring `deps`. Tasks not appearing
 * in any dep are appended at the end in original order. Throws if a
 * cycle is found.
 */
export function topoOrder(deps: Dependency[], taskIds: ID[]): ID[] {
  const g = buildBlockerGraph(deps);
  const idSet = new Set(taskIds);
  const indeg = new Map<ID, number>(taskIds.map((id) => [id, 0]));
  for (const [from, tos] of g) {
    if (!idSet.has(from)) continue;
    for (const to of tos) {
      if (!idSet.has(to)) continue;
      indeg.set(to, (indeg.get(to) ?? 0) + 1);
    }
  }
  const ready: ID[] = [];
  for (const id of taskIds) if ((indeg.get(id) ?? 0) === 0) ready.push(id);
  const out: ID[] = [];
  while (ready.length) {
    const id = ready.shift() as ID;
    out.push(id);
    for (const next of g.get(id) ?? []) {
      if (!idSet.has(next)) continue;
      const left = (indeg.get(next) ?? 0) - 1;
      indeg.set(next, left);
      if (left === 0) ready.push(next);
    }
  }
  if (out.length !== taskIds.length) {
    throw new Error('topoOrder: cycle detected in dependency graph');
  }
  return out;
}
