
import { NextRequest, NextResponse } from 'next/server';
import { verifyApiKey } from '@/lib/api-platform/auth';
import { getLeadsForApi, createLeadForApi } from '@/app/actions/crm-leads-api.actions';
import { checkRateLimit } from '@/lib/rate-limiter';

export async function GET(request: NextRequest) {
    const ctx = await verifyApiKey(request);
    if (!ctx) {
        return NextResponse.json({ error: 'Unauthorized: Invalid API key.' }, { status: 401 });
    }

    const userId = ctx.tenantId;
    const { success, error } = await checkRateLimit(`api:leads:${userId}`, 60, 60 * 1000);
    if (!success) {
        return NextResponse.json({ error }, { status: 429 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const query = searchParams.get('query') || undefined;

    const result = await getLeadsForApi(userId, page, limit, query);

    if (result.error) {
        return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({
        success: true,
        data: result.leads,
        pagination: {
            page,
            limit,
            total: result.total,
            totalPages: Math.ceil(result.total / limit),
        }
    });
}

export async function POST(request: NextRequest) {
    const ctx = await verifyApiKey(request);
    if (!ctx) {
        return NextResponse.json({ error: 'Unauthorized: Invalid API key.' }, { status: 401 });
    }

    const userId = ctx.tenantId;
    const { success, error } = await checkRateLimit(`api:leads:create:${userId}`, 30, 60 * 1000);
    if (!success) {
        return NextResponse.json({ error }, { status: 429 });
    }

    try {
        const body = await request.json();
        const result = await createLeadForApi(userId, body);

        if (result.error) {
            return NextResponse.json({ error: result.error }, { status: 400 });
        }

        return NextResponse.json({ success: true, data: result.lead }, { status: 201 });
    } catch (e: any) {
        return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
    }
}
