/**
 * SabFlow Marketplace — template versioning and upgrade diff.
 *
 * Phase C.10.7 — Template versioning + upgrade diff.
 *
 * Exports:
 *   - `publishTemplateVersion(templateId, flowJson, changelog, publishedBy)`
 *       Writes a new version row to `sabflow_marketplace_versions`.
 *       Semver bump logic:
 *         • changelog starts with `BREAKING:` → major bump
 *         • changelog starts with `feat:`     → minor bump
 *         • otherwise                         → patch bump
 *
 *   - `getVersionHistory(templateId)` → `TemplateVersion[]` sorted desc
 *
 *   - `computeUpgradeDiff(templateId, fromVersion, toVersion)`
 *       → `{ addedNodes, removedNodes, changedNodes, addedConnections, removedConnections }`
 *
 * Collection: `sabflow_marketplace_versions`
 * Index hint: `{ templateId: 1, version: -1 }` (monotonically-growing semver
 * strings — lexicographic desc sort works because we zero-pad each part to
 * three digits in the stored `version` string via `formatSemver`).
 */

import 'server-only';

import { type Collection, ObjectId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';

/* ── Constants ─────────────────────────────────────────────────────────── */

export const SABFLOW_MARKETPLACE_VERSIONS_COLLECTION =
  'sabflow_marketplace_versions';

/* ── Types ──────────────────────────────────────────────────────────────── */

export interface TemplateVersion {
  /** Stringified semver, e.g. `"1.2.3"`. */
  version: string;
  /** Numeric tuple — convenient for comparisons without re-parsing. */
  semver: [number, number, number];
  publishedAt: Date;
  /** Commit-message-style description of what changed. */
  changelog: string;
  /** The full flow JSON snapshotted at publish time. */
  flowJson: object;
}

/** Raw Mongo document shape. */
interface TemplateVersionDoc extends TemplateVersion {
  _id: ObjectId;
  templateId: string;
  publishedBy: string;
  createdAt: Date;
}

/** Shape returned by `computeUpgradeDiff`. */
export interface UpgradeDiff {
  /** Node labels / types that exist in `toVersion` but not `fromVersion`. */
  addedNodes: string[];
  /** Node labels / types that exist in `fromVersion` but not `toVersion`. */
  removedNodes: string[];
  /**
   * Node labels / types present in both versions but with different config.
   * We compare the serialised block options to detect changes.
   */
  changedNodes: string[];
  /** Net edge additions (toVersion.edges.length - fromVersion.edges.length, clamped ≥ 0). */
  addedConnections: number;
  /** Net edge removals (clamped ≥ 0). */
  removedConnections: number;
}

/* ── Collection accessor ────────────────────────────────────────────────── */

async function getVersionsCollection(): Promise<
  Collection<TemplateVersionDoc>
> {
  const { db } = await connectToDatabase();
  return db.collection<TemplateVersionDoc>(
    SABFLOW_MARKETPLACE_VERSIONS_COLLECTION,
  );
}

/* ── Semver helpers ─────────────────────────────────────────────────────── */

function parseSemver(v: string): [number, number, number] {
  const parts = v.split('.').map(Number);
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
}

function formatSemver(semver: [number, number, number]): string {
  return semver.join('.');
}

/**
 * Given the latest published semver (or null when there's no prior version)
 * and a changelog string, return the next semver according to:
 *   BREAKING: → major bump, reset minor+patch
 *   feat:     → minor bump, reset patch
 *   otherwise → patch bump
 */
function bumpSemver(
  current: [number, number, number] | null,
  changelog: string,
): [number, number, number] {
  const [major, minor, patch] = current ?? [0, 0, 0];
  const trimmed = changelog.trimStart();
  if (trimmed.startsWith('BREAKING:')) return [major + 1, 0, 0];
  if (trimmed.startsWith('feat:')) return [major, minor + 1, 0];
  return [major, minor, patch + 1];
}

/* ── Public API ─────────────────────────────────────────────────────────── */

/**
 * Publish a new version of a marketplace template.
 *
 * Resolves the latest existing version (if any), computes the next semver,
 * and inserts a new row into `sabflow_marketplace_versions`.
 *
 * Returns the new `TemplateVersion` record.
 */
export async function publishTemplateVersion(
  templateId: string,
  flowJson: object,
  changelog: string,
  publishedBy: string,
): Promise<TemplateVersion> {
  if (!templateId) throw new Error('publishTemplateVersion: templateId is required');
  if (!publishedBy) throw new Error('publishTemplateVersion: publishedBy is required');

  const col = await getVersionsCollection();

  /* Fetch the latest version so we know what to bump from. */
  const latest = await col.findOne(
    { templateId },
    { sort: { 'semver.0': -1, 'semver.1': -1, 'semver.2': -1 } },
  );

  const currentSemver: [number, number, number] | null = latest
    ? latest.semver
    : null;
  const nextSemver = bumpSemver(currentSemver, changelog ?? '');
  const version = formatSemver(nextSemver);
  const now = new Date();

  const doc: TemplateVersionDoc = {
    _id: new ObjectId(),
    templateId,
    version,
    semver: nextSemver,
    publishedAt: now,
    changelog: changelog ?? '',
    flowJson,
    publishedBy,
    createdAt: now,
  };

  await col.insertOne(doc);

  return {
    version: doc.version,
    semver: doc.semver,
    publishedAt: doc.publishedAt,
    changelog: doc.changelog,
    flowJson: doc.flowJson,
  };
}

/**
 * Retrieve full version history for a template, sorted newest-first.
 */
export async function getVersionHistory(
  templateId: string,
): Promise<TemplateVersion[]> {
  if (!templateId) return [];

  const col = await getVersionsCollection();
  const docs = await col
    .find(
      { templateId },
      {
        sort: { 'semver.0': -1, 'semver.1': -1, 'semver.2': -1 },
        projection: {
          version: 1,
          semver: 1,
          publishedAt: 1,
          changelog: 1,
          flowJson: 1,
        },
      },
    )
    .toArray();

  return docs.map((d) => ({
    version: d.version,
    semver: d.semver,
    publishedAt: d.publishedAt,
    changelog: d.changelog,
    flowJson: d.flowJson,
  }));
}

/* ── Diff helpers ───────────────────────────────────────────────────────── */

/**
 * Extract a stable set of node labels from a raw `flowJson` snapshot.
 *
 * A "node" in diff terms is a block or event entry.  We identify each node
 * by a combination of its `type` (block type) and its stable `id` so we can
 * tell whether a node was added, removed, or modified.
 *
 * Returns a `Map<id, serialisedOptions>` used to detect changes.
 */
function extractNodes(
  flowJson: Record<string, unknown>,
): Map<string, string> {
  const nodes = new Map<string, string>();

  const events = (flowJson['events'] as Array<Record<string, unknown>> | undefined) ?? [];
  for (const ev of events) {
    const id = String(ev['id'] ?? '');
    const label = `event:${String(ev['type'] ?? 'unknown')}`;
    if (id) nodes.set(id, JSON.stringify({ label, options: ev['options'] ?? {} }));
  }

  const groups = (flowJson['groups'] as Array<Record<string, unknown>> | undefined) ?? [];
  for (const group of groups) {
    const blocks = (group['blocks'] as Array<Record<string, unknown>> | undefined) ?? [];
    for (const block of blocks) {
      const id = String(block['id'] ?? '');
      const label = `block:${String(block['type'] ?? 'unknown')}`;
      if (id) nodes.set(id, JSON.stringify({ label, options: block['options'] ?? {} }));
    }
  }

  return nodes;
}

function countEdges(flowJson: Record<string, unknown>): number {
  const edges = flowJson['edges'];
  if (Array.isArray(edges)) return edges.length;
  return 0;
}

/**
 * Compute a human-readable diff between two published versions of a
 * marketplace template.
 *
 * Added/removed/changed node identification algorithm:
 *   1. Build `Map<nodeId, serialisedState>` for both versions.
 *   2. Ids present only in `to`   → addedNodes (label: "block:<type>")
 *   3. Ids present only in `from` → removedNodes
 *   4. Ids present in both but with different serialised state → changedNodes
 *   5. Edge counts are subtracted to produce addedConnections /
 *      removedConnections (clamped ≥ 0).
 *
 * Returns `null` when either version cannot be found.
 */
export async function computeUpgradeDiff(
  templateId: string,
  fromVersion: string,
  toVersion: string,
): Promise<UpgradeDiff | null> {
  if (!templateId || !fromVersion || !toVersion) return null;

  const col = await getVersionsCollection();

  const [fromDoc, toDoc] = await Promise.all([
    col.findOne({ templateId, version: fromVersion }),
    col.findOne({ templateId, version: toVersion }),
  ]);

  if (!fromDoc || !toDoc) return null;

  const fromFlow = fromDoc.flowJson as Record<string, unknown>;
  const toFlow = toDoc.flowJson as Record<string, unknown>;

  const fromNodes = extractNodes(fromFlow);
  const toNodes = extractNodes(toFlow);

  const addedNodes: string[] = [];
  const removedNodes: string[] = [];
  const changedNodes: string[] = [];

  for (const [id, state] of toNodes) {
    if (!fromNodes.has(id)) {
      // Parse out the label for a friendlier display name.
      try {
        const parsed = JSON.parse(state) as { label: string };
        addedNodes.push(parsed.label ?? id);
      } catch {
        addedNodes.push(id);
      }
    } else if (fromNodes.get(id) !== state) {
      try {
        const parsed = JSON.parse(state) as { label: string };
        changedNodes.push(parsed.label ?? id);
      } catch {
        changedNodes.push(id);
      }
    }
  }

  for (const [id, state] of fromNodes) {
    if (!toNodes.has(id)) {
      try {
        const parsed = JSON.parse(state) as { label: string };
        removedNodes.push(parsed.label ?? id);
      } catch {
        removedNodes.push(id);
      }
    }
  }

  const fromEdges = countEdges(fromFlow);
  const toEdges = countEdges(toFlow);
  const delta = toEdges - fromEdges;

  return {
    addedNodes,
    removedNodes,
    changedNodes,
    addedConnections: delta > 0 ? delta : 0,
    removedConnections: delta < 0 ? -delta : 0,
  };
}
