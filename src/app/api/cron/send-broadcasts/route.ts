
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return NextResponse.json({ message: 'This cron endpoint is deprecated and no longer needed for broadcasting.' });
}

export async function POST(request: Request) {
    return GET(request);
}
