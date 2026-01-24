
'use strict';

require('dotenv').config();
const path = require('path');
const fs = require('fs');

const LOG_PREFIX = '[WORKER-LOADER]';
// **DEFINITIVE FIX:** Use the compiled worker file from the .next build output.
// This assumes that the `src` directory is preserved in the build output path.
const WORKER_FILE_PATH = path.resolve(__dirname, '.next', 'server', 'src', 'workers', 'broadcast-worker.js');


function main() {
  console.log(`${LOG_PREFIX} Booting worker loader...`);

  if (!fs.existsSync(WORKER_FILE_PATH)) {
    console.error(`${LOG_PREFIX} FATAL: Worker file not found!`);
    console.error(`${LOG_PREFIX} Expected at: ${WORKER_FILE_PATH}`);
    // Fallback for development environments where the file might be in src
    const devPath = path.resolve(__dirname, 'src', 'workers', 'broadcast-worker.js');
    if (fs.existsSync(devPath)) {
        console.log(`${LOG_PREFIX} INFO: Falling back to development path. This is not recommended for production.`);
        require(devPath).startBroadcastWorker(getWorkerId(), getKafkaTopic());
        return;
    }
    process.exit(1);
  }

  let startBroadcastWorker;
  try {
    ({ startBroadcastWorker } = require(WORKER_FILE_PATH));
  } catch (err) {
    console.error(`${LOG_PREFIX} FATAL: Failed to import the worker module from ${WORKER_FILE_PATH}`, err);
    process.exit(1);
  }
  
  const workerId = getWorkerId();
  const kafkaTopic = getKafkaTopic();

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

function getWorkerId() {
    return process.env.PM2_INSTANCE_ID !== undefined
      ? `pm2-cluster-${process.env.PM2_INSTANCE_ID}`
      : `pid-${process.pid}`;
}

function getKafkaTopic() {
    const kafkaTopic = process.argv[2];
    if (!kafkaTopic) {
        console.error(`${LOG_PREFIX} FATAL: Missing Kafka topic argument! This is a configuration error.`);
        console.error(`${LOG_PREFIX} Check ecosystem.config.js -> args: ["your-topic-name"]`);
        process.exit(1);
    }
    return kafkaTopic;
}


main();
