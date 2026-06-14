/**
 * SabCall "never lose touch" cron heartbeat.
 *
 *   GET /api/cron/sabcall-touch   (run by the SabNode cron worker)
 *
 * For every project with touch automation enabled, count the contacts overdue
 * for a touch (per its cadence + scope) and record `dueCount`/`lastRunAt` so the
 * relationships surface can nudge. Auto-outreach (auto-call/SMS) is the next
 * enhancement; this keeps the due figures fresh without it.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { connectToDatabase } from '@/lib/mongodb';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const presented = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    if (presented !== secret) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
  }

  const { db } = await connectToDatabase();
  const settings = await db
    .collection('sabcall_touch_settings')
    .find({ enabled: true })
    .toArray();

  let workspaces = 0;
  let totalDue = 0;
  for (const s of settings) {
    workspaces += 1;
    const cadence = Number(s.cadenceDays ?? 30);
    const cutoff = new Date(Date.now() - cadence * 86_400_000);
    const filter: Record<string, unknown> = {
      userId: s.userId,
      status: 'active',
      $or: [
        { lastTouchedAt: { $exists: false } },
        { lastTouchedAt: null },
        { lastTouchedAt: { $lt: cutoff } },
      ],
    };
    if (s.scope !== 'all') filter.vip = true;
    const dueCount = await db.collection('sabcall_contacts').countDocuments(filter);
    totalDue += dueCount;
    await db
      .collection('sabcall_touch_settings')
      .updateOne({ _id: s._id }, { $set: { dueCount, lastRunAt: new Date() } });
  }

  return NextResponse.json({ ok: true, workspaces, totalDue });
}
