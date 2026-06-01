import "server-only";

/**
 * SabCRM — workspace member listing (server-only).
 *
 * Surfaces the workspace members for a given SabNode project (owner + every
 * invited agent) together with a normalised SabCRM role label so callers
 * can power:
 *
 *   • Assignee pickers — `listCrmMembersForPicker` returns a lightweight
 *     `CrmMemberPickerOption[]` ready for a combobox.
 *   • Members settings page — `listCrmMembers` returns richer profile data
 *     including the per-member SabCRM capability key derived from the
 *     project's RBAC graph.
 *
 * Data sources
 * -----------
 * SabNode stores workspace membership directly on the `projects` collection:
 *
 *   projects.userId          — owner (ObjectId referencing `users._id`)
 *   projects.agents[].userId — invited members (same reference)
 *   projects.agents[].role   — role slug: "owner" | "admin" | "agent" | …
 *
 * We join the `users` collection for profile fields (name, email, image).
 * The SabCRM capability is derived from the agent role:
 *
 *   owner / admin → sabcrm:admin
 *   manager       → sabcrm:manage
 *   everyone else → sabcrm:view
 *
 * This mapping intentionally mirrors the three RBAC keys defined in
 * `./rbac-keys.ts` (VIEW / MANAGE / ADMIN) and the `gate()` pipeline in
 * `sabcrm.actions.ts`. It does NOT duplicate RBAC enforcement — it is only
 * used to surface *which capability each member holds* so UI can show it in
 * a settings page. All actual enforcement still goes through `canServer()`.
 *
 * Scoping
 * -------
 * Every function takes a `projectId: string` which is the tenant scope for
 * SabCRM (matches the `projectId` on `sabcrm_*` collections). RBAC + plan
 * enforcement is the caller's responsibility (the `gate()` helper in
 * `sabcrm.actions.ts`).
 */

import { ObjectId, type Filter } from "mongodb";
import { connectToDatabase } from "@/lib/mongodb";

/* -------------------------------------------------------------------------- */
/* Public types                                                               */
/* -------------------------------------------------------------------------- */

/**
 * SabCRM capability label surfaced next to each member.
 *
 * Maps directly onto the three RBAC keys registered in `./rbac-keys.ts`:
 *   `sabcrm:view`   — can open SabCRM and read records.
 *   `sabcrm:manage` — can also create / edit / delete records.
 *   `sabcrm:admin`  — can also manage the data model (objects / fields).
 *
 * The string values intentionally match the RBAC key suffixes so callers
 * can display them without a lookup table.
 */
export type CrmMemberRole = "view" | "manage" | "admin";

/**
 * A workspace member enriched with their SabCRM role.
 *
 * This is a read-only listing shape — it does not touch the RBAC store.
 */
export interface CrmMember {
  /** Hex string of the user's `_id` in the `users` collection. */
  userId: string;
  name: string;
  email: string;
  /** Avatar URL from `users.image`, when set. */
  image?: string;
  /**
   * The member's role slug as stored on the project's `agents` array (e.g.
   * `"owner"`, `"admin"`, `"agent"`, `"manager"`). The project owner is
   * always surfaced with `"owner"`. Custom role slugs are passed through as-is.
   */
  projectRole: string;
  /** Derived SabCRM capability — see {@link CrmMemberRole}. */
  crmRole: CrmMemberRole;
  /** True for the project owner. */
  isOwner: boolean;
}

/**
 * Lightweight option for assignee pickers.
 *
 * Only the fields needed to render a combobox row + store a value.
 */
export interface CrmMemberPickerOption {
  /** Hex string of the user's `_id`. */
  userId: string;
  label: string;
  /** Avatar URL, when available. */
  image?: string;
  /** Initials fallback when no avatar is set (first char of name or email). */
  initials: string;
}

/* -------------------------------------------------------------------------- */
/* Internal helpers                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Derives the SabCRM capability from an agent role slug.
 *
 * The mapping is intentionally conservative:
 *   - "owner" and "admin" get full data-model access (admin capability).
 *   - "manager" gets record-write access (manage capability).
 *   - Everything else (including the default "agent" role) gets read-only.
 *
 * This mirrors the three `SABCRM_RBAC_KEYS` and the `gate()` pipeline in
 * `sabcrm.actions.ts` without calling `canServer()` (which would require an
 * active session for every member row — inappropriate for a listing).
 */
function deriveCrmRole(projectRole: string): CrmMemberRole {
  const normalized = projectRole.toLowerCase().trim();
  if (normalized === "owner" || normalized === "admin") return "admin";
  if (normalized === "manager") return "manage";
  return "view";
}

/**
 * Returns an ObjectId for the caller-supplied id, or `null` when malformed.
 * Avoids throwing on bad input — callers should handle `null` gracefully.
 */
function toObjectId(id: string): ObjectId | null {
  return ObjectId.isValid(id) ? new ObjectId(id) : null;
}

/** Generates initials from a display name or email address. */
function initials(name: string, email: string): string {
  const src = name.trim() || email.trim();
  if (!src) return "?";
  const parts = src.split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return (src[0] ?? "?").toUpperCase();
}

/* -------------------------------------------------------------------------- */
/* Core listing function                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Lists all workspace members for a project with their SabCRM role.
 *
 * Returns the project owner first, followed by agents in insertion order.
 * Deduplicates on `userId` so an agent who also appears as owner is surfaced
 * only once (as owner).
 *
 * @param projectId  The SabCRM tenant project id (string form of ObjectId).
 * @returns Resolved members sorted: owner first, then agents alphabetically
 *          by name.
 */
export async function listCrmMembers(projectId: string): Promise<CrmMember[]> {
  const projectOid = toObjectId(projectId);
  if (!projectOid) return [];

  const { db } = await connectToDatabase();

  // Step 1 — load the project to get the owner + agents roster.
  const project = await db
    .collection("projects")
    .findOne(
      { _id: projectOid } as Filter<Record<string, unknown>>,
      { projection: { userId: 1, agents: 1 } },
    );

  if (!project) return [];

  // Build a deduplicated set of user ObjectIds to resolve.
  // agents[].userId may be stored as ObjectId or as hex strings (legacy rows).
  const ownerOid: ObjectId = project.userId as ObjectId;
  const seenIds = new Set<string>([ownerOid.toHexString()]);

  // Normalise agents to { userId: ObjectId, role: string }.
  const agentRows: Array<{ userId: ObjectId; role: string }> = [];
  for (const a of (project.agents ?? []) as Array<{
    userId: unknown;
    role?: string;
  }>) {
    if (!a.userId) continue;
    const aOid =
      a.userId instanceof ObjectId
        ? a.userId
        : ObjectId.isValid(String(a.userId))
          ? new ObjectId(String(a.userId))
          : null;
    if (!aOid) continue;
    const hex = aOid.toHexString();
    if (seenIds.has(hex)) continue; // skip if already captured (owner listed as agent)
    seenIds.add(hex);
    agentRows.push({ userId: aOid, role: a.role ?? "agent" });
  }

  // Step 2 — bulk-fetch user profiles in a single query.
  const allUserOids = [ownerOid, ...agentRows.map((a) => a.userId)];
  const userDocs = await db
    .collection("users")
    .find(
      { _id: { $in: allUserOids } } as Filter<Record<string, unknown>>,
      { projection: { name: 1, email: 1, image: 1 } },
    )
    .toArray();

  // Index by hex for O(1) lookup.
  const userMap = new Map<
    string,
    { name: string; email: string; image?: string }
  >();
  for (const doc of userDocs) {
    const hex =
      doc._id instanceof ObjectId ? doc._id.toHexString() : String(doc._id);
    userMap.set(hex, {
      name: String(doc.name ?? ""),
      email: String(doc.email ?? ""),
      image: doc.image ? String(doc.image) : undefined,
    });
  }

  // Step 3 — assemble the result list: owner first, then agents.
  const members: CrmMember[] = [];

  const ownerHex = ownerOid.toHexString();
  const ownerProfile = userMap.get(ownerHex);
  members.push({
    userId: ownerHex,
    name: ownerProfile?.name ?? "",
    email: ownerProfile?.email ?? "",
    image: ownerProfile?.image,
    projectRole: "owner",
    crmRole: "admin",
    isOwner: true,
  });

  // Sort agents alphabetically by name for a consistent list.
  const sortedAgents = [...agentRows].sort((a, b) => {
    const aName = userMap.get(a.userId.toHexString())?.name ?? "";
    const bName = userMap.get(b.userId.toHexString())?.name ?? "";
    return aName.localeCompare(bName);
  });

  for (const agent of sortedAgents) {
    const hex = agent.userId.toHexString();
    const profile = userMap.get(hex);
    members.push({
      userId: hex,
      name: profile?.name ?? "",
      email: profile?.email ?? "",
      image: profile?.image,
      projectRole: agent.role,
      crmRole: deriveCrmRole(agent.role),
      isOwner: false,
    });
  }

  return members;
}

/* -------------------------------------------------------------------------- */
/* Picker-optimised variant                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Returns a lightweight member list for assignee pickers.
 *
 * Strips everything except the fields needed for a combobox: `userId`,
 * `label` (display name with email fallback), `image`, and `initials`.
 *
 * All members are included regardless of crmRole — the assignee field is
 * visible to anyone with `sabcrm:manage`, but the picker should always show
 * the full roster so you can assign to any member (including read-only ones
 * who will receive notifications).
 *
 * @param projectId  The SabCRM tenant project id.
 */
export async function listCrmMembersForPicker(
  projectId: string,
): Promise<CrmMemberPickerOption[]> {
  const members = await listCrmMembers(projectId);
  return members.map((m) => ({
    userId: m.userId,
    label: m.name.trim() || m.email,
    image: m.image,
    initials: initials(m.name, m.email),
  }));
}

/* -------------------------------------------------------------------------- */
/* Single-member lookup                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Resolves one member by user id within a project.
 *
 * Returns `null` when the user is not a member of the project or the project
 * does not exist. Useful for validating `assigneeId` values before writing.
 *
 * @param projectId  The SabCRM tenant project id.
 * @param userId     Hex string of the user to look up.
 */
export async function getCrmMember(
  projectId: string,
  userId: string,
): Promise<CrmMember | null> {
  const members = await listCrmMembers(projectId);
  return members.find((m) => m.userId === userId) ?? null;
}

/**
 * Checks whether a user id belongs to the project's member roster.
 *
 * Thin wrapper over {@link getCrmMember}. Used by the record-assignment
 * path to validate that an assigneeId is a real project member before
 * writing it to the record.
 *
 * @param projectId  The SabCRM tenant project id.
 * @param userId     Hex string of the user to validate.
 */
export async function isCrmMember(
  projectId: string,
  userId: string,
): Promise<boolean> {
  const member = await getCrmMember(projectId, userId);
  return member !== null;
}
