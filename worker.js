
// This is the dedicated entry point for our broadcast workers.
// PM2 will run this file in a cluster to process Kafka messages.
require('dotenv').config();
const { startBroadcastWorker } = require('./src/lib/broadcast-worker.js');

const workerId = process.env.pm_id || process.pid;

console.log(`[Worker Script] Starting worker with ID: ${workerId}`);

// IIFE to run the async function
(async () => {
    try {
        await startBroadcastWorker(workerId);
    } catch (err) {
        console.error(`[Worker Script] Worker ${workerId} encountered a fatal error:`, err);
        process.exit(1); // Exit with an error code, PM2 will restart it.
    }
})();
