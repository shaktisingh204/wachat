
const { Kafka } = require('kafkajs');
const cluster = require('cluster');
const os = require('os');

const numCPUs = os.cpus().length;
const kafkaBrokers = ['127.0.0.1:9092'];
const topic = 'messages';
const groupId = 'message-group';

if (cluster.isPrimary) {
  console.log(`Primary ${process.pid} is running`);
  console.log(`Forking for ${numCPUs} CPUs`);

  // Fork workers.
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork({ WORKER_ID: i + 1 });
  }

  cluster.on('exit', (worker, code, signal) => {
    console.log(`Worker ${worker.process.pid} died. Forking a new one...`);
    cluster.fork({ WORKER_ID: worker.process.env.WORKER_ID });
  });

} else {
  // Worker processes create their own Kafka consumer.
  const workerId = process.env.WORKER_ID;
  let messageCount = 0;
  let lastLogTime = Date.now();

  const kafka = new Kafka({
    clientId: `message-processor-${workerId}`,
    brokers: kafkaBrokers,
  });

  const consumer = kafka.consumer({ groupId: groupId });

  const run = async () => {
    await consumer.connect();
    await consumer.subscribe({ topic: topic, fromBeginning: false });
    console.log(`Worker ${workerId} (${process.pid}) subscribed to topic "${topic}"`);

    // Setup periodic metrics logging
    setInterval(() => {
        const now = Date.now();
        const durationInSeconds = (now - lastLogTime) / 1000;
        if (durationInSeconds > 0) {
            const messagesPerSecond = (messageCount / durationInSeconds).toFixed(2);
            console.log(`[Worker ${workerId}] Throughput: ${messagesPerSecond} messages/sec`);
        }
        messageCount = 0;
        lastLogTime = now;
    }, 5000); // Log metrics every 5 seconds

    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        // Minimal processing to keep CPU usage low
        const msg = message.value.toString();
        messageCount++;

        // Example of minimal async work (optional)
        // await new Promise(resolve => setImmediate(resolve)); 
      },
    });
  };

  run().catch(error => {
    console.error(`[Worker ${workerId}] Error occurred:`, error);
    process.exit(1);
  });
}
