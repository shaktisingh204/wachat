
'use strict';
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { MongoClient, ObjectId } = require('mongodb');

const LOG_PREFIX = '[CLEANUP-WORKER]';

async function main() {
    console.log(`${LOG_PREFIX} Starting cleanup job...`);

    if (!process.env.MONGODB_URI || !process.env.MONGODB_DB) {
        console.error(`${LOG_PREFIX} MONGODB_URI and MONGODB_DB must be defined in .env file.`);
        process.exit(1);
    }
    
    const client = new MongoClient(process.env.MONGODB_URI);

    try {
        await client.connect();
        const db = client.db(process.env.MONGODB_DB);
        console.log(`${LOG_PREFIX} Connected to database.`);

        // Define "old" as anything completed or failed more than 30 days ago
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        console.log(`${LOG_PREFIX} Deleting records older than ${thirtyDaysAgo.toISOString()}`);

        const oldBroadcastsCursor = db.collection('broadcasts').find({
            status: { $in: ['Completed', 'Failed', 'Partial Failure'] },
            createdAt: { $lt: thirtyDaysAgo }
        });
        
        const oldBroadcastIds = [];
        for await (const doc of oldBroadcastsCursor) {
            oldBroadcastIds.push(doc._id);
        }

        if (oldBroadcastIds.length === 0) {
            console.log(`${LOG_PREFIX} No old broadcasts found to delete. Job finished.`);
            return;
        }

        console.log(`${LOG_PREFIX} Found ${oldBroadcastIds.length} old broadcast(s) to delete.`);

        // Delete associated contacts
        const contactsResult = await db.collection('broadcast_contacts').deleteMany({
            broadcastId: { $in: oldBroadcastIds }
        });
        console.log(`${LOG_PREFIX} Deleted ${contactsResult.deletedCount} associated contact entries.`);

        // Delete associated logs
        const logsResult = await db.collection('broadcast_logs').deleteMany({
            broadcastId: { $in: oldBroadcastIds }
        });
        console.log(`${LOG_PREFIX} Deleted ${logsResult.deletedCount} associated log entries.`);

        // Delete the broadcasts themselves
        const broadcastsResult = await db.collection('broadcasts').deleteMany({
            _id: { $in: oldBroadcastIds }
        });
        console.log(`${LOG_PREFIX} Deleted ${broadcastsResult.deletedCount} broadcast campaigns.`);

        console.log(`${LOG_PREFIX} Cleanup job finished successfully.`);

    } catch (err) {
        console.error(`${LOG_PREFIX} An error occurred during cleanup:`, err);
        process.exit(1);
    } finally {
        await client.close();
    }
}

main();
