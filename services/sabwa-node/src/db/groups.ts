/**
 * `sabwa_groups` repository — mirrors the Rust `services/sabwa-engine/src/db/groups.rs`
 * schema 1:1.
 *
 * Stored as `sabwa_groups` collection keyed by `(sessionId, jid)` where `jid`
 * always ends in `@g.us`.
 */

import { ObjectId, type Collection, type Db } from 'mongodb';

export const COLLECTION = 'sabwa_groups';

export interface SabwaParticipant {
  jid: string;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  joinedAt: Date;
}

export interface SabwaGroupDoc {
  _id?: ObjectId;
  projectId: ObjectId;
  sessionId: ObjectId;
  jid: string;
  subject: string;
  description?: string;
  creator?: string;
  createdAt: Date;
  participants: SabwaParticipant[];
  inviteCode?: string;
  announcement?: boolean;
  restrict?: boolean;
  ephemeralDuration?: number;
  category?: string;
}

export interface GroupParticipantRow {
  jid: string;
  isAdmin: boolean;
  isSuperAdmin: boolean;
}

export interface GroupRow {
  jid: string;
  subject: string;
  description: string | null;
  creator: string | null;
  participantCount: number;
  category: string | null;
  announcement: boolean;
  restrict: boolean;
  ephemeralDuration: number | null;
  participants: GroupParticipantRow[];
}

function parseOidLoose(id: string): ObjectId {
  try {
    return new ObjectId(id);
  } catch {
    return new ObjectId();
  }
}

function toRow(g: SabwaGroupDoc): GroupRow {
  const participants = (g.participants ?? []).map((p) => ({
    jid: p.jid,
    isAdmin: p.isAdmin,
    isSuperAdmin: p.isSuperAdmin,
  }));
  return {
    jid: g.jid,
    subject: g.subject,
    description: g.description ?? null,
    creator: g.creator ?? null,
    participantCount: participants.length,
    category: g.category ?? null,
    announcement: g.announcement ?? false,
    restrict: g.restrict ?? false,
    ephemeralDuration: g.ephemeralDuration ?? null,
    participants,
  };
}

export class GroupsRepo {
  private readonly col: Collection<SabwaGroupDoc>;

  constructor(db: Db) {
    this.col = db.collection<SabwaGroupDoc>(COLLECTION);
  }

  async upsert(group: SabwaGroupDoc): Promise<void> {
    await this.col.replaceOne(
      { sessionId: group.sessionId, jid: group.jid },
      group,
      { upsert: true },
    );
  }

  async upsertMany(groups: SabwaGroupDoc[]): Promise<number> {
    if (groups.length === 0) return 0;
    const ops = groups.map((g) => ({
      replaceOne: {
        filter: { sessionId: g.sessionId, jid: g.jid },
        replacement: g,
        upsert: true,
      },
    }));
    const res = await this.col.bulkWrite(ops, { ordered: false });
    return res.upsertedCount + res.modifiedCount;
  }

  async findByJid(sessionId: ObjectId, jid: string): Promise<SabwaGroupDoc | null> {
    return this.col.findOne({ sessionId, jid });
  }

  async listBySession(sessionId: ObjectId, category?: string | null): Promise<SabwaGroupDoc[]> {
    const filter: Record<string, unknown> = { sessionId };
    if (category) filter.category = category;
    return this.col.find(filter).toArray();
  }

  async updateParticipants(
    sessionId: ObjectId,
    jid: string,
    participants: SabwaParticipant[],
  ): Promise<void> {
    await this.col.updateOne({ sessionId, jid }, { $set: { participants } });
  }

  async patchSubject(sessionId: ObjectId, jid: string, subject: string): Promise<void> {
    await this.col.updateOne({ sessionId, jid }, { $set: { subject } });
  }

  async patchDescription(sessionId: ObjectId, jid: string, description: string): Promise<void> {
    await this.col.updateOne({ sessionId, jid }, { $set: { description } });
  }

  async setInviteCode(sessionId: ObjectId, jid: string, inviteCode: string): Promise<void> {
    await this.col.updateOne({ sessionId, jid }, { $set: { inviteCode } });
  }

  async setCategory(sessionId: ObjectId, jid: string, category: string | null): Promise<void> {
    if (category === null) {
      await this.col.updateOne({ sessionId, jid }, { $unset: { category: '' } });
    } else {
      await this.col.updateOne({ sessionId, jid }, { $set: { category } });
    }
  }

  /** Merge participant changes (add/remove/promote/demote). */
  async applyParticipantOp(
    sessionId: ObjectId,
    jid: string,
    op: 'add' | 'remove' | 'promote' | 'demote',
    jids: string[],
  ): Promise<void> {
    const existing = await this.findByJid(sessionId, jid);
    if (!existing) return;
    const map = new Map(existing.participants?.map((p) => [p.jid, p]) ?? []);
    const now = new Date();
    if (op === 'add') {
      for (const j of jids) {
        if (!map.has(j)) {
          map.set(j, { jid: j, isAdmin: false, isSuperAdmin: false, joinedAt: now });
        }
      }
    } else if (op === 'remove') {
      for (const j of jids) map.delete(j);
    } else if (op === 'promote') {
      for (const j of jids) {
        const cur = map.get(j) ?? { jid: j, isAdmin: false, isSuperAdmin: false, joinedAt: now };
        map.set(j, { ...cur, isAdmin: true });
      }
    } else if (op === 'demote') {
      for (const j of jids) {
        const cur = map.get(j);
        if (cur) map.set(j, { ...cur, isAdmin: false, isSuperAdmin: false });
      }
    }
    await this.updateParticipants(sessionId, jid, Array.from(map.values()));
  }
}

// ---------------------------------------------------------------------------
// Route-compat helpers
// ---------------------------------------------------------------------------

export async function list(
  db: Db,
  sessionId: string,
  category?: string | null,
): Promise<GroupRow[]> {
  const repo = new GroupsRepo(db);
  const oid = parseOidLoose(sessionId);
  const rows = await repo.listBySession(oid, category ?? null);
  return rows.map(toRow);
}

export async function get(db: Db, sessionId: string, jid: string): Promise<GroupRow | null> {
  const repo = new GroupsRepo(db);
  const oid = parseOidLoose(sessionId);
  const row = await repo.findByJid(oid, jid);
  return row ? toRow(row) : null;
}

export async function getInviteCode(
  db: Db,
  sessionId: string,
  jid: string,
): Promise<string | null> {
  const repo = new GroupsRepo(db);
  const oid = parseOidLoose(sessionId);
  const row = await repo.findByJid(oid, jid);
  return row?.inviteCode ?? null;
}

export { parseOidLoose };
