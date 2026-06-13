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
 * Optionally summarises the stats with `sabmailLlm` (skipped if it returns
 * not-ok — e.g. no provider key). Each digest is stored as a single doc in
 * `SABMAIL_COLLECTIONS.events`:
 *   { workspaceId, event: 'brief', summary, stats, ts }
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

interface BriefResult {
  workspaceId: string;
  stats: BriefStats;
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

/** Build the LLM prompt body from the computed stats. */
function statsPrompt(stats: BriefStats): string {
  return [
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
    'Write a 2-3 sentence morning brief for the team. Be concrete, flag anything that needs attention (bounces/complaints), and stay neutral if it was a quiet day.',
  ].join('\n');
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
        const stats = await computeStats(db, workspaceId, since, upcomingUntil);

        let summary: string | null = null;
        const llm = await sabmailLlm({
          system:
            'You are an email operations assistant. You write terse, useful daily briefs. No fluff, no markdown headers.',
          prompt: statsPrompt(stats),
          maxTokens: 256,
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
            ts,
          });
          stored = true;
        } catch (e) {
          console.error('[sabmail-brief] store failed', workspaceId, getErrorMessage(e));
        }

        briefs.push({ workspaceId, stats, summary, stored });
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
