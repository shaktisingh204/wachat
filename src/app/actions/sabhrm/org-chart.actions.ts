'use server';

import type { Db } from 'mongodb';

import { gate } from '@/lib/sabhrm/gate';
import { SABHRM_COLLECTIONS } from '@/lib/sabhrm/collections';
import type { ActionResult } from '@/lib/sabhrm/types';

/* ── serializable tree node (local — not in shared types) ────────────── */

export interface OrgNode {
  id: string;
  name: string;
  title: string | null;
  children: OrgNode[];
}

/* ── doc shape (server-internal projection) ──────────────────────────── */

interface EmployeeNodeDoc {
  _id: unknown;
  displayName?: string;
  firstName?: string;
  lastName?: string;
  designationName?: string;
  reportingManagerId?: string;
}

function nodeName(d: EmployeeNodeDoc): string {
  const display = (d.displayName ?? '').trim();
  if (display) return display;
  const composed = `${d.firstName ?? ''} ${d.lastName ?? ''}`.trim();
  return composed || 'Unnamed';
}

/* ── build the forest from employees ─────────────────────────────────── */

async function buildForest(db: Db, workspaceId: string): Promise<OrgNode[]> {
  const docs = (await db
    .collection(SABHRM_COLLECTIONS.employees)
    .find(
      { workspaceId },
      {
        projection: {
          displayName: 1,
          firstName: 1,
          lastName: 1,
          designationName: 1,
          reportingManagerId: 1,
        },
      },
    )
    .limit(5000)
    .toArray()) as EmployeeNodeDoc[];

  // Materialize every employee as a node, keyed by id.
  const byId = new Map<string, OrgNode>();
  const managerOf = new Map<string, string | null>();
  for (const d of docs) {
    const id = String(d._id);
    byId.set(id, {
      id,
      name: nodeName(d),
      title: (d.designationName ?? '').trim() || null,
      children: [],
    });
    const mgr = (d.reportingManagerId ?? '').trim();
    managerOf.set(id, mgr || null);
  }

  // Wire children to parents; roots = no manager OR manager not in the set.
  const roots: OrgNode[] = [];
  for (const [id, node] of byId) {
    const managerId = managerOf.get(id) ?? null;
    if (managerId && byId.has(managerId)) {
      byId.get(managerId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  // Stable, readable ordering at every level (alphabetical by name).
  const sortRec = (nodes: OrgNode[]) => {
    nodes.sort((a, b) => a.name.localeCompare(b.name));
    for (const n of nodes) sortRec(n.children);
  };
  sortRec(roots);

  return roots;
}

/* ── action ──────────────────────────────────────────────────────────── */

export async function getOrgTree(): Promise<ActionResult<OrgNode[]>> {
  const g = await gate();
  if (!g.ok) return { ok: false, error: g.error };
  const { db, workspaceId } = g.ctx;
  try {
    const roots = await buildForest(db, workspaceId);
    return { ok: true, data: roots };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to build org chart.' };
  }
}
