
import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiKey } from '@/app/actions/api-keys.actions';
import { getLeadsForApi, createLeadForApi } from '@/app/actions/crm-leads-api.actions';
import { checkRateLimit } from '@/lib/rate-limiter';

export async function GET(request: NextRequest) {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return NextResponse.json({ error: 'Unauthorized: Missing API key.' }, { status: 401 });
    }
    const apiKey = authHeader.split(' ')[1];

    const authResult = await authenticateApiKey(apiKey);
    if (!authResult.success || !authResult.user) {
        return NextResponse.json({ error: 'Unauthorized: Invalid API key.' }, { status: 401 });
    }

    const { user } = authResult;
    const { success, error } = await checkRateLimit(`api:leads:${user._id.toString()}`, 60, 60 * 1000);
    if (!success) {
        return NextResponse.json({ error }, { status: 429 });
    }
    
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const query = searchParams.get('query') || undefined;

    const result = await getLeadsForApi(user._id.toString(), page, limit, query);

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
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return NextResponse.json({ error: 'Unauthorized: Missing API key.' }, { status: 401 });
    }
    const apiKey = authHeader.split(' ')[1];

    const authResult = await authenticateApiKey(apiKey);
    if (!authResult.success || !authResult.user) {
        return NextResponse.json({ error: 'Unauthorized: Invalid API key.' }, { status: 401 });
    }

    const { user } = authResult;
    const { success, error } = await checkRateLimit(`api:leads:create:${user._id.toString()}`, 30, 60 * 1000);
    if (!success) {
        return NextResponse.json({ error }, { status: 429 });
    }
    
    try {
        const body = await request.json();
        const result = await createLeadForApi(user._id.toString(), body);

        if (result.error) {
            return NextResponse.json({ error: result.error }, { status: 400 });
        }

        return NextResponse.json({ success: true, data: result.lead }, { status: 201 });
    } catch (e: any) {
        return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
    }
}
