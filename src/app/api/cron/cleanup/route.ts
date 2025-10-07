

import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { db } = await connectToDatabase();
    
    // Deletes logs that were processed successfully over an hour ago.
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const queueResult = await db.collection('webhook_queue').deleteMany({
        status: 'PROCESSED',
        processedAt: { $lt: oneHourAgo }
    });

    const logsResult = await db.collection('webhook_logs').deleteMany({
        processed: true,
        createdAt: { $lt: oneHourAgo }
    });

    const message = `Successfully cleared ${queueResult.deletedCount} processed queue items and ${logsResult.deletedCount} old log entries.`;
    
    return NextResponse.json({ message });

  } catch (error: any) {
    console.error('Error in cleanup cron job:', error);
    return new NextResponse(`Internal Server Error: ${error.message}`, { status: 500 });
  }
}

export async function POST(request: Request) {
    return GET(request);
}

