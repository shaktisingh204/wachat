"use server";

/**
 * SabSMS lists — server actions.
 *
 * Reads and writes the `sabsms_lists` collection (workspace-scoped).
 *
 * TODO(follow-up): register `sabsms_lists` in
 *   `src/lib/sabsms/db/collections.ts` so it gets typed access via
 *   `getSabsmsCollections()` and an index spec runs at boot. Index
 *   suggestions: `{ workspaceId: 1, name: 1 }` unique, `{ workspaceId:
 *   1, tags: 1 }`, `{ workspaceId: 1, expiresAt: 1 }`.
 *
 * The Rust engine doesn't own list state — lists are a Next.js-side
 * primitive. Membership is stored as an array of E.164 phone strings
 * directly on the doc (small lists are the common case). Larger
 * memberships will move to a join collection in a later phase.
 */

import { createHash, randomBytes } from "node:crypto";
import { ObjectId, type Filter, type WithId } from "mongodb";

import { connectToDatabase } from "@/lib/mongodb";
import { getCachedSession } from "@/lib/server-cache";
import { rowsToCsv } from "@/components/sabsms/page-toolkit";
import { getSabsmsCollections } from "@/lib/sabsms/db/collections";

import { computeOverlap, normalisePhone } from "./helpers";

// ─── Types ────────────────────────────────────────────────────────────────

/** Collection name — not yet registered in `db/collections.ts`. */
const SABSMS_LISTS_COLLECTION = "sabsms_lists";

export interface ListAuditEvent {
  at: string;
  kind: string;
  message?: string;
  actorId?: string;
  delta?: number;
}

export interface ListRecord {
  id: string;
  workspaceId: string;
  name: string;
  description?: string;
  tags: string[];
  members: string[];
  memberCount: number;
  expiresAt?: string;
  shareToken?: string;
  audit: ListAuditEvent[];
  createdAt: string;
  updatedAt: string;
}

interface ListDoc {
  workspaceId: string;
  name: string;
  description?: string;
  tags: string[];
  members: string[];
  memberCount: number;
  expiresAt?: Date;
  shareToken?: string;
  audit: ListAuditEvent[];
  createdAt: Date;
  updatedAt: Date;
}

export type ListsActionResult =
  | { ok: true }
  | { ok: false; error: string };

export interface ListsListFilters {
  q?: string;
  tag?: string;
  sort?: "newest" | "oldest" | "largest" | "name";
}

export interface ListAnalytics {
  totalLists: number;
  totalMembers: number;
  averageSize: number;
  freshLists: number;
  staleLists: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

async function resolveWorkspace(): Promise<
  { ok: true; workspaceId: string; userId: string } | { ok: false; error: string }
> {
  const session = await getCachedSession();
  const userId = (session?.user as { _id?: unknown } | undefined)?._id;
  if (!userId) return { ok: false, error: "unauthorized" };
  return { ok: true, workspaceId: String(userId), userId: String(userId) };
}

async function listsCollection() {
  const { db } = await connectToDatabase();
  return db.collection<ListDoc>(SABSMS_LISTS_COLLECTION);
}

function toIso(d?: Date | string): string {
  if (!d) return "";
  return typeof d === "string" ? d : d.toISOString();
}

function project(doc: WithId<ListDoc>): ListRecord {
  return {
    id: String(doc._id),
    workspaceId: doc.workspaceId,
    name: doc.name,
    description: doc.description,
    tags: doc.tags ?? [],
    members: doc.members ?? [],
    memberCount: doc.memberCount ?? (doc.members?.length ?? 0),
    expiresAt: doc.expiresAt ? toIso(doc.expiresAt) : undefined,
    shareToken: doc.shareToken,
    audit: doc.audit ?? [],
    createdAt: toIso(doc.createdAt),
    updatedAt: toIso(doc.updatedAt),
  };
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ─── Read paths ───────────────────────────────────────────────────────────

export async function loadLists(
  workspaceId: string,
  filters: ListsListFilters,
): Promise<ListRecord[]> {
  const col = await listsCollection();
  const filter: Filter<ListDoc> = { workspaceId };
  if (filters.q) {
    const rx = new RegExp(escapeRegex(filters.q), "i");
    filter.name = rx as never;
  }
  if (filters.tag) {
    filter.tags = filters.tag as never;
  }
  const sortMap: Record<
    NonNullable<ListsListFilters["sort"]>,
    Record<string, 1 | -1>
  > = {
    newest: { createdAt: -1 },
    oldest: { createdAt: 1 },
    largest: { memberCount: -1 },
    name: { name: 1 },
  };
  const sort = sortMap[filters.sort ?? "newest"];
  const docs = await col.find(filter).sort(sort).limit(200).toArray();
  return docs.map(project);
}

export async function loadListById(
  workspaceId: string,
  listId: string,
): Promise<ListRecord | null> {
  if (!ObjectId.isValid(listId)) return null;
  const col = await listsCollection();
  const doc = await col.findOne({ _id: new ObjectId(listId), workspaceId });
  return doc ? project(doc) : null;
}

export async function loadAnalytics(
  workspaceId: string,
): Promise<ListAnalytics> {
  const lists = await loadLists(workspaceId, { sort: "newest" });
  const totalLists = lists.length;
  const totalMembers = lists.reduce((sum, l) => sum + l.memberCount, 0);
  const averageSize = totalLists > 0 ? Math.round(totalMembers / totalLists) : 0;
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  let freshLists = 0;
  let staleLists = 0;
  for (const l of lists) {
    const updatedAt = l.updatedAt ? new Date(l.updatedAt).getTime() : 0;
    if (updatedAt >= cutoff) freshLists++;
    else staleLists++;
  }
  return { totalLists, totalMembers, averageSize, freshLists, staleLists };
}

export async function loadCampaignsUsingList(
  workspaceId: string,
  listId: string,
): Promise<{ id: string; name: string; status: string }[]> {
  if (!ObjectId.isValid(listId)) return [];
  const { cols } = await getSabsmsCollections();
  const docs = await cols.campaigns
    .find({
      workspaceId,
      // The campaign audience shape isn't fully nailed down — we look at
      // any field that references the list id.
      $or: [
        { "audience.listId": listId } as never,
        { "audience.lists": listId } as never,
        { listId: listId } as never,
      ],
    } as Filter<unknown> as never)
    .project({ name: 1, status: 1 })
    .limit(100)
    .toArray();
  return docs.map(
    (d) =>
      ({
        id: String((d as unknown as { _id: ObjectId })._id),
        name: String((d as unknown as { name?: string }).name ?? "Untitled"),
        status: String((d as unknown as { status?: string }).status ?? "draft"),
      }) as { id: string; name: string; status: string },
  );
}

// ─── Mutations ────────────────────────────────────────────────────────────

export interface CreateListInput {
  name: string;
  description?: string;
  tags?: string[];
  expiresAt?: string;
  initialMembers?: string[];
}

export async function createList(
  input: CreateListInput,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;
  if (!input.name?.trim()) return { ok: false, error: "Name is required." };

  const members = (input.initialMembers ?? [])
    .map(normalisePhone)
    .filter((p): p is string => p !== null);

  const now = new Date();
  const doc: ListDoc = {
    workspaceId: ws.workspaceId,
    name: input.name.trim(),
    description: input.description?.trim(),
    tags: input.tags ?? [],
    members,
    memberCount: members.length,
    expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined,
    audit: [
      {
        at: now.toISOString(),
        kind: "created",
        message: `List created with ${members.length} member(s).`,
        actorId: ws.userId,
        delta: members.length,
      },
    ],
    createdAt: now,
    updatedAt: now,
  };
  const col = await listsCollection();
  const res = await col.insertOne(doc);
  return { ok: true, id: String(res.insertedId) };
}

export async function addContactsToList(input: {
  listId: string;
  phones: string[];
}): Promise<{ ok: true; added: number } | { ok: false; error: string }> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;
  if (!ObjectId.isValid(input.listId)) {
    return { ok: false, error: "Invalid list id." };
  }
  const normalised = input.phones
    .map(normalisePhone)
    .filter((p): p is string => p !== null);
  if (normalised.length === 0) {
    return { ok: false, error: "No valid phone numbers provided." };
  }

  const col = await listsCollection();
  const now = new Date();
  const existing = await col.findOne({
    _id: new ObjectId(input.listId),
    workspaceId: ws.workspaceId,
  });
  if (!existing) return { ok: false, error: "List not found." };

  const before = new Set(existing.members ?? []);
  const next = new Set(before);
  for (const p of normalised) next.add(p);
  const added = next.size - before.size;

  const memberArray = Array.from(next);
  await col.updateOne(
    { _id: new ObjectId(input.listId), workspaceId: ws.workspaceId },
    {
      $set: {
        members: memberArray,
        memberCount: memberArray.length,
        updatedAt: now,
      },
      $push: {
        audit: {
          at: now.toISOString(),
          kind: "add_contacts",
          message: `Added ${added} new contact(s).`,
          actorId: ws.userId,
          delta: added,
        },
      },
    },
  );
  return { ok: true, added };
}

export async function removeContactsFromList(input: {
  listId: string;
  phones: string[];
}): Promise<{ ok: true; removed: number } | { ok: false; error: string }> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;
  if (!ObjectId.isValid(input.listId)) {
    return { ok: false, error: "Invalid list id." };
  }
  const col = await listsCollection();
  const existing = await col.findOne({
    _id: new ObjectId(input.listId),
    workspaceId: ws.workspaceId,
  });
  if (!existing) return { ok: false, error: "List not found." };

  const toRemove = new Set(
    input.phones
      .map(normalisePhone)
      .filter((p): p is string => p !== null),
  );
  const before = existing.members ?? [];
  const after = before.filter((p) => !toRemove.has(p));
  const removed = before.length - after.length;
  const now = new Date();

  await col.updateOne(
    { _id: new ObjectId(input.listId), workspaceId: ws.workspaceId },
    {
      $set: {
        members: after,
        memberCount: after.length,
        updatedAt: now,
      },
      $push: {
        audit: {
          at: now.toISOString(),
          kind: "remove_contacts",
          message: `Removed ${removed} contact(s).`,
          actorId: ws.userId,
          delta: -removed,
        },
      },
    },
  );
  return { ok: true, removed };
}

export async function deleteList(listId: string): Promise<ListsActionResult> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;
  if (!ObjectId.isValid(listId)) {
    return { ok: false, error: "Invalid list id." };
  }
  const col = await listsCollection();
  const res = await col.deleteOne({
    _id: new ObjectId(listId),
    workspaceId: ws.workspaceId,
  });
  if (res.deletedCount === 0) {
    return { ok: false, error: "List not found." };
  }
  return { ok: true };
}

export async function duplicateList(
  listId: string,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;
  if (!ObjectId.isValid(listId)) {
    return { ok: false, error: "Invalid list id." };
  }
  const col = await listsCollection();
  const src = await col.findOne({
    _id: new ObjectId(listId),
    workspaceId: ws.workspaceId,
  });
  if (!src) return { ok: false, error: "List not found." };

  const now = new Date();
  const copy: ListDoc = {
    workspaceId: ws.workspaceId,
    name: `${src.name} (copy)`,
    description: src.description,
    tags: src.tags ?? [],
    members: src.members ?? [],
    memberCount: src.memberCount ?? 0,
    audit: [
      {
        at: now.toISOString(),
        kind: "duplicated",
        message: `Duplicated from "${src.name}".`,
        actorId: ws.userId,
      },
    ],
    createdAt: now,
    updatedAt: now,
  };
  const res = await col.insertOne(copy);
  return { ok: true, id: String(res.insertedId) };
}

export async function tagList(input: {
  listId: string;
  tags: string[];
}): Promise<ListsActionResult> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;
  if (!ObjectId.isValid(input.listId)) {
    return { ok: false, error: "Invalid list id." };
  }
  const col = await listsCollection();
  const res = await col.updateOne(
    { _id: new ObjectId(input.listId), workspaceId: ws.workspaceId },
    {
      $set: { tags: input.tags, updatedAt: new Date() },
      $push: {
        audit: {
          at: new Date().toISOString(),
          kind: "tag",
          message: `Tags set to ${input.tags.join(", ") || "(none)"}.`,
          actorId: ws.userId,
        },
      },
    },
  );
  if (res.matchedCount === 0) return { ok: false, error: "List not found." };
  return { ok: true };
}

export async function convertListToSuppression(
  listId: string,
): Promise<{ ok: true; added: number } | { ok: false; error: string }> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;
  if (!ObjectId.isValid(listId)) {
    return { ok: false, error: "Invalid list id." };
  }
  const col = await listsCollection();
  const list = await col.findOne({
    _id: new ObjectId(listId),
    workspaceId: ws.workspaceId,
  });
  if (!list) return { ok: false, error: "List not found." };

  const { cols } = await getSabsmsCollections();
  let added = 0;
  for (const phone of list.members ?? []) {
    const phoneHash = createHash("sha256")
      .update(phone.toLowerCase())
      .digest("hex");
    const res = await cols.suppressions.updateOne(
      { workspaceId: ws.workspaceId, phoneHash },
      {
        $setOnInsert: {
          workspaceId: ws.workspaceId,
          phoneHash,
          source: "manual",
          createdAt: new Date(),
        } as never,
      },
      { upsert: true },
    );
    if (res.upsertedCount > 0) added++;
  }
  await col.updateOne(
    { _id: new ObjectId(listId), workspaceId: ws.workspaceId },
    {
      $push: {
        audit: {
          at: new Date().toISOString(),
          kind: "convert_suppression",
          message: `Converted to suppression — ${added} new entries.`,
          actorId: ws.userId,
        },
      },
    },
  );
  return { ok: true, added };
}

export async function setListShareToken(input: {
  listId: string;
  enable: boolean;
}): Promise<{ ok: true; token: string | null } | { ok: false; error: string }> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;
  if (!ObjectId.isValid(input.listId)) {
    return { ok: false, error: "Invalid list id." };
  }
  const col = await listsCollection();
  const now = new Date();
  if (input.enable) {
    const token = randomBytes(16).toString("hex");
    const res = await col.updateOne(
      { _id: new ObjectId(input.listId), workspaceId: ws.workspaceId },
      {
        $set: { shareToken: token, updatedAt: now },
        $push: {
          audit: {
            at: now.toISOString(),
            kind: "share_enabled",
            actorId: ws.userId,
          },
        },
      },
    );
    if (res.matchedCount === 0) return { ok: false, error: "List not found." };
    return { ok: true, token };
  }
  const res = await col.updateOne(
    { _id: new ObjectId(input.listId), workspaceId: ws.workspaceId },
    {
      $unset: { shareToken: "" } as never,
      $set: { updatedAt: now },
      $push: {
        audit: {
          at: now.toISOString(),
          kind: "share_disabled",
          actorId: ws.userId,
        },
      },
    },
  );
  if (res.matchedCount === 0) return { ok: false, error: "List not found." };
  return { ok: true, token: null };
}

export async function compareLists(
  listIdA: string,
  listIdB: string,
): Promise<
  | { ok: true; onlyA: number; onlyB: number; both: number }
  | { ok: false; error: string }
> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;
  const a = await loadListById(ws.workspaceId, listIdA);
  const b = await loadListById(ws.workspaceId, listIdB);
  if (!a || !b) return { ok: false, error: "List not found." };
  const overlap = computeOverlap(a.members, b.members);
  return {
    ok: true,
    onlyA: overlap.onlyA.length,
    onlyB: overlap.onlyB.length,
    both: overlap.both.length,
  };
}

export async function exportListCsv(
  workspaceId: string,
  listId: string,
): Promise<string> {
  const rec = await loadListById(workspaceId, listId);
  if (!rec) return "phone\n";
  return rowsToCsv(
    rec.members.map((p) => ({ phone: p })),
    [{ key: "phone", header: "Phone" }],
  );
}
