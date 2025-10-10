const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const cluster = require('cluster');
const os = require('os');
const { startBroadcastWorker } = require('./lib/broadcast-worker');

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const port = parseInt(process.env.PORT, 10) || 3001;

const app = next({ dev, hostname, port, dir: __dirname });
const handle = app.getRequestHandler();

if (cluster.isPrimary) {
  const totalCpus = os.cpus().length;
  // Use a significant portion of CPUs for workers, but leave some for the OS and main Next.js process
  const numWorkers = Math.max(1, Math.floor(totalCpus * 0.8));

  console.log(`\n\x1b[32m[Cluster] Primary process ${process.pid} is running.\x1b[0m`);
  console.log(`\x1b[32m[Cluster] Total Cores: ${totalCpus}, Forking ${numWorkers} broadcast workers.\x1b[0m\n`);

  for (let i = 0; i < numWorkers; i++) {
    cluster.fork();
  }

  cluster.on('exit', (worker, code, signal) => {
    console.log(`\x1b[31m[Cluster] Worker ${worker.process.pid} died. Forking a new one...\x1b[0m`);
    cluster.fork();
  });

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
  console.log(`\x1b[36m[Worker ${process.pid}]\x1b[0m Started and listening to broadcast queue.`);
  startBroadcastWorker(process.pid).catch(err => {
    console.error(`\x1b[31m[Worker ${process.pid}]\x1b[0m encountered a fatal error:`, err, '\x1b[0m');
    process.exit(1); // Exit with an error code, the primary will fork a new one.
  });
}
