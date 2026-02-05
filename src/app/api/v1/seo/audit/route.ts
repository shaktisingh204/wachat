import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

// Simple API Key check
async function validKey(req: NextRequest) {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) return false;
    // In prod, check DB for API Key validity
    return true;
}

export async function GET(req: NextRequest) {
    if (!(await validKey(req))) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');

    if (!projectId) {
        return NextResponse.json({ error: 'Missing projectId' }, { status: 400 });
    }

    const { db } = await connectToDatabase();

    // Fetch latest audit summary
    const audit = await db.collection('seo_audits').findOne(
        { projectId: new ObjectId(projectId) },
        { sort: { startedAt: -1 } }
    );

    return NextResponse.json(audit);
}
