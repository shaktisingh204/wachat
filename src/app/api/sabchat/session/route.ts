
import { NextRequest, NextResponse } from 'next/server';
import { getOrCreateChatSession } from '@/app/actions/sabchat.actions';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { userId, email, visitorId } = body;
        
        if (!userId || !email) {
            return NextResponse.json({ error: 'User ID and email are required.' }, { status: 400 });
        }

        const result = await getOrCreateChatSession(userId, email, visitorId);
        if (result.error) {
            return NextResponse.json({ error: result.error }, { status: 500 });
        }

        return NextResponse.json(result);
    } catch(e) {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }
}
