
'use strict';

require('dotenv').config();
const path = require('path');
const fs = require('fs');

const LOG = '[WORKER-LOADER]';
const WORKER_FILE_PATH = path.resolve(__dirname, 'workers', 'broadcast-worker.js');

/**
 * Main function to load and start a worker.
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
    console.error(`${LOG} FATAL: Failed to import broadcast-worker.js`, err);
    process.exit(1);
  }

  // 3. Create stable worker ID
  const workerId = process.env.PM2_INSTANCE_ID !== undefined
      ? `pm2-${process.env.PM2_INSTANCE_ID}`
      : `pid-${process.pid}`;

  // 4. Get Kafka topic from command line arguments (passed by PM2)
  const kafkaTopic = process.argv[2];
  if (!kafkaTopic) {
    console.error(`${LOG} FATAL: Missing Kafka topic argument!`);
    console.error(`${LOG} Correct usage in ecosystem.config.js -> args: ["your-topic-name"]`);
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
