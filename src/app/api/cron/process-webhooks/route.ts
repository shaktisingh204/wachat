
import { NextResponse, type NextRequest } from 'next/server';
import { verifyCronRequest } from '@/lib/cron-auth';

// This cron job is deprecated as webhooks are now processed instantly upon arrival.
export async function GET(request: NextRequest) {
    const unauthorized = verifyCronRequest(request);
    if (unauthorized) return unauthorized;
    return NextResponse.json({ message: 'This cron job is deprecated. Webhook processing is now instant.' });
}

export async function POST(request: NextRequest) {
    return GET(request as NextRequest);
}
