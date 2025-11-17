
'use strict';

require('dotenv').config();
const path = require('path');
const fs = require('fs');

// --- Worker Configuration ---
const WORKER_LOG_PREFIX = '[WORKER-LOADER]';
const WORKER_FILE_PATH = path.join(__dirname, 'workers', 'broadcast-worker.js');

/**
 * Main function to validate environment and start the worker process.
 */
function main() {
  // 1. Validate that the worker file exists before proceeding.
  if (!fs.existsSync(WORKER_FILE_PATH)) {
    console.error(`${WORKER_LOG_PREFIX} FATAL: The worker executable does not exist at the expected path.`);
    console.error(`${WORKER_LOG_PREFIX} Expected path: ${WORKER_FILE_PATH}`);
    process.exit(1);
  }

  // 2. Load the worker module.
  const { startBroadcastWorker } = require(WORKER_FILE_PATH);
  
  // 3. Determine a stable, unique ID for this worker instance.
  // PM2 provides `PM2_INSTANCE_ID` in cluster mode, which is ideal. Fallback to process ID.
  const workerId = process.env.PM2_INSTANCE_ID !== undefined 
    ? `pm2-id-${process.env.PM2_INSTANCE_ID}` 
    : `pid-${process.pid}`;
  
  // 4. Get the Kafka topic from command-line arguments passed by PM2.
  const kafkaTopic = process.argv[2];
  if (!kafkaTopic) {
      console.error(`${WORKER_LOG_PREFIX} FATAL: Kafka topic argument was not provided by PM2.`);
      console.error(`${WORKER_LOG_PREFIX} Check your ecosystem.config.js to ensure a topic is passed in the 'args' field.`);
      process.exit(1);
  }

  console.log(`${WORKER_LOG_PREFIX} Starting Broadcast Worker | ID: ${workerId} | Topic: ${kafkaTopic}`);

  // 5. Start the worker logic with the validated configuration.
  try {
    startBroadcastWorker(workerId, kafkaTopic);
  } catch (err) {
    console.error(`${WORKER_LOG_PREFIX} CRITICAL: The worker encountered an unrecoverable error during startup.`);
    console.error(err);
    process.exit(1);
  }
}

// Execute the main function.
main();
