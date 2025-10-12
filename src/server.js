
require('dotenv').config(); // Load environment variables at the very top
const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const cluster = require('cluster');
const os = require('os');
const { startBroadcastWorker } = require('./lib/broadcast-worker.js');

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const port = parseInt(process.env.PORT, 10) || 3001;

const app = next({ dev, hostname, port, dir: __dirname });
const handle = app.getRequestHandler();

// Use PM2 instance variable if available, otherwise fallback to cluster.isPrimary
const isPrimaryProcess = dev ? cluster.isPrimary : (process.env.NODE_APP_INSTANCE === '0' || !process.env.NODE_APP_INSTANCE);
const runWorkers = !dev; // Only run workers in production

if (isPrimaryProcess) {
  if (runWorkers) {
      const totalCpus = os.cpus().length;
      // Leave at least one core for the main app and OS
      const numWorkers = Math.max(1, Math.floor(totalCpus * 0.75));

      console.log(`\n\x1b[32m[Cluster] Primary process ${process.pid} is running.\x1b[0m`);
      console.log(`\x1b[32m[Cluster] Total Cores: ${totalCpus}, Forking ${numWorkers} broadcast workers.\x1b[0m\n`);
      
      const workerEnv = { 
            KAFKA_BROKERS: process.env.KAFKA_BROKERS,
            MONGODB_URI: process.env.MONGODB_URI,
            MONGODB_DB: process.env.MONGODB_DB
        };

      for (let i = 0; i < numWorkers; i++) {
        // Explicitly pass environment variables to the worker
        cluster.fork(workerEnv);
      }

      cluster.on('exit', (worker, code, signal) => {
        console.log(`\x1b[31m[Cluster] Worker ${worker.process.pid} died. Forking a new one...\x1b[0m`);
        // Re-fork with the same environment variables
        cluster.fork(workerEnv);
      });
  }

  // The primary process will also run the Next.js server
  app.prepare().then(() => {
    createServer(async (req, res) => {
      try {
        const parsedUrl = parse(req.url, true);
        await handle(req, res, parsedUrl);
      } catch (err) {
        console.error('Error occurred handling request:', req.url, err);
        res.statusCode = 500;
        res.end('Internal Server Error');
      }
    }).listen(port, () => {
      console.log(`\x1b[36m[Primary]\x1b[0m Next.js server ready on http://localhost:${port}`);
    });
  });
} else {
  // Worker processes will NOT run the Next.js server.
  // They will exclusively process the broadcast queue.
  const workerId = cluster.worker.id;
  console.log(`\x1b[36m[Worker ${workerId}]\x1b[0m Started and listening to broadcast queue.`);
  startBroadcastWorker(workerId).catch(err => {
    console.error(`\x1b[31m[Worker ${workerId}]\x1b[0m encountered a fatal error:`, err, '\x1b[0m');
    process.exit(1); // Exit with an error code, the primary will fork a new one.
  });
}
