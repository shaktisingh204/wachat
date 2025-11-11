
import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiKey } from '@/app/actions/api-keys.actions';
import { getLeadByIdForApi, updateLeadForApi, deleteLeadForApi } from '@/app/actions/crm-leads-api.actions';
import { checkRateLimit } from '@/lib/rate-limiter';
import { ObjectId } from 'mongodb';

async function handler(
    request: NextRequest,
    { params }: { params: { leadId: string } },
    authResult: any
) {
    const { user } = authResult;
    const { leadId } = params;

    if (!ObjectId.isValid(leadId)) {
        return NextResponse.json({ error: 'Invalid Lead ID format.' }, { status: 400 });
    }

    if (request.method === 'GET') {
        const { lead, error } = await getLeadByIdForApi(leadId, user._id.toString());
        if (error) return NextResponse.json({ error }, { status: 404 });
        return NextResponse.json({ success: true, data: lead });
    }

    if (request.method === 'PUT') {
        const body = await request.json();
        const { success, lead, error } = await updateLeadForApi(leadId, user._id.toString(), body);
        if (error) return NextResponse.json({ error }, { status: 400 });
        return NextResponse.json({ success, data: lead });
    }

    if (request.method === 'DELETE') {
        const { success, error } = await deleteLeadForApi(leadId, user._id.toString());
        if (error) return NextResponse.json({ error }, { status: 400 });
        return NextResponse.json({ success, message: 'Lead deleted successfully.' });
    }

    return NextResponse.json({ error: `Method ${request.method} Not Allowed` }, { status: 405 });
}


// Wrapper to handle authentication and rate limiting for all methods
export async function wrapper(
    request: NextRequest,
    { params }: { params: { leadId: string } }
) {
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

    return handler(request, { params }, authResult);
}

export { wrapper as GET, wrapper as PUT, wrapper as DELETE };
