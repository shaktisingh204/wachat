'use server';

import { connectToDatabase } from '@/lib/mongodb';
import { getSabmailWorkspaceId } from '@/lib/sabmail/workspace';
import { SABMAIL_COLLECTIONS } from '@/lib/sabmail/db/collections';
import { getErrorMessage } from '@/lib/utils';

/* ──────────────────────────────────────────────────────────────────────
 * SabMail analytics — read-only dashboard aggregation.
 *
 * Reads from EXISTING collections only (no writes, no new collection):
 *   · campaigns  → total count, summed `sent` / `failed`, recent rows
 *   · accounts   → connected mailbox count
 *   · contacts   → contact count
 *
 * Every query is scoped by the active workspace (`{ workspaceId }`); a single
 * `Result<T>` discriminated union mirrors the inbox actions pattern.
 * ──────────────────────────────────────────────────────────────────── */

type Result<T> = ({ ok: true } & T) | { ok: false; error: string };

export interface SabmailAnalyticsKpis {
  campaigns: number;
  sent: number;
  failed: number;
  accounts: number;
  contacts: number;
}

export interface SabmailRecentCampaign {
  id: string;
  name: string;
  status: string;
  sent: number;
  failed: number;
  createdAt: string | null;
}

/** Loose shape for a campaign doc — only the fields this dashboard reads. */
interface CampaignDoc {
  _id: unknown;
  name?: unknown;
  status?: unknown;
  sent?: unknown;
  failed?: unknown;
  createdAt?: unknown;
}

function num(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function toIso(value: unknown): string | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value as string | number);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export async function getSabmailAnalytics(): Promise<
  Result<{
    kpis: SabmailAnalyticsKpis;
    recentCampaigns: SabmailRecentCampaign[];
  }>
> {
  const workspaceId = await getSabmailWorkspaceId();
  if (!workspaceId) return { ok: false, error: 'No active SabMail project.' };

  try {
    const { db } = await connectToDatabase();
    const campaignsCol = db.collection(SABMAIL_COLLECTIONS.campaigns);
    const accountsCol = db.collection(SABMAIL_COLLECTIONS.accounts);
    const contactsCol = db.collection(SABMAIL_COLLECTIONS.contacts);

    const [campaignCount, accounts, contacts, totals, recentDocs] =
      await Promise.all([
        campaignsCol.countDocuments({ workspaceId }),
        accountsCol.countDocuments({ workspaceId, status: 'active' }),
        contactsCol.countDocuments({ workspaceId }),
        campaignsCol
          .aggregate<{ sent: number; failed: number }>([
            { $match: { workspaceId } },
            {
              $group: {
                _id: null,
                sent: { $sum: { $ifNull: ['$sent', 0] } },
                failed: { $sum: { $ifNull: ['$failed', 0] } },
              },
            },
          ])
          .toArray(),
        campaignsCol
          .find({ workspaceId })
          .sort({ createdAt: -1 })
          .limit(8)
          .toArray(),
      ]);

    const agg = totals[0] ?? { sent: 0, failed: 0 };

    const recentCampaigns: SabmailRecentCampaign[] = (
      recentDocs as unknown as CampaignDoc[]
    ).map((d) => ({
      id: String(d._id),
      name: typeof d.name === 'string' && d.name.trim() ? d.name : 'Untitled campaign',
      status: typeof d.status === 'string' && d.status ? d.status : 'draft',
      sent: num(d.sent),
      failed: num(d.failed),
      createdAt: toIso(d.createdAt),
    }));

    return {
      ok: true,
      kpis: {
        campaigns: campaignCount,
        sent: num(agg.sent),
        failed: num(agg.failed),
        accounts,
        contacts,
      },
      recentCampaigns,
    };
  } catch (e) {
    return { ok: false, error: getErrorMessage(e) };
  }
}
