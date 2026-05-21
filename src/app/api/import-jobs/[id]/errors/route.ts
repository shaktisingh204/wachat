/**
 * GET /api/import-jobs/[id]/errors
 *
 * Streams a CSV of {row, message} for the given import job. Authed via
 * `getSession()` and gated by ownership (`userId === session.user._id`).
 *
 * Used by the recent-imports table on the CRM import-export page —
 * "Download error log" button.
 */

import { ObjectId } from 'mongodb';
import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/app/actions/user.actions';
import { connectToDatabase } from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

interface ImportJobError {
    row: number;
    message: string;
}

function csvEscape(v: unknown): string {
    return `"${String(v ?? '').replace(/"/g, '""')}"`;
}

export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
    const { id } = await params;
    const session = await getSession();
    if (!session?.user?._id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let jobObjectId: ObjectId;
    try {
        jobObjectId = new ObjectId(id);
    } catch {
        return NextResponse.json({ error: 'Invalid job id' }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    const userObjectId = new ObjectId(String(session.user._id));
    const job = await db.collection('crm_import_jobs').findOne(
        { _id: jobObjectId, userId: userObjectId },
        { projection: { errors: 1, filename: 1, entityType: 1 } },
    );
    if (!job) {
        return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    const errors = Array.isArray(job.errors) ? (job.errors as ImportJobError[]) : [];
    const lines = [
        ['row', 'message'].map(csvEscape).join(','),
        ...errors.map((e) => [e.row, e.message].map(csvEscape).join(',')),
    ];
    const csv = lines.join('\n');
    const safeName = String(job.filename ?? 'import')
        .replace(/[^a-z0-9._-]/gi, '_')
        .slice(0, 80);
    const filename = `errors-${job.entityType ?? 'import'}-${safeName}.csv`;

    return new NextResponse(csv, {
        status: 200,
        headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="${filename}"`,
            'Cache-Control': 'no-store',
        },
    });
}
