
'use strict';

require('dotenv').config();
const path = require('path');
const fs = require('fs');

const LOG_PREFIX = '[WORKER-LOADER]';
// **DEFINITIVE FIX:** Use path.resolve from the current working directory to get an absolute path.
// This is robust for both development (run with `npm run`) and production (run with `pm2`).
const WORKER_FILE_PATH = path.resolve(process.cwd(), 'src', 'workers', 'broadcast-worker.js');


function main() {
  console.log(`${LOG_PREFIX} Booting worker loader...`);

  if (!fs.existsSync(WORKER_FILE_PATH)) {
    console.error(`${LOG_PREFIX} FATAL: Worker file not found!`);
    console.error(`${LOG_PREFIX} Expected at: ${WORKER_FILE_PATH}`);
    process.exit(1);
  }

  let startBroadcastWorker;
  try {
    // We can now safely require the worker using its absolute path.
    ({ startBroadcastWorker } = require(WORKER_FILE_PATH));
  } catch (err) {
    console.error(`${LOG_PREFIX} FATAL: Failed to import the worker module from ${WORKER_FILE_PATH}`, err);
    process.exit(1);
  }
  
  const workerId = process.env.PM2_INSTANCE_ID !== undefined
      ? `pm2-cluster-${process.env.PM2_INSTANCE_ID}`
      : `pid-${process.pid}`;

  const kafkaTopic = process.argv[2];
  if (!kafkaTopic) {
    console.error(`${LOG_PREFIX} FATAL: Missing Kafka topic argument! Check ecosystem.config.js.`);
    process.exit(1);
  }

  console.log(`${LOG_PREFIX} Worker starting...`);
  console.log(`${LOG_PREFIX} ▸ Worker ID: ${workerId}`);
  console.log(`${LOG_PREFIX} ▸ Kafka Topic: ${kafkaTopic}`);

  try {
    startBroadcastWorker(workerId, kafkaTopic);
  } catch (err) {
    console.error(`${LOG_PREFIX} CRITICAL ERROR starting worker process.`, err);
    process.exit(1);
  }
}

main();
