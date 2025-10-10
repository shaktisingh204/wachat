
const { processBroadcastJob } = require('./cron-scheduler');

// The main function for a worker process.
async function startBroadcastWorker(workerId) {
  console.log(`[Worker ${workerId}] Starting broadcast processing loop.`);
  
  // This loop will run continuously, processing jobs as they become available.
  while (true) {
    try {
      // processBroadcastJob now handles acquiring locks and processing a job.
      const result = await processBroadcastJob();

      if (result.message.startsWith('No active broadcasts')) {
        // If no jobs are found, wait for a bit before checking again to avoid hammering the DB.
        await new Promise(resolve => setTimeout(resolve, 5000));
      } else {
         // If a job was processed, immediately check for another one.
         await new Promise(resolve => setTimeout(resolve, 100));
      }
    } catch (error) {
      console.error(`[Worker ${workerId}] Error in broadcast processing loop:`, error);
      // Wait for a longer period after an error to prevent a fast failure loop.
      await new Promise(resolve => setTimeout(resolve, 15000));
    }
  }
}

module.exports = { startBroadcastWorker };
