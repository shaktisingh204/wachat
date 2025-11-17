
'use strict';

require('dotenv').config();
const path = require('path');
const fs = require('fs');

const LOG_PREFIX = '[WORKER-LOADER]';
const WORKER_FILE_PATH = path.resolve(__dirname, 'workers', 'broadcast-worker.js');

/**
 * Main function to load and start a worker.
 */
function main() {
  console.log(`${LOG_PREFIX} Booting worker loader...`);

  // 1. Validate that the worker file actually exists before proceeding.
  if (!fs.existsSync(WORKER_FILE_PATH)) {
    console.error(`${LOG_PREFIX} FATAL: Worker file not found!`);
    console.error(`${LOG_PREFIX} Expected at: ${WORKER_FILE_PATH}`);
    process.exit(1);
  }

  // 2. Import the worker module safely inside a try-catch block.
  let startBroadcastWorker;
  try {
    ({ startBroadcastWorker } = require(WORKER_FILE_PATH));
  } catch (err) {
    console.error(`${LOG_PREFIX} FATAL: Failed to import the worker module from broadcast-worker.js`, err);
    process.exit(1);
  }

  // 3. Create a stable and unique worker ID, especially important for PM2 cluster mode.
  const workerId = process.env.PM2_INSTANCE_ID !== undefined
      ? `pm2-cluster-${process.env.PM2_INSTANCE_ID}`
      : `pid-${process.pid}`;

  // 4. Get the Kafka topic from command line arguments. PM2 passes 'args' this way.
  const kafkaTopic = process.argv[2];
  if (!kafkaTopic) {
    console.error(`${LOG_PREFIX} FATAL: Missing Kafka topic argument! This is a configuration error.`);
    console.error(`${LOG_PREFIX} Correct usage in ecosystem.config.js -> args: ["your-topic-name"]`);
    process.exit(1);
  }

  console.log(`${LOG_PREFIX} Worker starting with the following configuration:`);
  console.log(`${LOG_PREFIX} ▸ Worker ID: ${workerId}`);
  console.log(`${LOG_PREFIX} ▸ Kafka Topic: ${kafkaTopic}`);
  console.log(`${LOG_PREFIX} ▸ Worker File: ${WORKER_FILE_PATH}`);

  // 5. Start the worker's main function.
  try {
    startBroadcastWorker(workerId, kafkaTopic);
  } catch (err) {
    console.error(`${LOG_PREFIX} CRITICAL ERROR starting worker process.`);
    console.error(err);
    process.exit(1);
  }
}

main();
