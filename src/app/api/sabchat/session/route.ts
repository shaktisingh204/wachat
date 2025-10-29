
import { NextRequest, NextResponse } from 'next/server';
import { getOrCreateChatSession } from '@/app/actions/sabchat.actions';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { userId, email, visitorId } = body;
        
        if (!userId || !email) {
            return NextResponse.json({ error: 'User ID and email are required.' }, { status: 400, headers: corsHeaders });
        }

        const result = await getOrCreateChatSession(userId, email, visitorId);
        if (result.error) {
            return NextResponse.json({ error: result.error }, { status: 500, headers: corsHeaders });
        }

        return NextResponse.json(result, { headers: corsHeaders });
    } catch(e) {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400, headers: corsHeaders });
    }
}

// Handle preflight requests for CORS
export async function OPTIONS(request: NextRequest) {
    return new NextResponse(null, {
        status: 204,
        headers: corsHeaders
    });
}
