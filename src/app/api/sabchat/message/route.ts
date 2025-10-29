
import { NextRequest, NextResponse } from 'next/server';
import { postChatMessage } from '@/app/actions/sabchat.actions';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { sessionId, content } = body;

        if (!sessionId || !content) {
            return NextResponse.json({ error: 'Session ID and content are required.' }, { status: 400 });
        }

        const result = await postChatMessage(sessionId, 'visitor', content);
        if (!result.success) {
            return NextResponse.json({ error: result.error }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (e) {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }
}
