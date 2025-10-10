'use server';

const { processBroadcastJob } = require('./cron-scheduler');

async function start() {
    console.log(`[Broadcast Worker ${process.pid}] Started.`);
    while (true) {
        try {
            // This function now processes all available jobs in one go.
            const result = await processBroadcastJob();
            if (result.message && !result.message.startsWith('No active broadcasts')) {
              // Only log if there was work to do, to avoid spamming logs.
              console.log(`[Broadcast Worker ${process.pid}] ${result.message}`);
            }
        } catch (error) {
            console.error(`[Broadcast Worker ${process.pid}] Error processing job:`, error);
        }
        // Wait for a short period before checking for new jobs again.
        // This prevents a tight loop if there are no jobs.
        await new Promise(resolve => setTimeout(resolve, 5000));
    }
}

module.exports = { startBroadcastWorker: start };
