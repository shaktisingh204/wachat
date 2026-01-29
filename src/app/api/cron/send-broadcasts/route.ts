
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { db } = await connectToDatabase();
    
    // Atomically find one queued broadcast and flag it for processing by the worker.
    // This is a very fast operation and prevents race conditions.
    const job = await db.collection('broadcasts').findOneAndUpdate(
      { status: 'QUEUED' },
      { $set: { status: 'PENDING_PROCESSING' } }
    );
    
    if (job) {
      return NextResponse.json({ message: `Successfully flagged broadcast ${job._id} for processing.` });
    } else {
      return NextResponse.json({ message: 'No queued broadcasts to process.' });
    }
  } catch (error: any) {
    console.error('Error in /api/cron/send-broadcasts:', error);
    return new NextResponse(`Internal Server Error: ${error.message}`, { status: 500 });
  }
}

export async function POST(request: Request) {
    // Allow manual triggering via POST as well
    return GET(request);
}
