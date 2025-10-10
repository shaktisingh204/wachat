
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// This cron job is deprecated as the main cron scheduler now handles this.
// Kept for backward compatibility with older setups.
export async function GET(request: Request) {
    return NextResponse.json({ message: 'This cron job is deprecated. Use /api/cron/send-broadcasts instead.' });
}

export async function POST(request: Request) {
    return GET(request);
}
