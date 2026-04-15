'use server';

export async function executeNatsAction(actionName: string, inputs: any, user: any, logger: any) {
    const baseUrl = (inputs.baseUrl as string)?.replace(/\/$/, '');

    if (!baseUrl) return { error: 'baseUrl is required' };

    const buildHeaders = (): Record<string, string> => {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (inputs.token) {
            headers['Authorization'] = `Bearer ${inputs.token}`;
        } else if (inputs.username && inputs.password) {
            headers['Authorization'] = `Basic ${Buffer.from(`${inputs.username}:${inputs.password}`).toString('base64')}`;
        }
        return headers;
    };

    try {
        switch (actionName) {
            case 'publishMessage': {
                const subject = inputs.subject as string;
                if (!subject) return { error: 'subject is required' };
                const payload = typeof inputs.payload === 'string' ? inputs.payload : JSON.stringify(inputs.payload);
                const res = await fetch(`${baseUrl}/publish/${encodeURIComponent(subject)}`, {
                    method: 'POST',
                    headers: buildHeaders(),
                    body: payload,
                });
                if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    return { error: data.description || data.error || 'Failed to publish message' };
                }
                return { output: { success: true, subject } };
            }
            case 'getServerInfo': {
                const res = await fetch(`${baseUrl}/varz`, {
                    headers: buildHeaders(),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.description || data.error || 'Failed to get server info' };
                return { output: data };
            }
            case 'listStreams': {
                const res = await fetch(`${baseUrl}/jsz?streams=true&consumer=true`, {
                    headers: buildHeaders(),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.description || data.error || 'Failed to list streams' };
                return { output: { streams: data.account_details?.[0]?.stream_detail || data.streams || [] } };
            }
            case 'createStream': {
                const body: any = {
                    name: inputs.name,
                    subjects: inputs.subjects || [`${inputs.name}.>`],
                    storage: inputs.storage || 'file',
                    retention: inputs.retention || 'limits',
                    max_consumers: inputs.maxConsumers || -1,
                    max_msgs: inputs.maxMsgs || -1,
                    max_bytes: inputs.maxBytes || -1,
                    max_age: inputs.maxAge || 0,
                    max_msg_size: inputs.maxMsgSize || -1,
                    num_replicas: inputs.numReplicas || 1,
                };
                const res = await fetch(`${baseUrl}/js/api/STREAM.CREATE.${inputs.name}`, {
                    method: 'POST',
                    headers: buildHeaders(),
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok || data.error) return { error: data.error?.description || data.description || 'Failed to create stream' };
                return { output: data };
            }
            case 'updateStream': {
                const body: any = {
                    name: inputs.name,
                    subjects: inputs.subjects,
                    storage: inputs.storage,
                    max_consumers: inputs.maxConsumers,
                    max_msgs: inputs.maxMsgs,
                    max_bytes: inputs.maxBytes,
                    max_age: inputs.maxAge,
                    num_replicas: inputs.numReplicas,
                };
                const res = await fetch(`${baseUrl}/js/api/STREAM.UPDATE.${inputs.name}`, {
                    method: 'POST',
                    headers: buildHeaders(),
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok || data.error) return { error: data.error?.description || data.description || 'Failed to update stream' };
                return { output: data };
            }
            case 'deleteStream': {
                const res = await fetch(`${baseUrl}/js/api/STREAM.DELETE.${inputs.name}`, {
                    method: 'POST',
                    headers: buildHeaders(),
                    body: '{}',
                });
                const data = await res.json();
                if (!res.ok || data.error) return { error: data.error?.description || data.description || 'Failed to delete stream' };
                return { output: { success: data.success, stream: inputs.name } };
            }
            case 'getStreamInfo': {
                const res = await fetch(`${baseUrl}/js/api/STREAM.INFO.${inputs.name}`, {
                    method: 'POST',
                    headers: buildHeaders(),
                    body: '{}',
                });
                const data = await res.json();
                if (!res.ok || data.error) return { error: data.error?.description || data.description || 'Failed to get stream info' };
                return { output: data };
            }
            case 'listConsumers': {
                const res = await fetch(`${baseUrl}/js/api/CONSUMER.LIST.${inputs.stream}`, {
                    method: 'POST',
                    headers: buildHeaders(),
                    body: '{}',
                });
                const data = await res.json();
                if (!res.ok || data.error) return { error: data.error?.description || data.description || 'Failed to list consumers' };
                return { output: { consumers: data.consumers || [] } };
            }
            case 'createConsumer': {
                const body: any = {
                    stream_name: inputs.stream,
                    config: {
                        durable_name: inputs.durableName,
                        deliver_policy: inputs.deliverPolicy || 'all',
                        ack_policy: inputs.ackPolicy || 'explicit',
                        filter_subject: inputs.filterSubject,
                        max_deliver: inputs.maxDeliver || -1,
                        ack_wait: inputs.ackWait || 30000000000,
                    },
                };
                const path = inputs.durableName
                    ? `CONSUMER.DURABLE.CREATE.${inputs.stream}.${inputs.durableName}`
                    : `CONSUMER.CREATE.${inputs.stream}`;
                const res = await fetch(`${baseUrl}/js/api/${path}`, {
                    method: 'POST',
                    headers: buildHeaders(),
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok || data.error) return { error: data.error?.description || data.description || 'Failed to create consumer' };
                return { output: data };
            }
            case 'deleteConsumer': {
                const res = await fetch(`${baseUrl}/js/api/CONSUMER.DELETE.${inputs.stream}.${inputs.consumer}`, {
                    method: 'POST',
                    headers: buildHeaders(),
                    body: '{}',
                });
                const data = await res.json();
                if (!res.ok || data.error) return { error: data.error?.description || data.description || 'Failed to delete consumer' };
                return { output: { success: data.success } };
            }
            case 'getConsumerInfo': {
                const res = await fetch(`${baseUrl}/js/api/CONSUMER.INFO.${inputs.stream}.${inputs.consumer}`, {
                    method: 'POST',
                    headers: buildHeaders(),
                    body: '{}',
                });
                const data = await res.json();
                if (!res.ok || data.error) return { error: data.error?.description || data.description || 'Failed to get consumer info' };
                return { output: data };
            }
            case 'fetchMessage': {
                const body: any = {
                    batch: inputs.batch || 1,
                    expires: inputs.expires || 5000000000,
                };
                const res = await fetch(`${baseUrl}/js/api/CONSUMER.MSG.NEXT.${inputs.stream}.${inputs.consumer}`, {
                    method: 'POST',
                    headers: buildHeaders(),
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok || data.error) return { error: data.error?.description || data.description || 'Failed to fetch message' };
                return { output: data };
            }
            case 'acknowledgeMessage': {
                const replyTo = inputs.replyTo as string;
                if (!replyTo) return { error: 'replyTo is required for acknowledgement' };
                const res = await fetch(`${baseUrl}/publish/${encodeURIComponent(replyTo)}`, {
                    method: 'POST',
                    headers: buildHeaders(),
                    body: '',
                });
                if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    return { error: data.description || 'Failed to acknowledge message' };
                }
                return { output: { success: true } };
            }
            case 'listAccountInfo': {
                const res = await fetch(`${baseUrl}/js/api/INFO`, {
                    method: 'POST',
                    headers: buildHeaders(),
                    body: '{}',
                });
                const data = await res.json();
                if (!res.ok || data.error) return { error: data.error?.description || data.description || 'Failed to get account info' };
                return { output: data };
            }
            case 'getHealth': {
                const res = await fetch(`${baseUrl}/healthz`, {
                    headers: buildHeaders(),
                });
                const data = await res.json().catch(() => ({ status: res.ok ? 'ok' : 'error' }));
                return { output: { healthy: res.ok, status: data.status || (res.ok ? 'ok' : 'error'), details: data } };
            }
            default:
                return { error: `Unknown action: ${actionName}` };
        }
    } catch (err: any) {
        logger.error?.(`NATS action error: ${err.message}`);
        return { error: err.message || 'Unexpected error in NATS action' };
    }
}
