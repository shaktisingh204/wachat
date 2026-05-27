import { NextResponse } from 'next/server';

import { authenticateAgent } from '../_lib/token-guard';
import { connectToDatabase } from '@/lib/mongodb';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * `POST /api/sabops/agent/inventory`
 *
 * Upserts hardware specs and replaces the endpoint's software list.
 *
 * Body: `{ hardware?: {...}, software?: Array<{name, version, ...}> }`
 */
export async function POST(req: Request) {
    const session = await authenticateAgent(req);
    if (!session || !session.endpointId) {
        return NextResponse.json({ error: 'agent_not_enrolled' }, { status: 401 });
    }

    let body: {
        hardware?: {
            cpu?: string;
            ramGb?: number;
            diskGb?: number;
            gpu?: string;
            batteryHealth?: number;
        };
        software?: Array<{
            name: string;
            version: string;
            vendor?: string;
            sizeBytes?: number;
            source?: string;
            installedAt?: string;
        }>;
    };
    try {
        body = (await req.json()) ?? {};
    } catch {
        return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
    }

    const now = new Date();
    const { db } = await connectToDatabase();
    let hardwareUpserted = false;
    if (body.hardware) {
        await db.collection('sabops_hardware').updateOne(
            { userId: session.tenantUserId, endpointId: session.endpointId },
            {
                $set: {
                    ...body.hardware,
                    userId: session.tenantUserId,
                    endpointId: session.endpointId,
                    lastInventoryAt: now,
                    updatedAt: now,
                },
                $setOnInsert: { createdAt: now },
            },
            { upsert: true },
        );
        hardwareUpserted = true;
    }

    let softwareInserted = 0;
    if (Array.isArray(body.software) && body.software.length > 0) {
        // Replace existing rows for this endpoint with the fresh snapshot.
        await db.collection('sabops_software').deleteMany({
            userId: session.tenantUserId,
            endpointId: session.endpointId,
        });
        const docs = body.software.map((s) => ({
            userId: session.tenantUserId,
            endpointId: session.endpointId,
            name: s.name,
            version: s.version,
            vendor: s.vendor,
            sizeBytes: s.sizeBytes,
            source: s.source,
            installedAt: s.installedAt ? new Date(s.installedAt) : undefined,
            createdAt: now,
        }));
        const r = await db.collection('sabops_software').insertMany(docs);
        softwareInserted = r.insertedCount;
    }

    return NextResponse.json({ hardwareUpserted, softwareInserted });
}
