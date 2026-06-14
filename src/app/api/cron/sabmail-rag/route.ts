/**
 * GET/POST /api/cron/sabmail-rag
 *
 * SabMail "Ask your inbox" warm-keeper. The RAG index that powers AI inbox
 * search is otherwise built ONLY when a user clicks the ingest button in the AI
 * surface — so a freshly-arrived message is invisible to "ask your inbox" until
 * someone manually re-ingests. This cron keeps the vector index warm by
 * re-running ingest periodically, ACROSS workspaces.
 *
 * NO cookie / session is involved: this is a cron route, so it operates across
 * workspaces using the `workspaceId` stored on each `kind:'mail'` project and
 * NEVER calls getSabmailWorkspaceId(). For each mail project it loads that
 * workspace's mailbox accounts and drives the workspace-explicit ingest twin
 * (`ingestSabmailInboxForWorkspace`) — which lists the newest INBOX envelopes,
 * fetches each body WITHOUT marking it seen, and upserts the embeddings keyed
 * by `{ workspaceId, accountId, uid }` (idempotent re-runs).
 *
 * Auth mirrors the other SabMail cron routes (sabmail-brief / sabmail-scheduled):
 * accept `Authorization: Bearer $CRON_SECRET` OR `x-cron-secret` header OR
 * `?secret=`. When `CRON_SECRET` is unset the route is open (local/dev).
 *
 * Bounded + defensive: caps the number of mail projects + accounts processed
 * per run, caps messages indexed per account (tighter than the interactive
 * default), and never throws out of the per-account loop — one unreadable
 * mailbox or a missing embeddings key (ingest returns `{ ok:false }`) never
 * aborts the sweep. The response LOGS exactly what each account did.
 *
 * Register to run every few hours in `vercel.json` (Vercel Cron) and the repo
 * cron-worker — e.g. every 6 hours (0 0,6,12,18 * * *).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { ObjectId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { SABMAIL_COLLECTIONS } from '@/lib/sabmail/db/collections';
import { ingestSabmailInboxForWorkspace } from '@/app/sabmail/ai/ingest-actions';
import { getErrorMessage } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

/** Hard cap on `kind:'mail'` projects processed per run (defensive + fast). */
const MAX_PROJECTS = 100;
/** Hard cap on mailbox accounts processed across the whole run. */
const MAX_ACCOUNTS = 200;
/** Messages re-indexed per account per run (tighter than the interactive 40). */
const MESSAGES_PER_ACCOUNT = 20;

interface AccountResult {
  workspaceId: string;
  accountId: string;
  ok: boolean;
  count: number;
  error?: string;
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

async function handle(req: NextRequest): Promise<NextResponse> {
  if (!authorize(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let workspaces = 0;
  let accountsProcessed = 0;
  let chunksIngested = 0;
  const results: AccountResult[] = [];

  try {
    const { db } = await connectToDatabase();

    // Untyped `projects` collection — the `kind` filter isn't expressible in a
    // strict Filter<Project> here (matches the sabmail-brief / workspace
    // resolution pattern).
    const projects = (await db
      .collection('projects')
      .find({ kind: 'mail' })
      .project({ _id: 1 })
      .limit(MAX_PROJECTS)
      .toArray()) as Array<{ _id: unknown }>;

    const accountsCol = db.collection(SABMAIL_COLLECTIONS.accounts);

    for (const project of projects) {
      const workspaceId = String(project._id);
      if (!workspaceId) continue;
      if (accountsProcessed >= MAX_ACCOUNTS) break;
      workspaces += 1;

      let accounts: Array<{ _id: unknown }> = [];
      try {
        accounts = (await accountsCol
          .find({ workspaceId })
          .project({ _id: 1 })
          .limit(MAX_ACCOUNTS - accountsProcessed)
          .toArray()) as Array<{ _id: unknown }>;
      } catch (e) {
        console.error(
          '[sabmail-rag] account lookup failed',
          workspaceId,
          getErrorMessage(e),
        );
        continue;
      }

      for (const account of accounts) {
        if (accountsProcessed >= MAX_ACCOUNTS) break;
        const accountId =
          account._id instanceof ObjectId
            ? account._id.toHexString()
            : String(account._id);
        if (!accountId) continue;
        accountsProcessed += 1;

        try {
          const res = await ingestSabmailInboxForWorkspace(
            workspaceId,
            accountId,
            MESSAGES_PER_ACCOUNT,
          );
          if (res.ok) {
            chunksIngested += res.count;
            results.push({ workspaceId, accountId, ok: true, count: res.count });
            console.log(
              `[sabmail-rag] [OK] ws=${workspaceId} account=${accountId} indexed=${res.count}`,
            );
          } else {
            results.push({
              workspaceId,
              accountId,
              ok: false,
              count: 0,
              error: res.error,
            });
            // Expected, non-fatal: no embeddings key, unreadable mailbox, etc.
            console.warn(
              `[sabmail-rag] [SKIP] ws=${workspaceId} account=${accountId} error=${res.error}`,
            );
          }
        } catch (e) {
          // One bad account never aborts the sweep.
          const error = getErrorMessage(e);
          results.push({ workspaceId, accountId, ok: false, count: 0, error });
          console.error(
            `[sabmail-rag] [FAIL] ws=${workspaceId} account=${accountId}`,
            error,
          );
        }
      }
    }

    console.log(
      `[sabmail-rag] sweep done: workspaces=${workspaces} accounts=${accountsProcessed} chunks=${chunksIngested}`,
    );
    return NextResponse.json({
      ok: true,
      workspaces,
      accountsProcessed,
      chunksIngested,
      results,
    });
  } catch (err) {
    console.error('[sabmail-rag] run error:', err);
    return NextResponse.json(
      {
        ok: false,
        error: getErrorMessage(err),
        workspaces,
        accountsProcessed,
        chunksIngested,
        results,
      },
      { status: 500 },
    );
  }
}

export const GET = handle;
export const POST = handle;
