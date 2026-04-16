/**
 * SabFlow — Flow diff utility
 *
 * Pure (no I/O) helpers for computing a semantic diff between two SabFlowDoc
 * snapshots.  Produces a structured `FlowDiff` with added / removed / modified
 * lists across every top-level domain (groups, edges, events, variables,
 * settings, theme).
 *
 * The diff is designed to be rendered as a side-by-side UI — each entry
 * carries enough context to show a human-readable summary without having to
 * re-compare the raw snapshots.
 */

import type {
  SabFlowDoc,
  Group,
  Edge,
  SabFlowEvent,
  Variable,
  FlowSettings,
  SabFlowTheme,
  Block,
  Coordinates,
} from './types';

/* ── Types ──────────────────────────────────────────────────────────────── */

/** A single group that exists in both snapshots but changed between them. */
export interface ModifiedGroup {
  before: Group;
  after: Group;
  /** Human-readable summary of what changed (e.g. "title changed", "3 blocks added"). */
  changes: string[];
}

/** A single variable that exists in both snapshots but changed between them. */
export interface ModifiedVariable {
  before: Variable;
  after: Variable;
  /** Human-readable summary of what changed. */
  changes: string[];
}

/** A single event that exists in both snapshots but changed between them. */
export interface ModifiedEvent {
  before: SabFlowEvent;
  after: SabFlowEvent;
  /** Human-readable summary of what changed. */
  changes: string[];
}

export interface FlowDiff {
  groups: {
    added: Group[];
    removed: Group[];
    modified: ModifiedGroup[];
  };
  edges: {
    added: Edge[];
    removed: Edge[];
  };
  events: {
    added: SabFlowEvent[];
    removed: SabFlowEvent[];
    modified: ModifiedEvent[];
  };
  variables: {
    added: Variable[];
    removed: Variable[];
    modified: ModifiedVariable[];
  };
  /** Top-level settings keys whose values changed. */
  settings: string[];
  /** Top-level theme keys whose values changed. */
  theme: string[];
}

/* ── Helpers ────────────────────────────────────────────────────────────── */

/** Stable deep equality via JSON serialisation — good enough for POJO diff. */
function deepEqual<T>(a: T, b: T): boolean {
  if (a === b) return true;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

function coordsEqual(a: Coordinates, b: Coordinates): boolean {
  return a.x === b.x && a.y === b.y;
}

/** Build an id→item map for O(n) lookups during diff. */
function indexById<T extends { id: string }>(items: readonly T[]): Map<string, T> {
  const map = new Map<string, T>();
  for (const item of items) map.set(item.id, item);
  return map;
}

/* ── Block-level diff (for group "modified" summaries) ──────────────────── */

interface BlockDelta {
  addedCount: number;
  removedCount: number;
  modifiedCount: number;
}

function diffBlocks(before: readonly Block[], after: readonly Block[]): BlockDelta {
  const beforeMap = indexById(before);
  const afterMap = indexById(after);

  let addedCount = 0;
  let removedCount = 0;
  let modifiedCount = 0;

  for (const [id, block] of afterMap) {
    const prior = beforeMap.get(id);
    if (!prior) {
      addedCount += 1;
    } else if (!deepEqual(prior, block)) {
      modifiedCount += 1;
    }
  }
  for (const id of beforeMap.keys()) {
    if (!afterMap.has(id)) removedCount += 1;
  }

  return { addedCount, removedCount, modifiedCount };
}

/* ── Domain diff helpers ────────────────────────────────────────────────── */

function summariseGroupChanges(before: Group, after: Group): string[] {
  const changes: string[] = [];

  if (before.title !== after.title) {
    changes.push(`Renamed "${before.title}" → "${after.title}"`);
  }

  if (!coordsEqual(before.graphCoordinates, after.graphCoordinates)) {
    const dx = after.graphCoordinates.x - before.graphCoordinates.x;
    const dy = after.graphCoordinates.y - before.graphCoordinates.y;
    changes.push(`Position moved (${formatDelta(dx)}, ${formatDelta(dy)})`);
  }

  const blockDelta = diffBlocks(before.blocks ?? [], after.blocks ?? []);
  if (blockDelta.addedCount > 0) {
    changes.push(`${blockDelta.addedCount} block${blockDelta.addedCount === 1 ? '' : 's'} added`);
  }
  if (blockDelta.removedCount > 0) {
    changes.push(`${blockDelta.removedCount} block${blockDelta.removedCount === 1 ? '' : 's'} removed`);
  }
  if (blockDelta.modifiedCount > 0) {
    changes.push(`${blockDelta.modifiedCount} block${blockDelta.modifiedCount === 1 ? '' : 's'} modified`);
  }

  return changes;
}

function formatDelta(n: number): string {
  const sign = n > 0 ? '+' : '';
  return `${sign}${Math.round(n)}`;
}

function summariseVariableChanges(before: Variable, after: Variable): string[] {
  const changes: string[] = [];
  if (before.name !== after.name) changes.push(`Renamed "${before.name}" → "${after.name}"`);
  if (!deepEqual(before.value, after.value)) changes.push('Default value changed');
  if (before.isSessionVariable !== after.isSessionVariable) {
    changes.push(after.isSessionVariable ? 'Marked as session variable' : 'Unmarked as session variable');
  }
  if (before.isHidden !== after.isHidden) {
    changes.push(after.isHidden ? 'Hidden from results' : 'Shown in results');
  }
  return changes;
}

function summariseEventChanges(before: SabFlowEvent, after: SabFlowEvent): string[] {
  const changes: string[] = [];
  if (before.type !== after.type) changes.push(`Type: ${before.type} → ${after.type}`);
  if (!coordsEqual(before.graphCoordinates, after.graphCoordinates)) {
    const dx = after.graphCoordinates.x - before.graphCoordinates.x;
    const dy = after.graphCoordinates.y - before.graphCoordinates.y;
    changes.push(`Position moved (${formatDelta(dx)}, ${formatDelta(dy)})`);
  }
  if ((before.outgoingEdgeId ?? null) !== (after.outgoingEdgeId ?? null)) {
    changes.push('Outgoing edge changed');
  }
  return changes;
}

/* ── Top-level key-set diff (settings, theme) ───────────────────────────── */

function changedTopLevelKeys<T extends Record<string, unknown>>(
  before: T | undefined,
  after: T | undefined,
): string[] {
  const b = (before ?? {}) as Record<string, unknown>;
  const a = (after ?? {}) as Record<string, unknown>;
  const keys = new Set<string>([...Object.keys(b), ...Object.keys(a)]);
  const changed: string[] = [];
  for (const k of keys) {
    if (!deepEqual(b[k], a[k])) changed.push(k);
  }
  return changed.sort();
}

/* ── Main diff entrypoint ───────────────────────────────────────────────── */

/**
 * Compute a structured diff between two SabFlowDoc snapshots.
 * Safe with missing / empty arrays — treats them as `[]`.
 */
export function computeFlowDiff(before: SabFlowDoc, after: SabFlowDoc): FlowDiff {
  /* Groups ─────────────────────────────────────────────── */
  const beforeGroups = indexById(before.groups ?? []);
  const afterGroups = indexById(after.groups ?? []);

  const addedGroups: Group[] = [];
  const removedGroups: Group[] = [];
  const modifiedGroups: ModifiedGroup[] = [];

  for (const [id, afterGroup] of afterGroups) {
    const beforeGroup = beforeGroups.get(id);
    if (!beforeGroup) {
      addedGroups.push(afterGroup);
    } else if (!deepEqual(beforeGroup, afterGroup)) {
      const changes = summariseGroupChanges(beforeGroup, afterGroup);
      // Fallback when deep-not-equal but no surface-level summary fires
      if (changes.length === 0) changes.push('Block contents changed');
      modifiedGroups.push({ before: beforeGroup, after: afterGroup, changes });
    }
  }
  for (const [id, beforeGroup] of beforeGroups) {
    if (!afterGroups.has(id)) removedGroups.push(beforeGroup);
  }

  /* Edges ──────────────────────────────────────────────── */
  const beforeEdges = indexById(before.edges ?? []);
  const afterEdges = indexById(after.edges ?? []);

  const addedEdges: Edge[] = [];
  const removedEdges: Edge[] = [];

  for (const [id, edge] of afterEdges) {
    if (!beforeEdges.has(id)) addedEdges.push(edge);
  }
  for (const [id, edge] of beforeEdges) {
    if (!afterEdges.has(id)) removedEdges.push(edge);
  }

  /* Events ─────────────────────────────────────────────── */
  const beforeEvents = indexById(before.events ?? []);
  const afterEvents = indexById(after.events ?? []);

  const addedEvents: SabFlowEvent[] = [];
  const removedEvents: SabFlowEvent[] = [];
  const modifiedEvents: ModifiedEvent[] = [];

  for (const [id, afterEv] of afterEvents) {
    const beforeEv = beforeEvents.get(id);
    if (!beforeEv) {
      addedEvents.push(afterEv);
    } else if (!deepEqual(beforeEv, afterEv)) {
      const changes = summariseEventChanges(beforeEv, afterEv);
      if (changes.length === 0) changes.push('Event configuration changed');
      modifiedEvents.push({ before: beforeEv, after: afterEv, changes });
    }
  }
  for (const [id, beforeEv] of beforeEvents) {
    if (!afterEvents.has(id)) removedEvents.push(beforeEv);
  }

  /* Variables ──────────────────────────────────────────── */
  const beforeVars = indexById(before.variables ?? []);
  const afterVars = indexById(after.variables ?? []);

  const addedVars: Variable[] = [];
  const removedVars: Variable[] = [];
  const modifiedVars: ModifiedVariable[] = [];

  for (const [id, afterVar] of afterVars) {
    const beforeVar = beforeVars.get(id);
    if (!beforeVar) {
      addedVars.push(afterVar);
    } else if (!deepEqual(beforeVar, afterVar)) {
      const changes = summariseVariableChanges(beforeVar, afterVar);
      if (changes.length === 0) changes.push('Variable configuration changed');
      modifiedVars.push({ before: beforeVar, after: afterVar, changes });
    }
  }
  for (const [id, beforeVar] of beforeVars) {
    if (!afterVars.has(id)) removedVars.push(beforeVar);
  }

  /* Settings + theme ───────────────────────────────────── */
  const settingsChanges = changedTopLevelKeys<FlowSettings>(before.settings, after.settings);
  const themeChanges = changedTopLevelKeys<SabFlowTheme>(before.theme, after.theme);

  return {
    groups: { added: addedGroups, removed: removedGroups, modified: modifiedGroups },
    edges: { added: addedEdges, removed: removedEdges },
    events: { added: addedEvents, removed: removedEvents, modified: modifiedEvents },
    variables: { added: addedVars, removed: removedVars, modified: modifiedVars },
    settings: settingsChanges,
    theme: themeChanges,
  };
}

/* ── Convenience helpers ────────────────────────────────────────────────── */

/**
 * Returns `true` when two snapshots are structurally identical across every
 * domain the diff tracks.
 */
export function isFlowDiffEmpty(diff: FlowDiff): boolean {
  return (
    diff.groups.added.length === 0 &&
    diff.groups.removed.length === 0 &&
    diff.groups.modified.length === 0 &&
    diff.edges.added.length === 0 &&
    diff.edges.removed.length === 0 &&
    diff.events.added.length === 0 &&
    diff.events.removed.length === 0 &&
    diff.events.modified.length === 0 &&
    diff.variables.added.length === 0 &&
    diff.variables.removed.length === 0 &&
    diff.variables.modified.length === 0 &&
    diff.settings.length === 0 &&
    diff.theme.length === 0
  );
}

/** Flat change count across every tracked domain. */
export function getFlowDiffTotalChanges(diff: FlowDiff): number {
  return (
    diff.groups.added.length +
    diff.groups.removed.length +
    diff.groups.modified.length +
    diff.edges.added.length +
    diff.edges.removed.length +
    diff.events.added.length +
    diff.events.removed.length +
    diff.events.modified.length +
    diff.variables.added.length +
    diff.variables.removed.length +
    diff.variables.modified.length +
    diff.settings.length +
    diff.theme.length
  );
}
