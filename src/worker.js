
'use strict';

const path = require('path');
// Ensure dotenv is configured to find the .env file in the project root
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const fs = require('fs');

const LOG_PREFIX = '[WORKER-LOADER]';
// **DEFINITIVE FIX:** Correct path to the worker file inside the /workers directory.
const WORKER_FILE_PATH = path.resolve(__dirname, 'workers', 'broadcast-worker.js');

function main() {
  console.log(`${LOG_PREFIX} Booting worker loader...`);

  if (!fs.existsSync(WORKER_FILE_PATH)) {
    console.error(`${LOG_PREFIX} FATAL: Worker file not found!`);
    console.error(`${LOG_PREFIX} Expected at: ${WORKER_FILE_PATH}`);
    process.exit(1);
  }

  let startBroadcastWorker;
  try {
    ({ startBroadcastWorker } = require(WORKER_FILE_PATH));
  } catch (err) {
    console.error(`${LOG_PREFIX} FATAL: Failed to import the worker module from broadcast-worker.js`, err);
    process.exit(1);
  }

  // **DEFINITIVE FIX:** Generate a stable and unique worker ID for PM2 cluster mode.
  const workerId = process.env.PM2_INSTANCE_ID !== undefined
      ? `pm2-cluster-${process.env.PM2_INSTANCE_ID}`
      : `pid-${process.pid}`;

  // **DEFINITIVE FIX:** PM2 passes arguments as an array of strings. We need the first one after the script name.
  const kafkaTopic = process.argv[2];
  if (!kafkaTopic) {
    console.error(`${LOG_PREFIX} FATAL: Missing Kafka topic argument! This is a configuration error.`);
    console.error(`${LOG_PREFIX} Check ecosystem.config.js -> args: ["your-topic-name"]`);
    process.exit(1);
  }

  console.log(`${LOG_PREFIX} Worker starting with the following configuration:`);
  console.log(`${LOG_PREFIX} ▸ Worker ID: ${workerId}`);
  console.log(`${LOG_PREFIX} ▸ Kafka Topic: ${kafkaTopic}`);
  console.log(`${LOG_PREFIX} ▸ Worker File: ${WORKER_FILE_PATH}`);

  try {
    startBroadcastWorker(workerId, kafkaTopic);
  } catch (err) {
    console.error(`${LOG_PREFIX} CRITICAL ERROR starting worker process.`);
    console.error(err);
    process.exit(1);
  }
}

main();
