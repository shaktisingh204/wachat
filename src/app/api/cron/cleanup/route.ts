
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

// This cron job is intended to be run periodically (e.g., every hour)
// to clear out old, processed webhook logs to keep the database clean.
export async function GET(request: Request) {
  try {
    const { db } = await connectToDatabase();
    
    const result = await db.collection('webhook_logs').deleteMany({
        processed: true
    });

    return NextResponse.json({
        message: `Successfully cleared ${result.deletedCount} processed webhook log(s).`,
        deletedCount: result.deletedCount 
    });
  } catch (error: any) {
    console.error('Error in cleanup-logs cron trigger:', error);
    return new NextResponse(`Internal Server Error: ${error.message}`, { status: 500 });
  }
}

export async function POST(request: Request) {
    return GET(request);
}
