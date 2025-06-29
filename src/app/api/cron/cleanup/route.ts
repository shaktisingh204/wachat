
import { NextResponse } from 'next/server';
import { handleClearProcessedLogs } from '@/app/actions';

export const dynamic = 'force-dynamic';

// This cron job is intended to be run periodically (e.g., every hour)
// to clear out old, processed webhook logs to keep the database clean.
export async function GET(request: Request) {
  try {
    const result = await handleClearProcessedLogs();
    if (result.error) {
        throw new Error(result.error);
    }
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error in cleanup-logs cron trigger:', error);
    return new NextResponse(`Internal Server Error: ${error.message}`, { status: 500 });
  }
}

export async function POST(request: Request) {
    return GET(request);
}
