
import { NextRequest, NextResponse } from 'next/server';
import { postChatMessage } from '@/app/actions/sabchat.actions';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { sessionId, content } = body;

        if (!sessionId || !content) {
            return NextResponse.json({ error: 'Session ID and content are required.' }, { status: 400, headers: corsHeaders });
        }

        const result = await postChatMessage(sessionId, 'visitor', content);
        if (!result.success) {
            return NextResponse.json({ error: result.error }, { status: 500, headers: corsHeaders });
        }

        return NextResponse.json({ success: true }, { headers: corsHeaders });
    } catch (e) {
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
