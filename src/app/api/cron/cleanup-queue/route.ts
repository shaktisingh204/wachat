
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

// This cron job is intended to be run periodically (e.g., daily)
// to clear out old, processed items from the webhook queue.
export async function GET(request: Request) {
  try {
    const { db } = await connectToDatabase();
        
    const sixHoursAgo = new Date();
    sixHoursAgo.setHours(sixHoursAgo.getHours() - 6);

    const result = await db.collection('webhook_queue').deleteMany({
        status: { $in: ['COMPLETED', 'FAILED'] },
        createdAt: { $lt: sixHoursAgo }
    });

    return NextResponse.json({
        message: `Successfully cleared ${result.deletedCount} old queue item(s).`,
        deletedCount: result.deletedCount 
    });
  } catch (error: any) {
    console.error('Error in cleanup-queue cron trigger:', error);
    return new NextResponse(`Internal Server Error: ${error.message}`, { status: 500 });
  }
}

export async function POST(request: Request) {
    return GET(request);
}
