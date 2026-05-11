import { NextResponse } from 'next/server';

export function verifyCronRequest(request: Request): NextResponse | null {
    const secret = process.env.CRON_SECRET;
    if (!secret) {
        return NextResponse.json(
            { error: 'CRON_SECRET is not configured on the server.' },
            { status: 503 }
        );
    }

    const authHeader = request.headers.get('authorization');
    const expected = `Bearer ${secret}`;
    if (authHeader !== expected) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return null;
}
