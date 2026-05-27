import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';

import { authenticateAgent } from '../_lib/token-guard';
import { connectToDatabase } from '@/lib/mongodb';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * `GET /api/sabops/agent/commands`
 *
 * Returns the queued MDM commands for the calling agent's endpoint, and
 * flips them to `status: "sent"` atomically.
 */
export async function GET(req: Request) {
    const session = await authenticateAgent(req);
    if (!session || !session.endpointId) {
        return NextResponse.json({ error: 'agent_not_enrolled' }, { status: 401 });
    }

    const { db } = await connectToDatabase();
    const filter = {
        userId: session.tenantUserId,
        endpointId: session.endpointId,
        status: 'queued',
    };
    const rows = await db
        .collection('sabops_mdm_commands')
        .find(filter)
        .sort({ issuedAt: 1 })
        .limit(50)
        .toArray();

    if (rows.length > 0) {
        const ids = rows.map((r) => r._id as ObjectId);
        await db
            .collection('sabops_mdm_commands')
            .updateMany({ _id: { $in: ids } }, { $set: { status: 'sent' } });
    }

    return NextResponse.json({ commands: rows });
}
