'use server';

export async function executeConfluentKafkaAction(actionName: string, inputs: any, user: any, logger: any) {
    const apiKey = inputs.apiKey as string;
    const apiSecret = inputs.apiSecret as string;
    const restProxyUrl = inputs.restProxyUrl as string;
    const baseUrl = 'https://api.confluent.cloud';

    const cloudAuth = `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString('base64')}`;
    const proxyAuth = restProxyUrl
        ? `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString('base64')}`
        : '';

    try {
        switch (actionName) {
            case 'listEnvironments': {
                const res = await fetch(`${baseUrl}/org/v2/environments`, {
                    headers: { Authorization: cloudAuth, 'Content-Type': 'application/json' },
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to list environments' };
                return { output: { environments: data.data || data } };
            }
            case 'listClusters': {
                const environmentId = inputs.environmentId as string;
                const res = await fetch(`${baseUrl}/cmk/v2/clusters?environment=${environmentId}`, {
                    headers: { Authorization: cloudAuth, 'Content-Type': 'application/json' },
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to list clusters' };
                return { output: { clusters: data.data || data } };
            }
            case 'getCluster': {
                const clusterId = inputs.clusterId as string;
                const environmentId = inputs.environmentId as string;
                const res = await fetch(`${baseUrl}/cmk/v2/clusters/${clusterId}?environment=${environmentId}`, {
                    headers: { Authorization: cloudAuth, 'Content-Type': 'application/json' },
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to get cluster' };
                return { output: data };
            }
            case 'listTopics': {
                if (!restProxyUrl) return { error: 'restProxyUrl is required' };
                const res = await fetch(`${restProxyUrl}/topics`, {
                    headers: { Authorization: proxyAuth, 'Content-Type': 'application/json' },
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to list topics' };
                return { output: { topics: data } };
            }
            case 'createTopic': {
                if (!restProxyUrl) return { error: 'restProxyUrl is required' };
                const body = {
                    topic_name: inputs.topicName,
                    partitions_count: inputs.partitions || 1,
                    replication_factor: inputs.replicationFactor || 3,
                    configs: inputs.configs || [],
                };
                const res = await fetch(`${restProxyUrl}/topics`, {
                    method: 'POST',
                    headers: { Authorization: proxyAuth, 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to create topic' };
                return { output: data };
            }
            case 'deleteTopic': {
                if (!restProxyUrl) return { error: 'restProxyUrl is required' };
                const res = await fetch(`${restProxyUrl}/topics/${inputs.topicName}`, {
                    method: 'DELETE',
                    headers: { Authorization: proxyAuth },
                });
                if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    return { error: data.message || 'Failed to delete topic' };
                }
                return { output: { success: true, topicName: inputs.topicName } };
            }
            case 'getTopicConfig': {
                if (!restProxyUrl) return { error: 'restProxyUrl is required' };
                const res = await fetch(`${restProxyUrl}/topics/${inputs.topicName}/configs`, {
                    headers: { Authorization: proxyAuth, 'Content-Type': 'application/json' },
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to get topic config' };
                return { output: { configs: data } };
            }
            case 'updateTopicConfig': {
                if (!restProxyUrl) return { error: 'restProxyUrl is required' };
                const res = await fetch(`${restProxyUrl}/topics/${inputs.topicName}/configs:alter`, {
                    method: 'POST',
                    headers: { Authorization: proxyAuth, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ data: inputs.configs }),
                });
                const data = await res.json().catch(() => ({}));
                if (!res.ok) return { error: data.message || 'Failed to update topic config' };
                return { output: { success: true } };
            }
            case 'produceMessage': {
                if (!restProxyUrl) return { error: 'restProxyUrl is required' };
                const records = inputs.records || [
                    {
                        key: inputs.key ? { type: 'JSON', data: inputs.key } : undefined,
                        value: { type: 'JSON', data: inputs.value },
                    },
                ];
                const res = await fetch(`${restProxyUrl}/topics/${inputs.topicName}`, {
                    method: 'POST',
                    headers: { Authorization: proxyAuth, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ records }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to produce message' };
                return { output: data };
            }
            case 'consumeMessages': {
                if (!restProxyUrl) return { error: 'restProxyUrl is required' };
                const consumerGroup = inputs.consumerGroup as string;
                const consumerId = inputs.consumerId as string;
                const topicName = inputs.topicName as string;
                const createRes = await fetch(`${restProxyUrl}/consumers/${consumerGroup}`, {
                    method: 'POST',
                    headers: { Authorization: proxyAuth, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: consumerId, 'auto.offset.reset': 'earliest', format: 'json' }),
                });
                const consumer = await createRes.json();
                if (!createRes.ok) return { error: consumer.message || 'Failed to create consumer' };
                await fetch(`${restProxyUrl}/consumers/${consumerGroup}/instances/${consumerId}/subscription`, {
                    method: 'POST',
                    headers: { Authorization: proxyAuth, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ topics: [topicName] }),
                });
                const msgsRes = await fetch(`${restProxyUrl}/consumers/${consumerGroup}/instances/${consumerId}/records?max_bytes=${inputs.maxBytes || 1000000}`, {
                    headers: { Authorization: proxyAuth, Accept: 'application/vnd.kafka.json.v2+json' },
                });
                const messages = await msgsRes.json();
                await fetch(`${restProxyUrl}/consumers/${consumerGroup}/instances/${consumerId}`, {
                    method: 'DELETE',
                    headers: { Authorization: proxyAuth },
                });
                return { output: { messages } };
            }
            case 'listConsumerGroups': {
                if (!restProxyUrl) return { error: 'restProxyUrl is required' };
                const res = await fetch(`${restProxyUrl}/consumer-groups`, {
                    headers: { Authorization: proxyAuth, 'Content-Type': 'application/json' },
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to list consumer groups' };
                return { output: { consumerGroups: data } };
            }
            case 'getConsumerGroup': {
                if (!restProxyUrl) return { error: 'restProxyUrl is required' };
                const res = await fetch(`${restProxyUrl}/consumer-groups/${inputs.consumerGroup}`, {
                    headers: { Authorization: proxyAuth, 'Content-Type': 'application/json' },
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to get consumer group' };
                return { output: data };
            }
            case 'deleteConsumerGroup': {
                if (!restProxyUrl) return { error: 'restProxyUrl is required' };
                const res = await fetch(`${restProxyUrl}/consumer-groups/${inputs.consumerGroup}`, {
                    method: 'DELETE',
                    headers: { Authorization: proxyAuth },
                });
                if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    return { error: data.message || 'Failed to delete consumer group' };
                }
                return { output: { success: true, consumerGroup: inputs.consumerGroup } };
            }
            case 'listSchemas': {
                const schemaRegistryUrl = inputs.schemaRegistryUrl as string;
                if (!schemaRegistryUrl) return { error: 'schemaRegistryUrl is required' };
                const schemaAuth = `Basic ${Buffer.from(`${inputs.schemaApiKey}:${inputs.schemaApiSecret}`).toString('base64')}`;
                const res = await fetch(`${schemaRegistryUrl}/subjects`, {
                    headers: { Authorization: schemaAuth, 'Content-Type': 'application/json' },
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to list schemas' };
                return { output: { subjects: data } };
            }
            case 'registerSchema': {
                const schemaRegistryUrl = inputs.schemaRegistryUrl as string;
                if (!schemaRegistryUrl) return { error: 'schemaRegistryUrl is required' };
                const schemaAuth = `Basic ${Buffer.from(`${inputs.schemaApiKey}:${inputs.schemaApiSecret}`).toString('base64')}`;
                const res = await fetch(`${schemaRegistryUrl}/subjects/${inputs.subject}/versions`, {
                    method: 'POST',
                    headers: { Authorization: schemaAuth, 'Content-Type': 'application/vnd.schemaregistry.v1+json' },
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
        logger.error?.(`ConfluentKafka action error: ${err.message}`);
        return { error: err.message || 'Unexpected error in ConfluentKafka action' };
    }
}
