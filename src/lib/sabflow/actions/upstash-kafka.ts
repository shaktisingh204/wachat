'use server';

export async function executeUpstashKafkaAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const { username, password, restUrl } = inputs;

        if (!username || !password || !restUrl) {
            return { error: 'Missing required credentials: username, password, and restUrl' };
        }

        const basicAuth = Buffer.from(`${username}:${password}`).toString('base64');
        const baseUrl = restUrl.replace(/\/$/, '');

        const headers: Record<string, string> = {
            'Authorization': `Basic ${basicAuth}`,
            'Content-Type': 'application/json',
        };

        const apiFetch = async (path: string, method = 'GET', body?: any) => {
            const res = await fetch(`${baseUrl}${path}`, {
                method,
                headers,
                body: body !== undefined ? JSON.stringify(body) : undefined,
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.message || data?.error || `HTTP ${res.status}`);
            return data;
        };

        logger.log(`Executing Upstash Kafka action: ${actionName}`);

        switch (actionName) {
            case 'produce': {
                const payload = {
                    topic: inputs.topic,
                    messages: [{ value: typeof inputs.value === 'string' ? inputs.value : JSON.stringify(inputs.value) }],
                };
                const data = await apiFetch('/produce', 'POST', payload);
                return { output: { result: data } };
            }
            case 'produceBatch': {
                const messages = Array.isArray(inputs.messages) ? inputs.messages : [];
                const data = await apiFetch('/produce/batch', 'POST', { topic: inputs.topic, messages });
                return { output: { result: data } };
            }
            case 'consume': {
                const params = new URLSearchParams({ topic: inputs.topic });
                if (inputs.groupId) params.append('groupId', inputs.groupId);
                if (inputs.maxCount) params.append('maxCount', String(inputs.maxCount));
                const data = await apiFetch(`/consume?${params.toString()}`);
                return { output: { messages: data } };
            }
            case 'commitOffset': {
                const data = await apiFetch('/commit', 'POST', {
                    topic: inputs.topic,
                    groupId: inputs.groupId,
                    partition: inputs.partition,
                    offset: inputs.offset,
                });
                return { output: { result: data } };
            }
            case 'listTopics': {
                const data = await apiFetch('/topics');
                return { output: { topics: data } };
            }
            case 'getTopicMetadata': {
                const data = await apiFetch(`/topics/${encodeURIComponent(inputs.topic)}`);
                return { output: { metadata: data } };
            }
            case 'createTopic': {
                const body: any = { name: inputs.topic };
                if (inputs.partitions) body.partitions = inputs.partitions;
                if (inputs.replicationFactor) body.replicationFactor = inputs.replicationFactor;
                const data = await apiFetch('/topics', 'POST', body);
                return { output: { result: data } };
            }
            case 'deleteTopic': {
                const data = await apiFetch(`/topics/${encodeURIComponent(inputs.topic)}`, 'DELETE');
                return { output: { result: data } };
            }
            case 'listConsumerGroups': {
                const data = await apiFetch('/consumer-groups');
                return { output: { groups: data } };
            }
            case 'getConsumerGroup': {
                const data = await apiFetch(`/consumer-groups/${encodeURIComponent(inputs.groupId)}`);
                return { output: { group: data } };
            }
            case 'deleteConsumerGroup': {
                const data = await apiFetch(`/consumer-groups/${encodeURIComponent(inputs.groupId)}`, 'DELETE');
                return { output: { result: data } };
            }
            case 'getOffsets': {
                const data = await apiFetch(`/offsets?topic=${encodeURIComponent(inputs.topic)}&groupId=${encodeURIComponent(inputs.groupId)}`);
                return { output: { offsets: data } };
            }
            case 'setOffsets': {
                const data = await apiFetch('/offsets', 'POST', {
                    topic: inputs.topic,
                    groupId: inputs.groupId,
                    offsets: inputs.offsets,
                });
                return { output: { result: data } };
            }
            case 'listPartitions': {
                const data = await apiFetch(`/topics/${encodeURIComponent(inputs.topic)}/partitions`);
                return { output: { partitions: data } };
            }
            case 'getPartitionInfo': {
                const data = await apiFetch(`/topics/${encodeURIComponent(inputs.topic)}/partitions/${inputs.partition}`);
                return { output: { partition: data } };
            }
            default:
                return { error: `Unknown action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Upstash Kafka action error: ${err.message}`);
        return { error: err.message || 'Upstash Kafka action failed' };
    }
}
