import { NextResponse } from 'next/server';

import { authenticateAgent } from '../_lib/token-guard';
import { connectToDatabase } from '@/lib/mongodb';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * `POST /api/sabops/agent/heartbeat`
 *
 * Body: `{ osVersion?, agentVersion?, ipAddress?, healthScore? }`
 *
 * Updates `lastSeenAt` and sets `status = online` for the endpoint owning
 * the bearer token. Returns the recommended next-heartbeat interval and
 * the pending-command count so the agent can short-poll commands when it
 * sees work waiting.
 */
export async function POST(req: Request) {
    const session = await authenticateAgent(req);
    if (!session || !session.endpointId) {
        return NextResponse.json({ error: 'agent_not_enrolled' }, { status: 401 });
    }

    let body: {
        osVersion?: string;
        agentVersion?: string;
        ipAddress?: string;
        healthScore?: number;
    } = {};
    try {
        body = (await req.json()) ?? {};
    } catch {
        /* empty body is fine */
    }

    const now = new Date();
    const { db } = await connectToDatabase();
    const setDoc: Record<string, unknown> = {
        lastSeenAt: now,
        status: 'online',
        updatedAt: now,
    };
    if (body.osVersion) setDoc.osVersion = body.osVersion;
    if (body.agentVersion) setDoc.agentVersion = body.agentVersion;
    if (body.ipAddress) setDoc.ipAddress = body.ipAddress;
    if (typeof body.healthScore === 'number') {
        setDoc.healthScore = Math.max(0, Math.min(100, Math.floor(body.healthScore)));
    }

    await db
        .collection('sabops_endpoints')
        .updateOne(
            { _id: session.endpointId, userId: session.tenantUserId },
            { $set: setDoc },
        );

    const pendingCommands = await db.collection('sabops_mdm_commands').countDocuments({
        endpointId: session.endpointId,
        userId: session.tenantUserId,
        status: { $in: ['queued', 'sent'] },
    });

    return NextResponse.json({
        accepted: true,
        nextIntervalSeconds: 60,
        pendingCommands,
    });
}
