
require('dotenv').config();
const path = require('path');

const workerPath = path.join(__dirname, 'workers', 'broadcast-worker.js');

try {
  const { startBroadcastWorker } = require(workerPath);

  // PM2 gives each instance an ID in cluster mode. If not running under PM2, generate a unique ID.
  const workerId = process.env.PM2_INSTANCE_ID !== undefined 
    ? `pm2-id-${process.env.PM2_INSTANCE_ID}` 
    : `pid-${process.pid}`;
  
  // The Kafka topic is now passed as an argument from ecosystem.config.js
  const kafkaTopic = process.argv[2];
  if (!kafkaTopic) {
      console.error('[Worker Loader] FATAL: Kafka topic argument not provided by PM2. Exiting.');
      process.exit(1);
  }

  console.log(`[Worker Loader] Starting Broadcast Worker | ID: ${workerId} | Topic: ${kafkaTopic}`);

  // Start the worker and tell it which topic to listen to
  startBroadcastWorker(workerId, kafkaTopic);

} catch (err) {
  console.error('[Worker Loader] Failed to start worker. Ensure ./workers/broadcast-worker.js exists and is valid.', err);
  process.exit(1);
}
