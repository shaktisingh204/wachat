/**
 * SabMail push renewal cron.
 *
 * Re-arms Gmail `users.watch` (expires ~7 days) and renews Microsoft Graph
 * subscriptions (expire ~3 days) before they lapse, so connected mailboxes keep
 * receiving real-time push. Idempotent + best-effort per account; one bad
 * account never fails the batch. No-op when no OAuth accounts exist.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { connectToDatabase } from '@/lib/mongodb';
import { SABMAIL_COLLECTIONS } from '@/lib/sabmail/db/collections';
import { decryptMailboxCreds } from '@/lib/sabmail/credentials';
import {
  registerGmailWatch,
  renewGraphSubscription,
} from '@/lib/sabmail/push-registration';
import type { SabmailAccount } from '@/lib/sabmail/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

/** Renew Graph subs this close to (or past) expiry. */
const GRAPH_RENEW_WINDOW_MS = 24 * 60 * 60 * 1000;

function authorize(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return true; // open in dev
  const auth = req.headers.get('authorization') ?? '';
  if (auth === `Bearer ${expected}`) return true;
  if ((req.headers.get('x-cron-secret') ?? '') === expected) return true;
  return (new URL(req.url).searchParams.get('secret') ?? '') === expected;
}

async function handle(req: NextRequest): Promise<NextResponse> {
  if (!authorize(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { db } = await connectToDatabase();
    const col = db.collection<SabmailAccount>(SABMAIL_COLLECTIONS.accounts);
    const accounts = await col
      .find({ provider: { $in: ['gmail', 'outlook'] }, status: 'active' })
      .limit(1000)
      .toArray();

    let gmail = 0;
    let outlook = 0;
    let skipped = 0;
    const errors: string[] = [];
    const now = Date.now();

    for (const acct of accounts) {
      if (!acct.credentialsCipher) {
        skipped += 1;
        continue;
      }
      let refreshToken: string;
      try {
        const creds = decryptMailboxCreds(acct.workspaceId, acct.credentialsCipher);
        refreshToken = String(creds.refreshToken ?? '');
      } catch {
        skipped += 1;
        continue;
      }
      if (!refreshToken) {
        skipped += 1;
        continue;
      }

      try {
        if (acct.provider === 'gmail') {
          const r = await registerGmailWatch(refreshToken);
          if (r.ok) {
            gmail += 1;
            await col.updateOne(
              { _id: acct._id },
              {
                $set: {
                  ...(r.historyId ? { syncCursor: r.historyId } : {}),
                  pushRenewedAt: new Date(),
                  updatedAt: new Date(),
                },
              },
            );
          } else if (!r.skipped && r.error) {
            errors.push(`gmail ${acct.email}: ${r.error}`);
          } else {
            skipped += 1;
          }
        } else {
          const expiresAt = acct.graphSubscriptionExpiry ? Date.parse(acct.graphSubscriptionExpiry) : 0;
          const dueSoon = !acct.graphSubscriptionId || !expiresAt || expiresAt - now < GRAPH_RENEW_WINDOW_MS;
          if (!dueSoon) {
            skipped += 1;
            continue;
          }
          const r = await renewGraphSubscription(refreshToken, acct.graphSubscriptionId ?? '');
          if (r.ok && r.subscriptionId && r.expiry) {
            outlook += 1;
            await col.updateOne(
              { _id: acct._id },
              {
                $set: {
                  graphSubscriptionId: r.subscriptionId,
                  graphSubscriptionExpiry: r.expiry,
                  pushRenewedAt: new Date(),
                  updatedAt: new Date(),
                },
              },
            );
          } else if (!r.skipped && r.error) {
            errors.push(`outlook ${acct.email}: ${r.error}`);
          } else {
            skipped += 1;
          }
        }
      } catch (err) {
        errors.push(`${acct.provider} ${acct.email}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return NextResponse.json({
      ok: true,
      scanned: accounts.length,
      gmailRearmed: gmail,
      outlookRenewed: outlook,
      skipped,
      errors: errors.slice(0, 20),
    });
  } catch (err) {
    console.error('[sabmail-watch-renewal] error:', err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

export const GET = handle;
export const POST = handle;
