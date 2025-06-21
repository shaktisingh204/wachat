
import { config } from 'dotenv';
config();

import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { Db } from 'mongodb';

const logToCronCollection = async (db: Db, level: 'INFO' | 'ERROR', message: string, details: any = {}) => {
    try {
        await db.collection('cron_logs').insertOne({
            timestamp: new Date(),
            level,
            message,
            details,
        });
    } catch (e) {
        console.error('CRON_TEST: FATAL - Could not write to cron_logs collection.', e);
    }
};

async function handleTestRequest(request: Request) {
    let db: Db;
    try {
        // Auth removed for manual testing
        const conn = await connectToDatabase();
        db = conn.db;

        await logToCronCollection(db, 'INFO', 'Cron test job successfully triggered by manual request.');

        return NextResponse.json({ message: 'Cron test successful. Check the Cron Job Logs page in the admin panel.' });

    } catch (error: any) {
        console.error(`[${new Date().toISOString()}] CRON TEST JOB FAILED: ${error.message}`);
        // Attempt to log the failure to the database if connection was established
        if (db) {
            await logToCronCollection(db, 'ERROR', 'Cron test job failed.', { error: error.message, stack: error.stack });
        }
        return new NextResponse(`Internal Server Error: ${error.message}`, { status: 500 });
    }
}

export async function GET(request: Request) {
    return handleTestRequest(request);
}

export async function POST(request: Request) {
    return handleTestRequest(request);
}
