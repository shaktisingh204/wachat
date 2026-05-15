/**
 * `sabwa_contacts` repository — mirrors the Rust `services/sabwa-engine/src/db/contacts.rs`
 * schema 1:1 so the migration is a drop-in replacement.
 *
 * Stored as `sabwa_contacts` collection keyed by `(sessionId, jid)`.
 */

import { ObjectId, type Collection, type Db } from 'mongodb';

export const COLLECTION = 'sabwa_contacts';

export interface SabwaContactDoc {
  _id?: ObjectId;
  projectId: ObjectId;
  sessionId: ObjectId;
  jid: string;
  phoneE164?: string;
  name?: string;
  pushName?: string;
  profilePicUrl?: string;
  isBusiness?: boolean;
  isBlocked?: boolean;
  isMyContact?: boolean;
  tags?: string[];
  customFields?: Record<string, unknown>;
  notes?: string;
  lastInteractionAt?: Date;
}

/** Public row shape served by the `/v1/contacts` routes (mirrors Rust `ContactRow`). */
export interface ContactRow {
  jid: string;
  phoneE164: string | null;
  name: string | null;
  pushName: string | null;
  profilePicUrl: string | null;
  isBusiness: boolean;
  isBlocked: boolean;
  isMyContact: boolean;
  tags: string[];
  notes: string | null;
  lastInteractionAt: Date | null;
}

function parseOidLoose(id: string): ObjectId {
  try {
    return new ObjectId(id);
  } catch {
    return new ObjectId();
  }
}

function toRow(c: SabwaContactDoc): ContactRow {
  return {
    jid: c.jid,
    phoneE164: c.phoneE164 ?? null,
    name: c.name ?? null,
    pushName: c.pushName ?? null,
    profilePicUrl: c.profilePicUrl ?? null,
    isBusiness: c.isBusiness ?? false,
    isBlocked: c.isBlocked ?? false,
    isMyContact: c.isMyContact ?? false,
    tags: c.tags ?? [],
    notes: c.notes ?? null,
    lastInteractionAt: c.lastInteractionAt ?? null,
  };
}

export class ContactsRepo {
  private readonly col: Collection<SabwaContactDoc>;

  constructor(db: Db) {
    this.col = db.collection<SabwaContactDoc>(COLLECTION);
  }

  /** Upsert by `(sessionId, jid)`. */
  async upsert(contact: SabwaContactDoc): Promise<void> {
    await this.col.replaceOne(
      { sessionId: contact.sessionId, jid: contact.jid },
      contact,
      { upsert: true },
    );
  }

  /** Bulk upsert — used by history-sync persistence. */
  async upsertMany(contacts: SabwaContactDoc[]): Promise<number> {
    if (contacts.length === 0) return 0;
    const ops = contacts.map((c) => ({
      replaceOne: {
        filter: { sessionId: c.sessionId, jid: c.jid },
        replacement: c,
        upsert: true,
      },
    }));
    const res = await this.col.bulkWrite(ops, { ordered: false });
    return res.upsertedCount + res.modifiedCount;
  }

  async findBySession(sessionId: ObjectId): Promise<SabwaContactDoc[]> {
    return this.col.find({ sessionId }).toArray();
  }

  async findByJid(sessionId: ObjectId, jid: string): Promise<SabwaContactDoc | null> {
    return this.col.findOne({ sessionId, jid });
  }

  async setTags(sessionId: ObjectId, jid: string, tags: string[]): Promise<void> {
    await this.col.updateOne({ sessionId, jid }, { $set: { tags } });
  }

  async setNotes(sessionId: ObjectId, jid: string, notes: string): Promise<void> {
    await this.col.updateOne({ sessionId, jid }, { $set: { notes } });
  }

  async setBlocked(sessionId: ObjectId, jid: string, blocked: boolean): Promise<void> {
    await this.col.updateOne({ sessionId, jid }, { $set: { isBlocked: blocked } });
  }
}

// ---------------------------------------------------------------------------
// Route-compat helpers (mirror the Rust shims).
// ---------------------------------------------------------------------------

export async function list(
  db: Db,
  sessionId: string,
  _search?: string | null,
  _tag?: string | null,
): Promise<ContactRow[]> {
  const repo = new ContactsRepo(db);
  const oid = parseOidLoose(sessionId);
  const rows = await repo.findBySession(oid);
  return rows.map(toRow);
}

export async function get(db: Db, sessionId: string, jid: string): Promise<ContactRow | null> {
  const repo = new ContactsRepo(db);
  const oid = parseOidLoose(sessionId);
  const row = await repo.findByJid(oid, jid);
  return row ? toRow(row) : null;
}

export async function update(
  db: Db,
  sessionId: string,
  jid: string,
  patch: { tags?: string[]; notes?: string | null },
): Promise<void> {
  const repo = new ContactsRepo(db);
  const oid = parseOidLoose(sessionId);
  if (patch.tags !== undefined) await repo.setTags(oid, jid, patch.tags);
  if (typeof patch.notes === 'string') await repo.setNotes(oid, jid, patch.notes);
}

export async function setBlocked(
  db: Db,
  sessionId: string,
  jid: string,
  blocked: boolean,
): Promise<void> {
  const repo = new ContactsRepo(db);
  const oid = parseOidLoose(sessionId);
  await repo.setBlocked(oid, jid, blocked);
}

export { parseOidLoose };
