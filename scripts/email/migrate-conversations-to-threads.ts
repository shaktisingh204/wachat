/**
 * Migrate legacy `email_conversation` documents to the new
 * `email_threads` + `email_messages` shape introduced in the Phase 6
 * email-suite rebuild.
 *
 * Idempotent: safe to re-run. Keeps the source collection intact under
 * `_legacy_email_conversation` for 30 days, then `scripts/email/drop-legacy.ts`
 * removes it.
 *
 * Run with: `pnpm tsx scripts/email/migrate-conversations-to-threads.ts`
 */

import { MongoClient, ObjectId } from 'mongodb';

const MONGO_URI = process.env.MONGODB_URI;
const DB_NAME   = process.env.MONGODB_DB || 'sabnode';

if (!MONGO_URI) {
  console.error('MONGODB_URI is required');
  process.exit(1);
}

interface LegacyConversation {
  _id: ObjectId;
  userId: ObjectId;
  participants?: Array<{ name?: string; email: string; avatar?: string }>;
  subject: string;
  snippet?: string;
  status: 'unread' | 'read' | 'archived' | 'trash';
  folder?: string;
  labels?: string[];
  lastMessageAt: Date;
  messages?: Array<{
    id?: string;
    from: { name?: string; email: string };
    to?: Array<{ name?: string; email: string }>;
    cc?: Array<{ name?: string; email: string }>;
    subject?: string;
    bodyText?: string;
    bodyHtml?: string;
    date: Date;
    attachments?: Array<{ filename: string; contentType: string; size: number; url: string }>;
    folder?: 'inbox' | 'sent';
  }>;
}

async function main() {
  console.log('→ connecting to Mongo');
  const client = new MongoClient(MONGO_URI!);
  await client.connect();
  const db = client.db(DB_NAME);

  const src       = db.collection<LegacyConversation>('email_conversation');
  const threads   = db.collection('email_threads');
  const messages  = db.collection('email_messages');
  const legacy    = db.collection('_legacy_email_conversation');
  const checkpoint = db.collection('_email_migration_checkpoints');

  const sourceCount = await src.countDocuments();
  console.log(`→ source has ${sourceCount} email_conversation docs`);

  const cursor = src.find({}, { batchSize: 200 });
  let migrated = 0;
  let skipped = 0;

  for await (const conv of cursor) {
    const seen = await checkpoint.findOne({ kind: 'thread-from-conv', sourceId: conv._id });
    if (seen) { skipped++; continue; }

    const threadId = new ObjectId();
    const msgIds: ObjectId[] = [];

    const msgDocs = (conv.messages ?? []).map((m) => {
      const id = new ObjectId();
      msgIds.push(id);
      return {
        _id: id,
        userId: conv.userId,
        threadId,
        direction: m.folder === 'sent' ? 'outbound' : 'inbound',
        from: { email: m.from.email, name: m.from.name },
        to: (m.to ?? []).map(a => ({ email: a.email, name: a.name })),
        cc: (m.cc ?? []).map(a => ({ email: a.email, name: a.name })),
        subject: m.subject ?? conv.subject,
        bodyText: m.bodyText,
        bodyHtml: m.bodyHtml,
        attachments: m.attachments ?? [],
        createdAt: new Date(m.date),
      };
    });

    const threadDoc = {
      _id: threadId,
      userId: conv.userId,
      accountId: conv.userId,            // best-effort: legacy didn't track per-account
      subject: conv.subject,
      participants: conv.participants ?? [],
      status: conv.status === 'archived' || conv.status === 'trash' ? 'archived' : 'open',
      unread: conv.status === 'unread',
      labels: conv.labels ?? [],
      lastMessageAt: new Date(conv.lastMessageAt),
      lastMessagePreview: (conv.snippet ?? '').slice(0, 280),
      messageCount: msgDocs.length,
      createdAt: new Date(conv.lastMessageAt),
      updatedAt: new Date(conv.lastMessageAt),
    };

    if (msgDocs.length > 0) {
      await messages.insertMany(msgDocs, { ordered: false }).catch((err) => {
        if (err?.code !== 11000) throw err;
      });
    }
    await threads.insertOne(threadDoc).catch((err) => {
      if (err?.code !== 11000) throw err;
    });
    await checkpoint.insertOne({
      kind: 'thread-from-conv',
      sourceId: conv._id,
      threadId,
      messageIds: msgIds,
      migratedAt: new Date(),
    });

    migrated++;
    if (migrated % 100 === 0) console.log(`  ${migrated} / ${sourceCount}`);
  }

  console.log(`→ migrated ${migrated} (${skipped} already done)`);

  // Rename source collection so it stays available for 30 days.
  if (migrated > 0 && sourceCount > 0) {
    try {
      await src.rename('_legacy_email_conversation', { dropTarget: false });
      console.log('→ renamed email_conversation → _legacy_email_conversation');
    } catch (err: unknown) {
      const m = (err as { message?: string })?.message ?? '';
      if (m.includes('source namespace does not exist')) {
        console.log('→ source collection already renamed; skipping');
      } else if (m.includes('target namespace exists')) {
        console.log('→ legacy collection already exists; leaving source in place');
      } else {
        throw err;
      }
    }
  }

  // Ensure indexes on the new collections.
  console.log('→ ensuring indexes on email_threads + email_messages');
  await threads.createIndexes([
    { key: { userId: 1, createdAt: -1 } },
    { key: { userId: 1, status: 1, lastMessageAt: -1 } },
    { key: { userId: 1, accountId: 1, lastMessageAt: -1 } },
    { key: { userId: 1, unread: 1 } },
    { key: { userId: 1, assignedTo: 1 } },
  ]);
  await messages.createIndexes([
    { key: { threadId: 1, createdAt: 1 } },
    { key: { userId: 1, createdAt: -1 } },
    { key: { messageId: 1 }, sparse: true },
  ]);

  console.log('✓ migration complete');
  await client.close();
}

main().catch((err) => {
  console.error('migration failed:', err);
  process.exit(1);
});
