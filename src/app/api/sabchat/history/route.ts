
import { NextRequest, NextResponse } from 'next/server';
import { getChatHistory } from '@/app/actions/sabchat.actions';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    const userId = searchParams.get('userId');

    if (!sessionId || !userId) {
        return NextResponse.json({ error: 'Session ID and User ID are required.' }, { status: 400 });
    }

    const history = await getChatHistory(sessionId, userId);
    return NextResponse.json({ history });
}
