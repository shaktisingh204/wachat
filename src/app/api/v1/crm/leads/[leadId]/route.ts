
import { NextRequest, NextResponse } from 'next/server';
import { verifyApiKey, type ApiAuthContext } from '@/lib/api-platform/auth';
import { getLeadByIdForApi, updateLeadForApi, deleteLeadForApi } from '@/app/actions/crm-leads-api.actions';
import { checkRateLimit } from '@/lib/rate-limiter';
import { ObjectId } from 'mongodb';

async function handler(
    request: NextRequest,
    { params }: { params: Promise<{ leadId: string }> },
    ctx: ApiAuthContext,
) {
    const userId = ctx.tenantId;
    const { leadId } = await params;

    if (!ObjectId.isValid(leadId)) {
        return NextResponse.json({ error: 'Invalid Lead ID format.' }, { status: 400 });
    }

    if (request.method === 'GET') {
        const { lead, error } = await getLeadByIdForApi(leadId, userId);
        if (error) return NextResponse.json({ error }, { status: 404 });
        return NextResponse.json({ success: true, data: lead });
    }

    if (request.method === 'PUT') {
        const body = await request.json();
        const { success, lead, error } = await updateLeadForApi(leadId, userId, body);
        if (error) return NextResponse.json({ error }, { status: 400 });
        return NextResponse.json({ success, data: lead });
    }

    if (request.method === 'DELETE') {
        const { success, error } = await deleteLeadForApi(leadId, userId);
        if (error) return NextResponse.json({ error }, { status: 400 });
        return NextResponse.json({ success, message: 'Lead deleted successfully.' });
    }

    return NextResponse.json({ error: `Method ${request.method} Not Allowed` }, { status: 405 });
}


// Wrapper to handle authentication and rate limiting for all methods
export async function wrapper(
    request: NextRequest,
    { params }: { params: Promise<{ leadId: string }> }
) {
    const ctx = await verifyApiKey(request);
    if (!ctx) {
        return NextResponse.json({ error: 'Unauthorized: Invalid API key.' }, { status: 401 });
    }

    const { success, error } = await checkRateLimit(`api:leads:${ctx.tenantId}`, 60, 60 * 1000);
    if (!success) {
        return NextResponse.json({ error }, { status: 429 });
    }

    return handler(request, { params }, ctx);
}

export { wrapper as GET, wrapper as PUT, wrapper as DELETE };
