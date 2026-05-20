/**
 * Forge block: Email Read IMAP (port of EmailReadImap as a one-shot fetch action)
 *
 * Source: n8n-master/packages/nodes-base/nodes/EmailReadImap/EmailReadImap.node.ts
 *
 * Note: n8n's runtime trigger semantics don't apply here — this port is for
 * catalog parity. The original node polls an IMAP mailbox continuously; this
 * action performs a single fetch of the latest unread messages and returns
 * their metadata + body. Continuous polling should live in
 * src/lib/sabflow/triggers/ instead.
 *
 * The `imapflow` package is loaded dynamically; install it with
 *   pnpm add imapflow
 * before using this block. We throw a helpful error if it is missing.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { asBoolean, asNumber, asString } from '../_shared/http';

type ImapFlowLike = new (config: Record<string, unknown>) => {
  connect: () => Promise<void>;
  logout: () => Promise<void>;
  mailboxOpen: (mailbox: string, options?: Record<string, unknown>) => Promise<unknown>;
  search: (query: Record<string, unknown>) => Promise<number[] | false>;
  fetch: (range: string | number[], options: Record<string, unknown>) => AsyncIterable<{
    uid?: number;
    seq?: number;
    envelope?: {
      subject?: string;
      from?: Array<{ name?: string; address?: string }>;
      to?: Array<{ name?: string; address?: string }>;
      date?: Date | string;
      messageId?: string;
    };
    source?: Buffer;
    flags?: Set<string>;
  }>;
};

async function loadImapFlow(): Promise<ImapFlowLike> {
  try {
    // imapflow is an optional peer. We hide the import from the bundler's
    // static analyzer with a Function-constructed dynamic import so neither
    // webpack nor Turbopack traces the module at build time. Resolves at
    // runtime; throws below if the package isn't installed.
    const dyn = new Function('m', 'return import(m)') as (s: string) => Promise<unknown>;
    const mod = (await dyn('imapflow')) as { ImapFlow?: ImapFlowLike };
    if (!mod.ImapFlow) {
      throw new Error('imapflow loaded but ImapFlow export is missing');
    }
    return mod.ImapFlow;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Email Read IMAP: dependency "imapflow" is not installed (${message}). Run \`npm install imapflow\` and retry.`,
    );
  }
}

async function fetchUnread(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const host = asString(ctx.options.host);
  const portRaw = asNumber(ctx.options.port);
  const secure = asBoolean(ctx.options.secure);
  const user = asString(ctx.options.user);
  const password = asString(ctx.options.password);
  const mailbox = asString(ctx.options.mailbox) || 'INBOX';
  const limit = Math.min(Math.max(asNumber(ctx.options.limit) ?? 10, 1), 100);

  if (!host) throw new Error('Email Read IMAP: host is required');
  if (!user) throw new Error('Email Read IMAP: user is required');
  if (!password) throw new Error('Email Read IMAP: password is required');
  const port = portRaw ?? (secure ? 993 : 143);

  const ImapFlow = await loadImapFlow();
  const client = new ImapFlow({
    host,
    port,
    secure,
    auth: { user, pass: password },
    logger: false,
  });

  const messages: Array<Record<string, unknown>> = [];
  try {
    await client.connect();
    await client.mailboxOpen(mailbox, { readOnly: true });
    const uids = await client.search({ seen: false });
    const list = Array.isArray(uids) ? uids.slice(-limit) : [];
    if (list.length > 0) {
      for await (const msg of client.fetch(list, { envelope: true, source: true, flags: true })) {
        messages.push({
          uid: msg.uid,
          seq: msg.seq,
          subject: msg.envelope?.subject ?? '',
          from: msg.envelope?.from ?? [],
          to: msg.envelope?.to ?? [],
          date: msg.envelope?.date ?? null,
          messageId: msg.envelope?.messageId ?? '',
          body: msg.source ? msg.source.toString('utf8') : '',
          flags: msg.flags ? [...msg.flags] : [],
        });
      }
    }
  } finally {
    try {
      await client.logout();
    } catch {
      // ignore logout errors
    }
  }

  return {
    outputs: { messages, count: messages.length, mailbox },
    logs: [`Email Read IMAP fetch_unread → ${messages.length} message(s) from ${mailbox}@${host}`],
  };
}

const block: ForgeBlock = {
  id: 'forge_email_read_imap',
  name: 'Email Read IMAP',
  description: 'Fetch the latest unread IMAP messages once. Continuous polling lives in the trigger system.',
  iconName: 'LuMail',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'fetch_unread',
      label: 'Fetch unread',
      description: 'Connect to IMAP and return the latest unread messages with body text.',
      fields: [
        { id: 'host', label: 'Host', type: 'text', required: true, placeholder: 'imap.gmail.com' },
        { id: 'port', label: 'Port', type: 'number', defaultValue: 993 },
        { id: 'secure', label: 'TLS', type: 'toggle', defaultValue: true },
        { id: 'user', label: 'User', type: 'text', required: true },
        { id: 'password', label: 'Password / App password', type: 'password', required: true },
        { id: 'mailbox', label: 'Mailbox', type: 'text', defaultValue: 'INBOX' },
        { id: 'limit', label: 'Limit (1-100)', type: 'number', defaultValue: 10 },
      ],
      run: fetchUnread,
    },
  ],
};

registerForgeBlock(block);
export default block;
