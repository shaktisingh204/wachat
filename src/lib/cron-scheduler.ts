
'use server';

import { connectToDatabase } from './mongodb';
import { getErrorMessage } from './utils';
import { ObjectId } from 'mongodb';
import type { Broadcast } from './definitions';

// This function is designed to be lightweight, suitable for a cron trigger.
// It finds one queued broadcast and marks it for processing by the background worker.
export async function processBroadcastJob() {
    try {
        const { db } = await connectToDatabase();
        
        // Find one queued broadcast and atomically update it to prevent multiple workers from picking it up.
        const result = await db.collection<Broadcast>('broadcasts').findOneAndUpdate(
            { status: 'QUEUED' },
            { $set: { status: 'PENDING_PROCESSING', updatedAt: new Date() } }
        );
        
        if (!result) {
            return { message: 'No queued broadcasts to process at this time.' };
        }

        return { message: `Broadcast ${result._id} has been marked for processing.` };

    } catch (e) {
        console.error('[CRON-SCHEDULER] Error processing broadcast job:', getErrorMessage(e));
        return { error: getErrorMessage(e) };
    }
}
