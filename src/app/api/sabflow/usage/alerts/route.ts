import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/app/actions/user.actions';
import { connectToDatabase } from '@/lib/mongodb';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  const userId = (session.user as { _id: { toString(): string } })._id.toString();

  try {
    const { db } = await connectToDatabase();
    const config = await db.collection('sabflow_usage_alerts').findOne({ userId });

    return NextResponse.json({
      enabled: config?.enabled ?? false,
      thresholds: {
        runs: config?.thresholds?.runs ?? 1000,
        errors: config?.thresholds?.errors ?? 100,
      },
      emails: config?.emails ?? [],
    });
  } catch (err) {
    console.error('[SABFLOW ALERTS GET] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  const userId = (session.user as { _id: { toString(): string } })._id.toString();

  try {
    const body = await req.json();
    const { enabled, thresholds, emails } = body;

    const { db } = await connectToDatabase();
    
    await db.collection('sabflow_usage_alerts').updateOne(
      { userId },
      {
        $set: {
          enabled: Boolean(enabled),
          thresholds: {
            runs: Number(thresholds?.runs ?? 1000),
            errors: Number(thresholds?.errors ?? 100),
          },
          emails: Array.isArray(emails) ? emails.map(String) : [],
          updatedAt: new Date(),
        },
      },
      { upsert: true }
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[SABFLOW ALERTS POST] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
