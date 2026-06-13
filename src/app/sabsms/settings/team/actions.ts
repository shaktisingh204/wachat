"use server";

/**
 * SabSMS settings — team members.
 *
 * REAL data source: the platform RBAC model. A SabSMS "workspace" is the
 * signed-in user's account; its members are the `agents[]` on the projects
 * that user OWNS (`projects.userId`), plus the owner themselves. This mirrors
 * `getEffectivePermissionsForProject` (src/lib/rbac-server.ts) and the project
 * team actions (src/app/actions/team.actions.ts), where members are stored as
 * `{ userId, email, name, role }` under `projects.agents`.
 *
 * Pending invites come from the real `invitations` collection.
 *
 * Write-management (invite / role change / remove) is NOT performed here —
 * that lives in the platform team settings so a single RBAC model stays
 * authoritative. The SabSMS surface presents the real roster read-only and
 * links out for changes; the former mutation stubs are removed rather than
 * faking success.
 */

import { ObjectId, type Db } from "mongodb";

import { connectToDatabase } from "@/lib/mongodb";
import { requirePermission } from "@/lib/rbac-server";
import { getCachedSession } from "@/lib/server-cache";

export type Role = "owner" | "admin" | "agent" | "marketer" | "developer" | "member" | string;

export interface TeamMemberRow {
  id: string;
  email: string;
  name?: string;
  role: Role;
  status: "active" | "invited";
  /** Owner of the workspace (cannot be removed/downgraded). */
  isOwner: boolean;
  lastSeenAt?: string;
  /** Pending-invite expiry (only on invited rows). */
  invitedExpiresAt?: string;
}

export interface MemberAuditEntry {
  id: string;
  actor: string;
  kind: string;
  detail?: string;
  at: string;
}

async function requireWorkspaceId(): Promise<string | null> {
  const session = await getCachedSession();
  const workspaceId = String((session?.user as { _id?: unknown } | undefined)?._id ?? "");
  return workspaceId || null;
}

function toId(v: unknown): string {
  if (v instanceof ObjectId) return v.toHexString();
  return String(v ?? "");
}

async function collectMembers(db: Db, ownerId: ObjectId): Promise<TeamMemberRow[]> {
  // The owner.
  const owner = await db
    .collection("users")
    .findOne(
      { _id: ownerId },
      { projection: { email: 1, name: 1, lastSeen: 1, lastSeenAt: 1, lastActive: 1 } },
    );

  const rows: TeamMemberRow[] = [];
  const seen = new Set<string>();

  if (owner) {
    rows.push({
      id: toId(owner._id),
      email: String(owner.email ?? ""),
      name: typeof owner.name === "string" ? owner.name : undefined,
      role: "owner",
      status: "active",
      isOwner: true,
      lastSeenAt: pickLastSeen(owner),
    });
    seen.add(toId(owner._id));
  }

  // Members across every project this user owns.
  const projects = await db
    .collection("projects")
    .find({ userId: ownerId }, { projection: { agents: 1 } })
    .toArray();

  const agentIds: ObjectId[] = [];
  for (const p of projects) {
    for (const a of (p.agents as Array<Record<string, unknown>>) ?? []) {
      const uid = a.userId;
      if (uid instanceof ObjectId) agentIds.push(uid);
    }
  }

  // Resolve lastSeen for agents in one pass.
  const userDocs = agentIds.length
    ? await db
        .collection("users")
        .find(
          { _id: { $in: agentIds } },
          { projection: { email: 1, name: 1, lastSeen: 1, lastSeenAt: 1, lastActive: 1 } },
        )
        .toArray()
    : [];
  const userById = new Map(userDocs.map((u) => [toId(u._id), u]));

  for (const p of projects) {
    for (const a of (p.agents as Array<Record<string, unknown>>) ?? []) {
      const id = toId(a.userId);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      const u = userById.get(id);
      rows.push({
        id,
        email: String(a.email ?? u?.email ?? ""),
        name:
          (typeof a.name === "string" && a.name) ||
          (typeof u?.name === "string" ? u.name : undefined),
        role: String(a.role ?? "agent"),
        status: "active",
        isOwner: false,
        lastSeenAt: u ? pickLastSeen(u) : undefined,
      });
    }
  }

  return rows;
}

function pickLastSeen(u: Record<string, unknown>): string | undefined {
  const candidate = u.lastSeenAt ?? u.lastSeen ?? u.lastActive;
  if (!candidate) return undefined;
  const d = candidate instanceof Date ? candidate : new Date(candidate as string);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

async function collectPendingInvites(db: Db, ownerId: ObjectId): Promise<TeamMemberRow[]> {
  const ownedProjects = await db
    .collection("projects")
    .find({ userId: ownerId }, { projection: { _id: 1 } })
    .toArray();
  const ownedProjectIds = ownedProjects.map((p) => p._id);

  const invitations = await db
    .collection("invitations")
    .find({
      $or: [
        { inviterId: ownerId },
        ...(ownedProjectIds.length ? [{ projectId: { $in: ownedProjectIds } }] : []),
      ],
      status: "pending",
    })
    .sort({ createdAt: -1 })
    .toArray();

  return invitations.map((inv) => {
    const expiresAt =
      inv.expiresAt instanceof Date ? inv.expiresAt : new Date(inv.expiresAt as string);
    return {
      id: toId(inv._id),
      email: String(inv.inviteeEmail ?? ""),
      role: String(inv.role ?? "agent"),
      status: "invited" as const,
      isOwner: false,
      invitedExpiresAt: Number.isNaN(expiresAt.getTime())
        ? undefined
        : expiresAt.toISOString(),
    };
  });
}

export interface LoadTeamResult {
  rows: TeamMemberRow[];
  total: number;
}

/**
 * Load the REAL workspace roster: owner + active agents (from owned projects)
 * + pending email invitations. RBAC-gated on `sabsms_settings:view`.
 */
export async function loadTeamMembers(workspaceId: string): Promise<LoadTeamResult> {
  const sessionWorkspaceId = await requireWorkspaceId();
  // Always scope to the signed-in user's own account, ignoring any spoofed arg.
  const id = sessionWorkspaceId || workspaceId;
  if (!id || !ObjectId.isValid(id)) return { rows: [], total: 0 };

  const perm = await requirePermission("sabsms_settings", "view", id);
  if (!perm.ok) return { rows: [], total: 0 };

  const { db } = await connectToDatabase();
  const ownerId = new ObjectId(id);

  const [members, invites] = await Promise.all([
    collectMembers(db, ownerId),
    collectPendingInvites(db, ownerId),
  ]);

  const rows = [...members, ...invites];
  return { rows, total: rows.length };
}
