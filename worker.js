'use strict';

require('dotenv').config();
const path = require('path');
const fs = require('fs');

const LOG = '[WORKER-LOADER]';

// Absolute path to worker file
const WORKER_FILE_PATH = path.resolve(__dirname, 'workers', 'broadcast-worker.js');

/**
 * Load and start Broadcast Worker
 */
function main() {
  console.log(`${LOG} Booting worker loader...`);

  // 1. Validate worker file exists
  if (!fs.existsSync(WORKER_FILE_PATH)) {
    console.error(`${LOG} FATAL: Worker file not found!`);
    console.error(`${LOG} Expected at: ${WORKER_FILE_PATH}`);
    process.exit(1);
  }

  // 2. Import worker module safely
  let startBroadcastWorker;
  try {
    ({ startBroadcastWorker } = require(WORKER_FILE_PATH));
  } catch (err) {
    console.error(`${LOG} FATAL: Failed to import broadcast-worker.js`);
    console.error(err);
    process.exit(1);
  }

  // 3. Create stable worker ID
  const workerId =
    process.env.PM2_INSTANCE_ID !== undefined
      ? `pm2-${process.env.PM2_INSTANCE_ID}`
      : `pid-${process.pid}`;

  // 4. Get topic from PM2 args
  const kafkaTopic = process.argv[2];
  if (!kafkaTopic) {
    console.error(`${LOG} FATAL: Missing Kafka topic argument!`);
    console.error(`${LOG} Fix ecosystem.config.js → args: "broadcasts"`);
    process.exit(1);
  }

  console.log(`${LOG} Worker starting →`);
  console.log(`${LOG} ▸ ID: ${workerId}`);
  console.log(`${LOG} ▸ Topic: ${kafkaTopic}`);
  console.log(`${LOG} ▸ File: ${WORKER_FILE_PATH}`);

  // 5. Start worker
  try {
    startBroadcastWorker(workerId, kafkaTopic);
  } catch (err) {
    console.error(`${LOG} CRITICAL ERROR starting worker`);
    console.error(err);
    process.exit(1);
  }
}

main();
