
import { NextResponse } from 'next/server';
import { processBroadcastJob } from '@/lib/cron-scheduler';
import { verifyCronRequest } from '@/lib/cron-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const unauthorized = verifyCronRequest(request);
  if (unauthorized) return unauthorized;
  try {
    // This now processes all queued jobs in a single run.
    const result = await processBroadcastJob();
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error in cron trigger:', error);
    return new NextResponse(`Internal Server Error: ${error.message}`, { status: 500 });
  }
}

export async function POST(request: Request) {
    return GET(request);
}
