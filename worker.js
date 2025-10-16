
require('dotenv').config();
const path = require('path');

// Ensure we are requiring from the compiled output directory in production
const workerPath = process.env.NODE_ENV === 'production'
  ? path.join(__dirname, '.next', 'server', 'src', 'lib', 'broadcast-worker.js')
  : path.join(__dirname, 'src', 'lib', 'broadcast-worker.js');

try {
  const { startBroadcastWorker } = require(workerPath);
  const workerId = process.env.PM2_INSTANCE_ID || process.pid;
  console.log(`[Worker Script] Starting worker with ID: ${workerId}`);
  startBroadcastWorker(workerId);
} catch (err) {
  console.error('[Worker Script] Failed to start worker:', err);
  process.exit(1);
}
