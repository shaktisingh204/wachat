import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        // Here we could trigger a dry-run or a real event on the engine.
        // For now, we mock the result of the webhook test.
        console.log('Testing webhook for automation:', body.automationId);
        return NextResponse.json({ success: true, message: 'Webhook event dispatched to engine.' });
    } catch (e) {
        return NextResponse.json({ error: 'Failed to dispatch webhook' }, { status: 500 });
    }
}
