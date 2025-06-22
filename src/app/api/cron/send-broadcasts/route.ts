import { NextResponse } from 'next/server';
import { processBroadcastJob } from '@/lib/cron-scheduler';

export async function GET(request: Request) {
  try {
    const result = await processBroadcastJob();
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error in manual broadcast trigger:', error);
    return new NextResponse(`Internal Server Error: ${error.message}`, { status: 500 });
  }
}

export async function POST(request: Request) {
    return GET(request);
}
