const { Kafka } = require('kafkajs');

// --- Configuration ---
const kafka = new Kafka({
  clientId: 'message-producer',
  brokers: ['127.0.0.1:9092'],
});

const producer = kafka.producer({
  // Don't wait for acknowledgements from all replicas. This is faster but less safe.
  // For benchmarking, acks: 1 is a good balance. For max speed, acks: 0.
  acks: 1, 
});

const topic = 'messages';
const totalMessages = 10_000_000; // Total messages to send
const batchSize = 10000; // Number of messages per batch
const concurrency = 10; // Number of concurrent batch sends

let messagesSent = 0;

/**
 * Creates a batch of messages.
 * @param {number} count - The number of messages to create in the batch.
 * @returns {Array<object>} An array of Kafka message objects.
 */
const createMessageBatch = (count) => {
  const messages = [];
  for (let i = 0; i < count; i++) {
    const message = {
      value: JSON.stringify({
        id: messagesSent + i,
        timestamp: Date.now(),
      }),
    };
    messages.push(message);
  }
  return messages;
};

/**
 * Sends batches of messages concurrently until the total is reached.
 */
async function sendBatches() {
  const totalBatches = Math.ceil(totalMessages / batchSize);
  let batchesSent = 0;

  console.log(`Preparing to send ${totalMessages.toLocaleString()} messages in ~${totalBatches.toLocaleString()} batches...`);

  // This function sends one batch and will be called concurrently.
  const send = async () => {
    while (messagesSent < totalMessages) {
      const remaining = totalMessages - messagesSent;
      const currentBatchSize = Math.min(batchSize, remaining);
      
      const messages = createMessageBatch(currentBatchSize);
      
      await producer.send({
        topic,
        messages,
      });

      messagesSent += currentBatchSize;
      batchesSent++;
      
      // Log progress periodically
      if (batchesSent % (concurrency * 2) === 0) {
        process.stdout.write(`Sent ${messagesSent.toLocaleString()} / ${totalMessages.toLocaleString()} messages...\r`);
      }
    }
  };

  // Create an array of concurrent sending promises.
  const concurrentSends = [];
  for (let i = 0; i < concurrency; i++) {
    concurrentSends.push(send());
  }

  // Wait for all concurrent sends to complete.
  await Promise.all(concurrentSends);
}

/**
 * Main function to run the producer.
 */
async function run() {
  console.log('Connecting producer...');
  await producer.connect();
  console.log('Producer connected. Starting message generation...');

  const startTime = Date.now();

  await sendBatches();

  const endTime = Date.now();
  const durationInSeconds = (endTime - startTime) / 1000;
  
  console.log('\n----------------------------------------');
  console.log('Finished sending all messages.');
  console.log(`Total Messages Sent: ${messagesSent.toLocaleString()}`);
  console.log(`Duration: ${durationInSeconds.toFixed(2)} seconds`);
  console.log(`Throughput: ${(messagesSent / durationInSeconds).toFixed(2)} messages/sec`);
  console.log('----------------------------------------');

  await producer.disconnect();
}

run().catch(error => {
  console.error('An error occurred in the producer:', error);
  process.exit(1);
});
