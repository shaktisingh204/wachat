
import { NextResponse } from 'next/server';
const { processBroadcastJob } = require('@/lib/cron-scheduler.js');

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
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
