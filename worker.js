
require('dotenv').config();
const path = require('path');

// Always load worker directly from the workers folder (NOT from .next)
const workerPath = path.join(__dirname, 'workers', 'broadcast-worker.js');

try {
  const { startBroadcastWorker } = require(workerPath);

  // PM2 gives each instance an ID in cluster mode
  const workerId = process.env.PM2_INSTANCE_ID || `pid-${process.pid}`;
  
  // The topic is now passed as an argument from ecosystem.config.js
  const kafkaTopic = process.argv[2] || 'broadcasts';

  console.log(`[Worker Script] Starting Broadcast Worker | ID: ${workerId} | Topic: ${kafkaTopic}`);

  // Start the worker and tell it which topic to listen to
  startBroadcastWorker(workerId, kafkaTopic);

} catch (err) {
  console.error('[Worker Script] Failed to start worker:', err);
  process.exit(1);
}
