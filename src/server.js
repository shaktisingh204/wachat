
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

const isPrimaryProcess = dev ? cluster.isPrimary : (process.env.NODE_APP_INSTANCE === '0' || !process.env.NODE_APP_INSTANCE);
const runWorkers = !dev;

if (isPrimaryProcess) {
  if (runWorkers) {
      const totalCpus = os.cpus().length;
      const numWorkers = Math.max(1, Math.floor(totalCpus * 0.75));

      console.log(`\n\x1b[32m[Cluster] Primary process ${process.pid} is running.\x1b[0m`);
      console.log(`\x1b[32m[Cluster] Total Cores: ${totalCpus}, Forking ${numWorkers} broadcast workers.\x1b[0m\n`);
      
      // Correctly set up environment variables for all forked workers
      cluster.setupPrimary({
        exec: __filename, // This ensures workers run this same file
        env: {
            ...process.env, // Pass all existing env vars
            NODE_ENV: 'production', // Ensure workers know they are in production
            // Any other specific vars could be added here if needed
        }
      });

      for (let i = 0; i < numWorkers; i++) {
        cluster.fork();
      }

      cluster.on('exit', (worker, code, signal) => {
        console.log(`\x1b[31m[Cluster] Worker ${worker.process.pid} died. Forking a new one...\x1b[0m`);
        cluster.fork();
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
  // This code path is ONLY executed by the forked worker processes in production
  if (runWorkers) {
    const workerId = cluster.worker.id;
    console.log(`\x1b[36m[Worker ${workerId}]\x1b[0m Started and listening to broadcast queue.`);
    startBroadcastWorker(workerId).catch(err => {
      console.error(`\x1b[31m[Worker ${workerId}]\x1b[0m encountered a fatal error:`, err, '\x1b[0m');
      process.exit(1); 
    });
  }
}
