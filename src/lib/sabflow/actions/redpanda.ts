'use server';

export async function executeRedpandaAction(actionName: string, inputs: any, user: any, logger: any) {
    const baseUrl = (inputs.baseUrl as string)?.replace(/\/$/, '');
    const username = inputs.username as string;
    const password = inputs.password as string;

    if (!baseUrl) return { error: 'baseUrl is required' };

    const auth = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
    const adminBase = `${baseUrl}/v1`;

    const buildHeaders = (): Record<string, string> => ({
        Authorization: auth,
        'Content-Type': 'application/json',
    });

    try {
        switch (actionName) {
            case 'getClusterInfo': {
                const res = await fetch(`${adminBase}/cluster`, {
                    headers: buildHeaders(),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to get cluster info' };
                return { output: data };
            }
            case 'listBrokers': {
                const res = await fetch(`${adminBase}/brokers`, {
                    headers: buildHeaders(),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to list brokers' };
                return { output: { brokers: data } };
            }
            case 'getBrokerConfig': {
                const brokerId = inputs.brokerId as string | number;
                const res = await fetch(`${adminBase}/brokers/${brokerId}/config`, {
                    headers: buildHeaders(),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to get broker config' };
                return { output: { config: data } };
            }
            case 'listTopics': {
                const res = await fetch(`${adminBase}/topics`, {
                    headers: buildHeaders(),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to list topics' };
                return { output: { topics: data } };
            }
            case 'createTopic': {
                const body: any = {
                    name: inputs.topicName,
                    partition_count: inputs.partitions || 1,
                    replication_factor: inputs.replicationFactor || 1,
                    properties: inputs.properties || {},
                };
                const res = await fetch(`${adminBase}/topics`, {
                    method: 'POST',
                    headers: buildHeaders(),
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to create topic' };
                return { output: data };
            }
            case 'deleteTopic': {
                const res = await fetch(`${adminBase}/topics/${encodeURIComponent(inputs.topicName as string)}`, {
                    method: 'DELETE',
                    headers: buildHeaders(),
                });
                if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    return { error: data.message || 'Failed to delete topic' };
                }
                return { output: { success: true, topicName: inputs.topicName } };
            }
            case 'getTopicConfig': {
                const res = await fetch(`${adminBase}/topics/${encodeURIComponent(inputs.topicName as string)}/config`, {
                    headers: buildHeaders(),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to get topic config' };
                return { output: { config: data } };
            }
            case 'updateTopicConfig': {
                const body: any = inputs.configs || [];
                const res = await fetch(`${adminBase}/topics/${encodeURIComponent(inputs.topicName as string)}/config`, {
                    method: 'PATCH',
                    headers: buildHeaders(),
                    body: JSON.stringify(body),
                });
                const data = await res.json().catch(() => ({}));
                if (!res.ok) return { error: data.message || 'Failed to update topic config' };
                return { output: { success: true, config: data } };
            }
            case 'produceMessage': {
                const kafkaRestUrl = inputs.kafkaRestUrl ? (inputs.kafkaRestUrl as string).replace(/\/$/, '') : baseUrl;
                const records = Array.isArray(inputs.records)
                    ? inputs.records
                    : [{ value: inputs.value, key: inputs.key }];
                const res = await fetch(`${kafkaRestUrl}/topics/${encodeURIComponent(inputs.topicName as string)}`, {
                    method: 'POST',
                    headers: {
                        Authorization: auth,
                        'Content-Type': 'application/vnd.kafka.json.v2+json',
                    },
                    body: JSON.stringify({ records }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || data.error_code || 'Failed to produce message' };
                return { output: data };
            }
            case 'fetchMessages': {
                const kafkaRestUrl = inputs.kafkaRestUrl ? (inputs.kafkaRestUrl as string).replace(/\/$/, '') : baseUrl;
                const consumerGroup = inputs.consumerGroup as string;
                const consumerId = inputs.consumerId || `consumer-${Date.now()}`;
                const createRes = await fetch(`${kafkaRestUrl}/consumers/${consumerGroup}`, {
                    method: 'POST',
                    headers: {
                        Authorization: auth,
                        'Content-Type': 'application/vnd.kafka.v2+json',
                    },
                    body: JSON.stringify({ name: consumerId, format: 'json', 'auto.offset.reset': 'earliest' }),
                });
                const consumer = await createRes.json();
                if (!createRes.ok) return { error: consumer.message || 'Failed to create consumer' };
                await fetch(`${kafkaRestUrl}/consumers/${consumerGroup}/instances/${consumerId}/subscription`, {
                    method: 'POST',
                    headers: { Authorization: auth, 'Content-Type': 'application/vnd.kafka.v2+json' },
                    body: JSON.stringify({ topics: [inputs.topicName] }),
                });
                const msgsRes = await fetch(`${kafkaRestUrl}/consumers/${consumerGroup}/instances/${consumerId}/records?max_bytes=${inputs.maxBytes || 1000000}`, {
                    headers: { Authorization: auth, Accept: 'application/vnd.kafka.json.v2+json' },
                });
                const messages = await msgsRes.json();
                await fetch(`${kafkaRestUrl}/consumers/${consumerGroup}/instances/${consumerId}`, {
                    method: 'DELETE',
                    headers: { Authorization: auth },
                });
                return { output: { messages } };
            }
            case 'listConsumerGroups': {
                const res = await fetch(`${adminBase}/consumer-groups`, {
                    headers: buildHeaders(),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to list consumer groups' };
                return { output: { consumerGroups: data } };
            }
            case 'getConsumerGroup': {
                const res = await fetch(`${adminBase}/consumer-groups/${encodeURIComponent(inputs.consumerGroup as string)}`, {
                    headers: buildHeaders(),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to get consumer group' };
                return { output: data };
            }
            case 'deleteConsumerGroup': {
                const res = await fetch(`${adminBase}/consumer-groups/${encodeURIComponent(inputs.consumerGroup as string)}`, {
                    method: 'DELETE',
                    headers: buildHeaders(),
                });
                if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    return { error: data.message || 'Failed to delete consumer group' };
                }
                return { output: { success: true, consumerGroup: inputs.consumerGroup } };
            }
            case 'listSchemas': {
                const schemaRegistryUrl = inputs.schemaRegistryUrl ? (inputs.schemaRegistryUrl as string).replace(/\/$/, '') : baseUrl;
                const res = await fetch(`${schemaRegistryUrl}/subjects`, {
                    headers: buildHeaders(),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to list schemas' };
                return { output: { subjects: data } };
            }
            case 'registerSchema': {
                const schemaRegistryUrl = inputs.schemaRegistryUrl ? (inputs.schemaRegistryUrl as string).replace(/\/$/, '') : baseUrl;
                const res = await fetch(`${schemaRegistryUrl}/subjects/${encodeURIComponent(inputs.subject as string)}/versions`, {
                    method: 'POST',
                    headers: buildHeaders(),
                    body: JSON.stringify({ schema: inputs.schema, schemaType: inputs.schemaType || 'AVRO' }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to register schema' };
                return { output: data };
            }
            default:
                return { error: `Unknown action: ${actionName}` };
        }
    } catch (err: any) {
        logger.error?.(`Redpanda action error: ${err.message}`);
        return { error: err.message || 'Unexpected error in Redpanda action' };
    }
}
