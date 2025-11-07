
import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { runSabFlow } from '@/app/actions/sabflow.actions';
import { getErrorMessage } from '@/lib/utils';

export async function POST(
    request: NextRequest,
    { params }: { params: { flowId: string } }
) {
    const { flowId } = params;

    if (!flowId || !ObjectId.isValid(flowId)) {
        return NextResponse.json({ error: 'Invalid Flow ID.' }, { status: 400 });
    }

    let payload;
    try {
        payload = await request.json();
    } catch (e) {
        return NextResponse.json({ error: 'Invalid JSON payload.' }, { status: 400 });
    }

    try {
        const result = await runSabFlow(flowId, payload);
        if (result?.error) {
            return NextResponse.json({ success: false, error: result.error }, { status: 500 });
        }
        return NextResponse.json({ success: true, message: "Flow triggered successfully." });
    } catch (e) {
        return NextResponse.json({ success: false, error: getErrorMessage(e) }, { status: 500 });
    }
}
