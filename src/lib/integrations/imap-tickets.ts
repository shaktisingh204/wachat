/**
 * IMAP → CRM ticket bridge.
 *
 * Polls each tenant's configured support inbox, converts every unread
 * message into a row in `crm_tickets`, marks the message read, and
 * advances `lastUid` so we never re-process the same email.
 *
 * Implementation note — IMAP requires a real protocol client; doing TLS
 * line parsing by hand is impractical. We use `imapflow` (MIT-licensed,
 * zero deps beyond `mailparser`/streams). If the package is not yet
 * installed in this repo, this function logs a clear "install" message
 * and exits without touching any data — keeping the cron job safe to
 * register before the dep lands.
 *
 *   Install with:   npm i imapflow mailparser
 *                   npm i -D @types/mailparser
 */
import 'server-only';

import { ObjectId, type Db, type Document } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { decryptData } from '@/lib/sabflow/credentials/encryption';

export interface ImapPollResult {
  processed: number;
  ticketsCreated: number;
  inboxesPolled: number;
  errors: string[];
}

interface TicketEmailSettingDoc extends Document {
  _id: ObjectId;
  userId: ObjectId;
  imap_host?: string;
  imap_port?: string | number;
  email_address?: string;
  password?: string;
  encryption?: 'ssl' | 'tls' | 'none' | string;
  auto_reply?: boolean;
  auto_reply_body?: string;
  /** Highest IMAP UID we've already imported (per-inbox). */
  lastUid?: number;
  /** Tenant-level toggle. */
  is_active?: boolean;
}

/**
 * Try to load `imapflow` lazily so the cron job is safe to schedule
 * even when the package is missing in dev.
 */
async function loadImapflow(): Promise<unknown | null> {
  try {
    // Dynamic import keeps `imapflow` an optional peer dep — bundlers
    // won't try to resolve it at compile-time, and the cron job exits
    // gracefully if it's not installed.
    const mod = await import(/* webpackIgnore: true */ 'imapflow' as string).catch(
      () => null,
    );
    return mod;
  } catch {
    return null;
  }
}

async function loadMailparser(): Promise<unknown | null> {
  try {
    const mod = await import(/* webpackIgnore: true */ 'mailparser' as string).catch(
      () => null,
    );
    return mod;
  } catch {
    return null;
  }
}

interface ParsedAddress {
  address?: string;
  name?: string;
}
interface ParsedEmail {
  subject?: string;
  text?: string;
  html?: string;
  from?: { value?: ParsedAddress[] } | ParsedAddress | ParsedAddress[];
  attachments?: Array<{
    filename?: string;
    contentType?: string;
    size?: number;
    content?: Buffer;
  }>;
}

function extractFromAddress(parsed: ParsedEmail): { email: string; name: string } {
  const value = (parsed.from as any)?.value;
  const candidates: ParsedAddress[] = Array.isArray(value)
    ? value
    : Array.isArray(parsed.from)
      ? (parsed.from as ParsedAddress[])
      : parsed.from
        ? [parsed.from as ParsedAddress]
        : [];
  const first = candidates[0] ?? {};
  return {
    email: (first.address ?? '').toLowerCase(),
    name: first.name ?? '',
  };
}

function bodyToPlainText(parsed: ParsedEmail): string {
  if (parsed.text && parsed.text.trim()) return parsed.text;
  if (parsed.html) {
    // Crude HTML→text so the description field stays readable. The
    // original HTML is preserved by mailparser if the caller needs it.
    return parsed.html
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\s+\n/g, '\n')
      .trim();
  }
  return '';
}

async function uploadAttachmentToSabFiles(
  _tenantUserId: ObjectId,
  attachment: { filename?: string; contentType?: string; content?: Buffer },
): Promise<string | null> {
  // Defer to the SabFiles client when it exposes a server-side upload
  // helper. The repo's current SabFiles surface is the React
  // `<SabFilePicker>`; until a server upload API lands we just log the
  // attachment metadata so it's visible in observability and skip the
  // blob upload. This keeps the ticket creation working end-to-end.
  // TODO(sabfiles): when `uploadBufferToSabFiles({userId, buffer, name, mime})`
  // ships, replace this stub.
  console.warn(
    `[imap-tickets] TODO: SabFiles server upload not wired — skipping attachment "${attachment.filename ?? 'untitled'}" (${attachment.size ?? attachment.content?.length ?? 0} bytes)`,
  );
  return null;
}

async function pollOneInbox(
  db: Db,
  setting: TicketEmailSettingDoc,
  imapflowModule: any,
  mailparserModule: any,
): Promise<{ created: number; errors: string[] }> {
  const errors: string[] = [];
  let created = 0;
  if (!setting.imap_host || !setting.email_address || !setting.password) {
    return { created, errors: ['missing-credentials'] };
  }

  // The password is stored encrypted (same envelope as SabFlow
  // credentials). Fall back to using it verbatim for legacy rows.
  let password = setting.password;
  try {
    password = decryptData(setting.password);
  } catch {
    /* not encrypted — use as-is */
  }

  const port = Number(setting.imap_port ?? 993);
  const secure = setting.encryption !== 'none';

  const { ImapFlow } = imapflowModule as { ImapFlow: new (opts: unknown) => any };
  const { simpleParser } = mailparserModule as { simpleParser: (src: unknown) => Promise<ParsedEmail> };

  const client = new ImapFlow({
    host: setting.imap_host,
    port,
    secure,
    auth: { user: setting.email_address, pass: password },
    logger: false,
  });

  try {
    await client.connect();
    const lock = await client.getMailboxLock('INBOX');
    try {
      const lastUid = Number(setting.lastUid ?? 0);
      // UID search for new + unseen messages above the watermark.
      const range = lastUid > 0 ? `${lastUid + 1}:*` : '1:*';
      let highestSeenUid = lastUid;

      for await (const msg of client.fetch(range, {
        uid: true,
        envelope: true,
        source: true,
        flags: true,
      })) {
        try {
          if (msg.uid <= lastUid) continue;
          if (msg.flags && msg.flags.has && msg.flags.has('\\Seen')) {
            // Track the watermark even for already-seen items so we
            // skip them faster on the next poll.
            if (msg.uid > highestSeenUid) highestSeenUid = msg.uid;
            continue;
          }

          const parsed = await simpleParser(msg.source);
          const { email: fromEmail, name: fromName } = extractFromAddress(parsed);
          const subject = (parsed.subject ?? '').slice(0, 240) || '(no subject)';
          const description = bodyToPlainText(parsed).slice(0, 20_000);

          // Per-tenant ticket number.
          const counter = await db.collection('crm_ticket_counters').findOneAndUpdate(
            { userId: setting.userId },
            { $inc: { seq: 1 }, $setOnInsert: { userId: setting.userId } },
            { upsert: true, returnDocument: 'after' },
          );
          const ticketNumber = `T-${(counter as any)?.seq ?? Date.now()}`;

          // Best-effort attachment uploads (no-op until SabFiles server
          // API lands — see uploadAttachmentToSabFiles).
          const attachmentRefs: string[] = [];
          for (const att of parsed.attachments ?? []) {
            const ref = await uploadAttachmentToSabFiles(setting.userId, att);
            if (ref) attachmentRefs.push(ref);
          }

          const ticketDoc = {
            userId: setting.userId,
            ticket_number: ticketNumber,
            subject,
            description,
            status: 'open' as const,
            channel: 'email' as const,
            severity: 'normal' as const,
            priority: 'medium' as const,
            requester_email: fromEmail,
            requester_name: fromName,
            attachments: attachmentRefs,
            source_email_uid: msg.uid,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          await db.collection('crm_tickets').insertOne(ticketDoc);
          created += 1;

          // Mark seen so the next poll skips it.
          await client.messageFlagsAdd(msg.uid, ['\\Seen'], { uid: true });

          if (msg.uid > highestSeenUid) highestSeenUid = msg.uid;
        } catch (msgErr) {
          errors.push(`uid=${msg.uid}: ${(msgErr as Error).message}`);
        }
      }

      // Persist the watermark.
      if (highestSeenUid > lastUid) {
        await db.collection('crm_ticket_email_settings').updateOne(
          { _id: setting._id },
          { $set: { lastUid: highestSeenUid, updatedAt: new Date() } },
        );
      }
    } finally {
      lock.release();
    }
  } finally {
    try {
      await client.logout();
    } catch {
      /* connection already closed */
    }
  }

  return { created, errors };
}

/**
 * Poll every tenant inbox once. Designed to be invoked on a cron schedule
 * (every 5 minutes is a safe default — see
 * `src/lib/cron/jobs/imap-tickets.ts`).
 */
export async function pollImapInbox(): Promise<ImapPollResult> {
  const result: ImapPollResult = {
    processed: 0,
    ticketsCreated: 0,
    inboxesPolled: 0,
    errors: [],
  };

  const imapflowModule = await loadImapflow();
  const mailparserModule = await loadMailparser();
  if (!imapflowModule || !mailparserModule) {
    const msg =
      'IMAP polling requires `imapflow` and `mailparser` packages — install with `npm i imapflow mailparser` then redeploy. Skipping run.';
    console.warn(`[imap-tickets] ${msg}`);
    result.errors.push('dependencies-missing');
    return result;
  }

  const { db } = await connectToDatabase();
  const settings = await db
    .collection<TicketEmailSettingDoc>('crm_ticket_email_settings')
    .find({ is_active: { $ne: false }, imap_host: { $exists: true, $ne: '' } })
    .toArray();

  for (const setting of settings) {
    result.processed += 1;
    try {
      const { created, errors } = await pollOneInbox(
        db,
        setting,
        imapflowModule,
        mailparserModule,
      );
      result.ticketsCreated += created;
      result.inboxesPolled += 1;
      for (const e of errors) {
        result.errors.push(`tenant=${setting.userId.toString()}: ${e}`);
      }
    } catch (err) {
      result.errors.push(
        `tenant=${setting.userId.toString()}: ${(err as Error).message}`,
      );
    }
  }
  return result;
}
