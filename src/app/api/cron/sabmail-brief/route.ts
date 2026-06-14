/**
 * GET/POST /api/cron/sabmail-brief
 *
 * SabMail "Daily Brief" — a per-workspace morning activity digest computed
 * entirely from Mongo. NO IMAP / OAuth / cookie is involved: this is a cron
 * route and therefore has no session, so it operates ACROSS workspaces using
 * the `workspaceId` stored on each doc and NEVER calls getSabmailWorkspaceId().
 *
 * For each `kind:'mail'` project it computes, scoped by that project's
 * `workspaceId`:
 *   · campaigns → recent sends summed (sent / failed) + recent sent/failed count
 *   · events    → recent bounces / complaints / opens
 *   · scheduled → upcoming pending sends
 *   · inbox     → a lightweight recent-unread digest across the workspace's
 *                 active mailboxes (top unread subjects/senders) so the brief
 *                 says "what needs attention in your inbox", not just ops stats
 *
 * The inbox digest is intentionally COOKIE-FREE: this route has no session, so
 * it MUST NOT import the cookie-bound inbox server actions (which call
 * `getSabmailWorkspaceId()`). Instead it reads the `sabmail_messages` cache
 * collection directly — the same cache the IMAP sync worker
 * (`src/workers/sabmail-sync.ts`) and the hosted inbound webhook populate —
 * filtered by `{ workspaceId, accountId, seen:false }`, newest-first.
 *
 * Optionally summarises the stats + inbox with `sabmailLlm` (skipped if it
 * returns not-ok — e.g. no provider key). Each digest is stored as a single
 * doc in `SABMAIL_COLLECTIONS.events`:
 *   { workspaceId, event: 'brief', summary, stats, inbox, ts }
 *
 * Auth mirrors the other SabMail cron routes: accept
 * `Authorization: Bearer $CRON_SECRET` OR `x-cron-secret` header OR `?secret=`.
 * When `CRON_SECRET` is unset the route is open (local/dev).
 *
 * Register to run DAILY in `vercel.json` (Vercel Cron) and/or the repo
 * cron-worker — e.g. once each morning.
 *
 * Defensive + fast: caps the number of projects processed per run, uses short
 * lookback windows, and never throws out of the per-workspace loop.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { connectToDatabase } from '@/lib/mongodb';
import { SABMAIL_COLLECTIONS } from '@/lib/sabmail/db/collections';
import { sabmailLlm } from '@/lib/sabmail/ai';
import { getErrorMessage } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

/** Hard cap on `kind:'mail'` projects processed per run (defensive + fast). */
const MAX_PROJECTS = 200;
/** Lookback window for "recent" campaign/event activity. */
const RECENT_WINDOW_MS = 24 * 60 * 60 * 1000;
/** Upper bound for "upcoming" scheduled sends surfaced in the brief. */
const UPCOMING_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Hard cap on active mailboxes inspected per workspace (defensive + fast). */
const MAX_ACCOUNTS_PER_WORKSPACE = 25;
/** How many unread messages to surface in the inbox digest. */
const MAX_UNREAD_SAMPLE = 10;
/** Max length of a subject/sender string fed into the prompt (token budget). */
const MAX_FIELD_LEN = 120;

interface BriefStats {
  campaignsRecentSent: number;
  campaignsRecentFailed: number;
  campaignsTotalSentUnits: number;
  campaignsTotalFailedUnits: number;
  bounces: number;
  complaints: number;
  opens: number;
  upcomingScheduled: number;
}

/** A single unread message surfaced in the inbox digest. */
interface UnreadItem {
  /** The mailbox this unread landed in. */
  account: string;
  from: string;
  subject: string;
}

/** Lightweight, cookie-free recent-unread summary for one workspace. */
interface InboxDigest {
  /** Total unread across the workspace's active mailboxes (>= sample.length). */
  unreadTotal: number;
  /** Number of active mailboxes inspected. */
  accountsActive: number;
  /** Newest unread messages (capped at MAX_UNREAD_SAMPLE). */
  sample: UnreadItem[];
}

interface BriefResult {
  workspaceId: string;
  stats: BriefStats;
  inbox: InboxDigest;
  summary: string | null;
  stored: boolean;
}

function num(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function authorize(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return true; // not configured → open (local/dev)
  const auth = req.headers.get('authorization') ?? '';
  if (auth === `Bearer ${expected}`) return true;
  const header = req.headers.get('x-cron-secret') ?? '';
  if (header === expected) return true;
  const query = new URL(req.url).searchParams.get('secret') ?? '';
  return query === expected;
}

/**
 * Compute the Mongo-only digest for a single workspace. Defensive: each query
 * is independently guarded so a malformed collection can't sink the brief.
 */
async function computeStats(
  db: Awaited<ReturnType<typeof connectToDatabase>>['db'],
  workspaceId: string,
  since: Date,
  upcomingUntil: Date,
): Promise<BriefStats> {
  const campaignsCol = db.collection(SABMAIL_COLLECTIONS.campaigns);
  const eventsCol = db.collection(SABMAIL_COLLECTIONS.events);
  const scheduledCol = db.collection(SABMAIL_COLLECTIONS.scheduled);

  const stats: BriefStats = {
    campaignsRecentSent: 0,
    campaignsRecentFailed: 0,
    campaignsTotalSentUnits: 0,
    campaignsTotalFailedUnits: 0,
    bounces: 0,
    complaints: 0,
    opens: 0,
    upcomingScheduled: 0,
  };

  // Campaigns: recent sent/failed campaign counts + summed delivery units.
  try {
    const [recentSent, recentFailed, totals] = await Promise.all([
      campaignsCol.countDocuments({
        workspaceId,
        status: 'sent',
        $or: [{ sentAt: { $gte: since } }, { createdAt: { $gte: since } }],
      }),
      campaignsCol.countDocuments({
        workspaceId,
        status: 'failed',
        $or: [{ sentAt: { $gte: since } }, { createdAt: { $gte: since } }],
      }),
      campaignsCol
        .aggregate<{ sent: number; failed: number }>([
          { $match: { workspaceId, createdAt: { $gte: since } } },
          {
            $group: {
              _id: null,
              // Support both flat (`sent`) and nested (`stats.sent`) shapes.
              sent: {
                $sum: {
                  $add: [
                    { $ifNull: ['$stats.sent', 0] },
                    { $ifNull: ['$sent', 0] },
                  ],
                },
              },
              failed: {
                $sum: {
                  $add: [
                    { $ifNull: ['$stats.failed', 0] },
                    { $ifNull: ['$failed', 0] },
                  ],
                },
              },
            },
          },
        ])
        .toArray(),
    ]);
    stats.campaignsRecentSent = recentSent;
    stats.campaignsRecentFailed = recentFailed;
    const agg = totals[0] ?? { sent: 0, failed: 0 };
    stats.campaignsTotalSentUnits = num(agg.sent);
    stats.campaignsTotalFailedUnits = num(agg.failed);
  } catch (e) {
    console.error('[sabmail-brief] campaign stats failed', workspaceId, getErrorMessage(e));
  }

  // Events: recent bounces / complaints / opens. The `event` field is the
  // discriminator; we also accept a `type` alias defensively.
  try {
    const [bounces, complaints, opens] = await Promise.all([
      eventsCol.countDocuments({
        workspaceId,
        ts: { $gte: since },
        $or: [{ event: 'bounce' }, { type: 'bounce' }],
      }),
      eventsCol.countDocuments({
        workspaceId,
        ts: { $gte: since },
        $or: [{ event: 'complaint' }, { type: 'complaint' }],
      }),
      eventsCol.countDocuments({
        workspaceId,
        ts: { $gte: since },
        $or: [{ event: 'open' }, { type: 'open' }],
      }),
    ]);
    stats.bounces = bounces;
    stats.complaints = complaints;
    stats.opens = opens;
  } catch (e) {
    console.error('[sabmail-brief] event stats failed', workspaceId, getErrorMessage(e));
  }

  // Scheduled: upcoming pending sends in the look-ahead window.
  try {
    stats.upcomingScheduled = await scheduledCol.countDocuments({
      workspaceId,
      status: 'pending',
      sendAt: { $gte: new Date(), $lte: upcomingUntil },
    });
  } catch (e) {
    console.error('[sabmail-brief] scheduled stats failed', workspaceId, getErrorMessage(e));
  }

  return stats;
}

function clip(value: unknown, fallback = ''): string {
  const s = (typeof value === 'string' ? value : value == null ? '' : String(value)).trim();
  const out = s || fallback;
  return out.length > MAX_FIELD_LEN ? `${out.slice(0, MAX_FIELD_LEN - 1)}…` : out;
}

/**
 * Lightweight, COOKIE-FREE recent-unread digest for one workspace.
 *
 * Resolves the workspace's active mailboxes from `sabmail_accounts`
 * (`status:'active'`) and reads the `sabmail_messages` cache directly for
 * `{ workspaceId, accountId, seen:false }`, newest-first. This deliberately
 * avoids the cookie-bound inbox actions (no live IMAP/OAuth fetch) — it only
 * consults the cache the sync worker + hosted webhook already populate, so it
 * stays fast and never opens a network connection.
 *
 * Best-effort throughout: any query failure degrades to an empty digest rather
 * than throwing, so a single bad collection can't sink the brief.
 */
async function computeInboxDigest(
  db: Awaited<ReturnType<typeof connectToDatabase>>['db'],
  workspaceId: string,
): Promise<InboxDigest> {
  const digest: InboxDigest = { unreadTotal: 0, accountsActive: 0, sample: [] };

  let accounts: Array<{ _id: unknown; email?: unknown }> = [];
  try {
    accounts = (await db
      .collection(SABMAIL_COLLECTIONS.accounts)
      .find({ workspaceId, status: 'active' })
      .project({ _id: 1, email: 1 })
      .limit(MAX_ACCOUNTS_PER_WORKSPACE)
      .toArray()) as Array<{ _id: unknown; email?: unknown }>;
  } catch (e) {
    console.error('[sabmail-brief] account lookup failed', workspaceId, getErrorMessage(e));
    return digest;
  }
  digest.accountsActive = accounts.length;
  if (accounts.length === 0) return digest;

  const accountIds = accounts.map((a) => String(a._id));
  const emailById = new Map(accounts.map((a) => [String(a._id), clip(a.email, 'inbox')]));

  const messagesCol = db.collection(SABMAIL_COLLECTIONS.messages);

  // Total unread count across the active mailboxes.
  try {
    digest.unreadTotal = await messagesCol.countDocuments({
      workspaceId,
      accountId: { $in: accountIds },
      seen: false,
    });
  } catch (e) {
    console.error('[sabmail-brief] unread count failed', workspaceId, getErrorMessage(e));
  }

  // Newest-first sample of unread subjects/senders. `date` is the message date
  // (worker + persisted-store shape); fall back to `syncedAt` when absent.
  try {
    const docs = (await messagesCol
      .find({ workspaceId, accountId: { $in: accountIds }, seen: false })
      .project({ accountId: 1, subject: 1, fromName: 1, fromEmail: 1, date: 1, syncedAt: 1 })
      .sort({ date: -1, syncedAt: -1 })
      .limit(MAX_UNREAD_SAMPLE)
      .toArray()) as Array<{
      accountId?: unknown;
      subject?: unknown;
      fromName?: unknown;
      fromEmail?: unknown;
    }>;
    digest.sample = docs.map((d) => {
      const name = clip(d.fromName);
      const email = clip(d.fromEmail);
      const from = name && email ? `${name} <${email}>` : name || email || 'unknown sender';
      return {
        account: emailById.get(String(d.accountId)) ?? 'inbox',
        from: clip(from, 'unknown sender'),
        subject: clip(d.subject, '(no subject)'),
      };
    });
    // If the count query failed but we have a sample, reflect at least the sample.
    if (digest.unreadTotal < digest.sample.length) digest.unreadTotal = digest.sample.length;
  } catch (e) {
    console.error('[sabmail-brief] unread sample failed', workspaceId, getErrorMessage(e));
  }

  return digest;
}

/** Build the LLM prompt body from the computed stats + inbox digest. */
function statsPrompt(stats: BriefStats, inbox: InboxDigest): string {
  const lines = [
    'Activity in the last 24 hours for one email workspace:',
    `- Campaigns sent: ${stats.campaignsRecentSent}`,
    `- Campaigns failed: ${stats.campaignsRecentFailed}`,
    `- Messages delivered (units): ${stats.campaignsTotalSentUnits}`,
    `- Delivery failures (units): ${stats.campaignsTotalFailedUnits}`,
    `- Bounces: ${stats.bounces}`,
    `- Spam complaints: ${stats.complaints}`,
    `- Opens: ${stats.opens}`,
    `- Upcoming scheduled sends (next 24h): ${stats.upcomingScheduled}`,
    '',
    `Inbox: ${inbox.unreadTotal} unread across ${inbox.accountsActive} active mailbox(es).`,
  ];

  if (inbox.sample.length > 0) {
    lines.push('Most recent unread messages (newest first):');
    for (const item of inbox.sample) {
      lines.push(`- [${item.account}] ${item.from} — ${item.subject}`);
    }
  } else {
    lines.push('No unread messages waiting in the connected mailboxes.');
  }

  lines.push(
    '',
    'Write a 2-3 sentence morning brief for the team. Cover both the sending stats AND what needs attention in the inbox (call out notable unread senders/subjects). Be concrete, flag anything that needs attention (bounces/complaints/urgent-looking unread mail), and stay neutral if it was a quiet day.',
  );

  return lines.join('\n');
}

async function handle(req: NextRequest): Promise<NextResponse> {
  if (!authorize(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let workspaces = 0;
  const briefs: BriefResult[] = [];

  try {
    const { db } = await connectToDatabase();
    const now = Date.now();
    const since = new Date(now - RECENT_WINDOW_MS);
    const upcomingUntil = new Date(now + UPCOMING_WINDOW_MS);

    // Untyped `projects` collection — the `kind` filter isn't expressible in a
    // strict Filter<Project> here, matching the workspace-resolution pattern.
    const projects = (await db
      .collection('projects')
      .find({ kind: 'mail' })
      .project({ _id: 1 })
      .limit(MAX_PROJECTS)
      .toArray()) as Array<{ _id: unknown }>;

    for (const project of projects) {
      const workspaceId = String(project._id);
      if (!workspaceId) continue;
      workspaces += 1;

      try {
        const [stats, inbox] = await Promise.all([
          computeStats(db, workspaceId, since, upcomingUntil),
          computeInboxDigest(db, workspaceId),
        ]);

        let summary: string | null = null;
        const llm = await sabmailLlm({
          system:
            'You are an email operations assistant. You write terse, useful daily briefs covering both sending health and the inbox. No fluff, no markdown headers.',
          prompt: statsPrompt(stats, inbox),
          maxTokens: 320,
        });
        if (llm.ok) summary = llm.text.trim();

        const ts = new Date();
        let stored = false;
        try {
          await db.collection(SABMAIL_COLLECTIONS.events).insertOne({
            workspaceId,
            event: 'brief',
            summary,
            stats,
            inbox,
            ts,
          });
          stored = true;
        } catch (e) {
          console.error('[sabmail-brief] store failed', workspaceId, getErrorMessage(e));
        }

        briefs.push({ workspaceId, stats, inbox, summary, stored });
      } catch (e) {
        console.error('[sabmail-brief] workspace failed', workspaceId, getErrorMessage(e));
      }
    }

    return NextResponse.json({ workspaces, briefs });
  } catch (err) {
    console.error('[sabmail-brief] run error:', err);
    return NextResponse.json(
      { ok: false, error: getErrorMessage(err), workspaces, briefs },
      { status: 500 },
    );
  }
}

export const GET = handle;
export const POST = handle;
