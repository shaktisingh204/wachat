import 'server-only';

import { ObjectId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';

export interface AgentSession {
    /** Tenant `userId` that owns the redeeming token. */
    tenantUserId: ObjectId;
    /** Endpoint that the agent has been redeemed against (null pre-enroll). */
    endpointId: ObjectId | null;
    /** The raw token string (kept for downstream redeem helpers). */
    token: string;
}

/**
 * Bearer-token guard for `/api/sabops/agent/*` Route Handlers.
 *
 * Reads `Authorization: Bearer <token>` (or `X-Sabops-Agent-Token` for
 * legacy installers) and resolves it against the `sabops_agent_tokens`
 * collection. Returns null on miss — caller should 401.
 *
 * On enroll the token does NOT yet have `redeemedEndpointId` — that gets
 * stamped by `redeemSabopsAgentToken`. On every subsequent call we expect
 * the token to be marked `used: true` with a `redeemedEndpointId`.
 */
export async function authenticateAgent(req: Request): Promise<AgentSession | null> {
    const auth = req.headers.get('authorization') ?? '';
    const tokenHeader = req.headers.get('x-sabops-agent-token') ?? '';
    const token = auth.toLowerCase().startsWith('bearer ')
        ? auth.slice(7).trim()
        : tokenHeader.trim();
    if (!token) return null;

    const { db } = await connectToDatabase();
    const row = await db.collection('sabops_agent_tokens').findOne({ token });
    if (!row) return null;

    return {
        tenantUserId: row.userId as ObjectId,
        endpointId: (row.redeemedEndpointId as ObjectId | undefined) ?? null,
        token,
    };
}
