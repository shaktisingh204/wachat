
import { NextResponse } from 'next/server';
import { handleClearWebhookLogs } from '@/app/actions';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const result = await handleClearWebhookLogs();
    if (result.error) {
        throw new Error(result.error);
    }
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error in cleanup cron trigger:', error);
    return new NextResponse(`Internal Server Error: ${error.message}`, { status: 500 });
  }
}

export async function POST(request: Request) {
    return GET(request);
}
