import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// This cron job is deprecated as the webhook queue has been removed for instant processing.
// The main `process-webhooks` cron now handles any fallback processing directly from the logs.
export async function GET(request: Request) {
    return NextResponse.json({ message: 'This cron job is deprecated. Webhook queue is no longer used.' });
}

export async function POST(request: Request) {
    return GET(request);
}
