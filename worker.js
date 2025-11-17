
'use strict';

require('dotenv').config();
const path = require('path');
const fs = require('fs');

const LOG_PREFIX = '[WORKER-LOADER]';
const WORKER_FILE_PATH = path.resolve(__dirname, 'src', 'workers', 'broadcast-worker.js');

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

  const workerId = process.env.PM2_INSTANCE_ID !== undefined
      ? `pm2-cluster-${process.env.PM2_INSTANCE_ID}`
      : `pid-${process.pid}`;

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

  try {
    startBroadcastWorker(workerId, kafkaTopic);
  } catch (err) {
    console.error(`${LOG_PREFIX} CRITICAL ERROR starting worker process.`);
    console.error(err);
    process.exit(1);
  }
}

main();
