
import { NextRequest, NextResponse } from 'next/server';
import { getChatHistory } from '@/app/actions/sabchat.actions';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
        return NextResponse.json({ error: 'Session ID is required.' }, { status: 400, headers: corsHeaders });
    }

    const history = await getChatHistory(sessionId);
    return NextResponse.json({ history }, { headers: corsHeaders });
}

// Handle preflight requests for CORS
export async function OPTIONS(request: NextRequest) {
    return new NextResponse(null, {
        status: 204,
        headers: corsHeaders
    });
}
