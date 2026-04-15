'use server';

export async function executeKafkaAction(
  action: string,
  inputs: Record<string, unknown>
): Promise<{ output?: Record<string, unknown>; error?: string }> {
  const brokersRaw = inputs.brokers as string;
  const clientId = (inputs.clientId as string) || 'sabflow-client';
  if (!brokersRaw) return { error: 'Missing brokers' };

  const brokers = brokersRaw.split(',').map((b) => b.trim());

  const { Kafka } = await import('kafkajs');

  const kafkaConfig: Record<string, unknown> = { clientId, brokers };

  if (inputs.ssl === 'true' || inputs.ssl === true) {
    kafkaConfig.ssl = true;
  }

  if (inputs.username && inputs.password) {
    kafkaConfig.sasl = {
      mechanism: 'plain',
      username: inputs.username as string,
      password: inputs.password as string,
    };
  }

  const kafka = new Kafka(kafkaConfig as Parameters<typeof Kafka>[0]);

  switch (action) {
    case 'produce': {
      const topic = inputs.topic as string;
      if (!topic) return { error: 'Missing topic' };

      let messages: Array<{ key?: string; value: string; partition?: number }>;

      if (typeof inputs.messages === 'string') {
        try {
          const parsed = JSON.parse(inputs.messages);
          messages = Array.isArray(parsed) ? parsed : [{ value: String(parsed) }];
        } catch {
          messages = [{ value: inputs.messages }];
        }
      } else if (Array.isArray(inputs.messages)) {
        messages = inputs.messages as typeof messages;
      } else {
        return { error: 'Missing or invalid messages' };
      }

      const kafkaMessages = messages.map((m) => ({
        key: m.key,
        value: String(m.value),
        ...(inputs.partition !== undefined ? { partition: Number(inputs.partition) } : {}),
      }));

      const producer = kafka.producer();
      await producer.connect();
      const result = await producer.send({ topic, messages: kafkaMessages });
      await producer.disconnect();
      return { output: { success: true, result: result as unknown as Record<string, unknown> } };
    }

    case 'createTopics': {
      let topics: Array<{ topic: string; numPartitions?: number; replicationFactor?: number }>;
      if (typeof inputs.topics === 'string') {
        try {
          topics = JSON.parse(inputs.topics);
        } catch {
          return { error: 'Invalid topics JSON' };
        }
      } else if (Array.isArray(inputs.topics)) {
        topics = inputs.topics as typeof topics;
      } else {
        return { error: 'Missing topics' };
      }

      const admin = kafka.admin();
      await admin.connect();
      const result = await admin.createTopics({
        topics: topics.map((t) => ({
          topic: t.topic,
          numPartitions: t.numPartitions || 1,
          replicationFactor: t.replicationFactor || 1,
        })),
      });
      await admin.disconnect();
      return { output: { success: result } };
    }

    case 'deleteTopics': {
      let topicList: string[];
      if (typeof inputs.topics === 'string') {
        try {
          topicList = JSON.parse(inputs.topics);
        } catch {
          topicList = inputs.topics.split(',').map((t) => t.trim());
        }
      } else if (Array.isArray(inputs.topics)) {
        topicList = inputs.topics as string[];
      } else {
        return { error: 'Missing topics' };
      }

      const admin = kafka.admin();
      await admin.connect();
      await admin.deleteTopics({ topics: topicList });
      await admin.disconnect();
      return { output: { success: true, deleted: topicList } };
    }

    case 'listTopics': {
      const admin = kafka.admin();
      await admin.connect();
      const topics = await admin.listTopics();
      await admin.disconnect();
      return { output: { topics } };
    }

    case 'getTopicMetadata': {
      let topicList: string[];
      if (typeof inputs.topics === 'string') {
        try {
          topicList = JSON.parse(inputs.topics);
        } catch {
          topicList = inputs.topics.split(',').map((t) => t.trim());
        }
      } else if (Array.isArray(inputs.topics)) {
        topicList = inputs.topics as string[];
      } else {
        return { error: 'Missing topics' };
      }

      const admin = kafka.admin();
      await admin.connect();
      const metadata = await admin.fetchTopicMetadata({ topics: topicList });
      await admin.disconnect();
      return { output: metadata as unknown as Record<string, unknown> };
    }

    case 'createConsumerGroup': {
      const groupId = inputs.groupId as string;
      const topic = inputs.topic as string;
      if (!groupId || !topic) return { error: 'Missing groupId or topic' };
      const fromBeginning = inputs.fromBeginning === 'true' || inputs.fromBeginning === true;

      const consumer = kafka.consumer({ groupId });
      await consumer.connect();
      await consumer.subscribe({ topic, fromBeginning });

      const collectedMessages: Array<{ key: string | null; value: string | null; partition: number; offset: string }> = [];
      const MAX_MESSAGES = 100;
      const TIMEOUT_MS = 5000;

      await new Promise<void>((resolve) => {
        const timeout = setTimeout(resolve, TIMEOUT_MS);
        consumer.run({
          eachMessage: async ({ message, partition }) => {
            collectedMessages.push({
              key: message.key ? message.key.toString() : null,
              value: message.value ? message.value.toString() : null,
              partition,
              offset: message.offset,
            });
            if (collectedMessages.length >= MAX_MESSAGES) {
              clearTimeout(timeout);
              resolve();
            }
          },
        });
      });

      await consumer.disconnect();
      return { output: { messages: collectedMessages, count: collectedMessages.length } };
    }

    default:
      return { error: `Unknown action: ${action}` };
  }
}
