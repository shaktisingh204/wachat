
const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const cluster = require('cluster');
const os = require('os');
const { getRedisClient } = require('./lib/redis'); // Using require for JS file
const axios = require('axios');

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const port = parseInt(process.env.PORT, 10) || 3001;

const app = next({ dev, hostname, port, dir: __dirname });
const handle = app.getRequestHandler();

const REDIS_QUEUE_NAME = 'broadcast-queue';
const API_VERSION = 'v23.0';

async function sendWhatsAppMessage(task) {
    try {
        const {
            jobId, contactId, accessToken, phoneNumberId, templateName,
            language, components, headerImageUrl, headerMediaId, contact
        } = task;

        const getVars = (text) => {
             if (!text) return [];
            const variableMatches = text.match(/{{\s*(\d+)\s*}}/g);
            return variableMatches 
                ? [...new Set(variableMatches.map(v => parseInt(v.replace(/{{\s*|\s*}}/g, ''))))] 
                : [];
        }

        const payloadComponents = [];
        const headerComponent = components.find(c => c.type === 'HEADER');
        if (headerComponent) {
            let parameter;
            const format = headerComponent.format?.toLowerCase();
            if (headerMediaId) {
                parameter = { type: format, [format]: { id: headerMediaId } };
            } else if (headerImageUrl) {
                 parameter = { type: format, [format]: { link: headerImageUrl } };
            }
            if (parameter) {
                 payloadComponents.push({ type: 'header', parameters: [parameter] });
            }
        }

        const bodyComponent = components.find(c => c.type === 'BODY');
        if (bodyComponent?.text) {
            const bodyVars = getVars(bodyComponent.text);
            if (bodyVars.length > 0) {
                const parameters = bodyVars.sort((a,b) => a-b).map(varNum => ({ type: 'text', text: contact[`variable${varNum}`] || '' }));
                payloadComponents.push({ type: 'body', parameters });
            }
        }
        
        const messageData = {
            messaging_product: 'whatsapp', to: contact.phone, recipient_type: 'individual', type: 'template',
            template: { name: templateName, language: { code: language || 'en_US' }, ...(payloadComponents.length > 0 && { components: payloadComponents }) },
        };
        
        const response = await axios.post(
            `https://graph.facebook.com/${API_VERSION}/${phoneNumberId}/messages`,
            messageData,
            { headers: { 'Authorization': `Bearer ${accessToken}` } }
        );
        
        // Optionally, you can have another Redis list or process to handle success/failure status updates
        // For now, we'll log it.
        // console.log(`Worker ${process.pid}: Sent message to ${contact.phone} for job ${jobId}`);

    } catch (error) {
        // console.error(`Worker ${process.pid}: Failed to send message to ${contact.phone}`, error.response?.data || error.message);
        // Add to a "failed jobs" list in Redis for retry?
    }
}

async function processQueue(redisClient) {
  while (true) {
    try {
      const result = await redisClient.brPop(REDIS_QUEUE_NAME, 0); // Blocking pop
      if (result) {
        const task = JSON.parse(result.element);
        await sendWhatsAppMessage(task);
      }
    } catch (err) {
      console.error(`Worker ${process.pid}: Error processing queue`, err);
      // Wait a bit before retrying to prevent a tight loop on persistent errors
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

if (cluster.isPrimary) {
  const totalCpus = os.cpus().length;
  // Use all available cores for maximum throughput
  const numCPUs = totalCpus; 
  
  console.log(`\n\x1b[32m[Cluster] Primary process ${process.pid} is running.\x1b[0m`);
  console.log(`\x1b[32m[Cluster] Total Cores: ${totalCpus}, Forking ${numCPUs} workers.\x1b[0m\n`);

  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on('exit', (worker, code, signal) => {
    console.log(`\x1b[31m[Cluster] Worker ${worker.process.pid} died. Forking a new one...\x1b[0m`);
    cluster.fork();
  });

} else {
  // This code runs in each worker process
  app.prepare().then(async () => {
    // Each worker gets its own Redis client
    const redisClient = await getRedisClient();
    
    // Start processing the broadcast queue
    processQueue(redisClient).catch(err => console.error(`Worker ${process.pid} queue processing failed permanently:`, err));

    createServer(async (req, res) => {
      try {
        const parsedUrl = parse(req.url, true);
        await handle(req, res, parsedUrl);
      } catch (err) {
        console.error(`Worker ${process.pid}: Error handling request:`, req.url, err);
        res.statusCode = 500;
        res.end('Internal Server Error');
      }
    })
    .once('error', (err) => {
        console.error(`Worker ${process.pid} server error:`, err);
        process.exit(1);
    })
    .listen(port, () => {
      console.log(`\x1b[36m[Worker ${process.pid}]\x1b[0m Next.js server ready on http://localhost:${port}`);
    });
  });
}
