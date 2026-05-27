import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';

import { authenticateAgent } from '../_lib/token-guard';
import { connectToDatabase } from '@/lib/mongodb';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * `POST /api/sabops/agent/ack`
 *
 * Body: `{ commandId: string, success: boolean, message?: string }`
 *
 * Marks an MDM command `acknowledged` (success=true) or `failed`. Raises
 * an alert on failure.
 */
export async function POST(req: Request) {
    const session = await authenticateAgent(req);
    if (!session || !session.endpointId) {
        return NextResponse.json({ error: 'agent_not_enrolled' }, { status: 401 });
    }

    let body: { commandId?: string; success?: boolean; message?: string };
    try {
        body = (await req.json()) ?? {};
    } catch {
        return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
    }
    if (!body.commandId) {
        return NextResponse.json({ error: 'commandId is required' }, { status: 400 });
    }

    let commandOid: ObjectId;
    try {
        commandOid = new ObjectId(body.commandId);
    } catch {
        return NextResponse.json({ error: 'invalid commandId' }, { status: 400 });
    }

    const now = new Date();
    const { db } = await connectToDatabase();
    const newStatus = body.success === false ? 'failed' : 'acknowledged';
    const result = await db.collection('sabops_mdm_commands').updateOne(
        {
            _id: commandOid,
            userId: session.tenantUserId,
            endpointId: session.endpointId,
        },
        { $set: { status: newStatus, ackedAt: now } },
    );
    if (result.matchedCount === 0) {
        return NextResponse.json({ error: 'command_not_found' }, { status: 404 });
    }

    // Raise an alert on failure so the dashboard surfaces it.
    if (newStatus === 'failed') {
        await db.collection('sabops_alerts').insertOne({
            userId: session.tenantUserId,
            endpointId: session.endpointId,
            kind: 'patch_failed',
            severity: 'high',
            message: body.message ?? 'MDM command execution failed',
            raisedAt: now,
        });
    }

    return NextResponse.json({ acknowledged: true });
}
