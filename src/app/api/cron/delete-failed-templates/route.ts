
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { getErrorMessage } from '@/lib/utils';

export const dynamic = 'force-dynamic';

async function handleDeleteFailedTemplates() {
    let db;
    try {
        const conn = await connectToDatabase();
        db = conn.db;

        const result = await db.collection('templates').deleteMany({
            $or: [
                { status: 'LOCAL' },
                { status: 'FAILED_SUBMISSION' }
            ]
        });

        const message = `Cleanup complete. Deleted ${result.deletedCount} failed or local templates.`;
        console.log(`Cron job: ${message}`);
        
        return NextResponse.json({ message, deletedCount: result.deletedCount });

    } catch (error: any) {
        console.error('Error in delete-failed-templates cron job:', error);
        return new NextResponse(`Internal Server Error: ${getErrorMessage(error)}`, { status: 500 });
    }
}

export async function POST(request: Request) {
    return handleDeleteFailedTemplates();
}

export async function GET(request: Request) {
    return handleDeleteFailedTemplates();
}
