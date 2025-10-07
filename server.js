
const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const cluster = require('cluster');
const os = require('os');

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0'; // Changed from 'localhost' for production environments
const port = parseInt(process.env.PORT, 10) || 3001;

// For Next.js app
const app = next({ dev, hostname, port, dir: __dirname });
const handle = app.getRequestHandler();

if (cluster.isPrimary) {
  const totalCpus = os.cpus().length;
  // Reserve 10% of CPUs, ensure at least 1 core is used for the app
  const numCPUs = Math.max(1, Math.floor(totalCpus * 0.9)); 
  
  console.log(`\n\x1b[32m[Cluster] Primary process ${process.pid} is running.\x1b[0m`);
  console.log(`\x1b[32m[Cluster] Total Cores: ${totalCpus}, Using: ${numCPUs} (90%) for workers.\x1b[0m\n`);

  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on('exit', (worker, code, signal) => {
    console.log(`\x1b[31m[Cluster] Worker ${worker.process.pid} died. Forking a new one...\x1b[0m`);
    cluster.fork();
  });

} else {
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
    })
    .once('error', (err) => {
        console.error(err);
        process.exit(1);
    })
    .listen(port, () => {
      console.log(`\x1b[36m[Worker ${process.pid}]\x1b[0m Next.js server ready on http://localhost:${port}`);
    });
  });
}
