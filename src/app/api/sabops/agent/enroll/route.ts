import { NextResponse } from 'next/server';

import { authenticateAgent } from '../_lib/token-guard';
import { redeemSabopsAgentToken } from '@/app/actions/sabops.actions';
import type { SabopsOs } from '@/lib/rust-client/sabops-endpoints';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * `POST /api/sabops/agent/enroll`
 *
 * Body: `{ hostname, os, osVersion?, agentVersion?, macAddress?, serialNumber?, model? }`
 *
 * Headers: `Authorization: Bearer <agent-token>`
 */
export async function POST(req: Request) {
    const session = await authenticateAgent(req);
    if (!session) {
        return NextResponse.json({ error: 'invalid_agent_token' }, { status: 401 });
    }

    let body: {
        hostname?: string;
        os?: SabopsOs;
        osVersion?: string;
        agentVersion?: string;
        macAddress?: string;
        serialNumber?: string;
        model?: string;
    };
    try {
        body = (await req.json()) ?? {};
    } catch {
        return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
    }

    if (!body.hostname || !body.os) {
        return NextResponse.json(
            { error: 'hostname and os are required' },
            { status: 400 },
        );
    }

    try {
        const result = await redeemSabopsAgentToken(session.token, {
            hostname: body.hostname,
            os: body.os,
            osVersion: body.osVersion,
            agentVersion: body.agentVersion,
            macAddress: body.macAddress,
            serialNumber: body.serialNumber,
            model: body.model,
        });
        return NextResponse.json(result);
    } catch (err) {
        return NextResponse.json(
            { error: err instanceof Error ? err.message : 'redeem_failed' },
            { status: 400 },
        );
    }
}
