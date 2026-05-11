
import { NextResponse } from 'next/server';
import { verifyCronRequest } from '@/lib/cron-auth';

export const dynamic = 'force-dynamic';

// This cron job is deprecated as the webhook queue has been removed for instant processing.
export async function GET(request: Request) {
    const unauthorized = verifyCronRequest(request);
    if (unauthorized) return unauthorized;
    return NextResponse.json({ message: 'This cron job is deprecated. Webhook queue has been removed.' });
}

export async function POST(request: Request) {
    return GET(request);
}
