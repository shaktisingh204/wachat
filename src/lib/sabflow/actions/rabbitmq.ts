'use server';

export async function executeRabbitmqAction(actionName: string, inputs: any, user: any, logger: any) {
    const baseUrl = (inputs.baseUrl as string)?.replace(/\/$/, '');
    const username = inputs.username as string;
    const password = inputs.password as string;

    if (!baseUrl) return { error: 'baseUrl is required' };

    const auth = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
    const apiBase = `${baseUrl}/api`;

    try {
        switch (actionName) {
            case 'listQueues': {
                const vhost = inputs.vhost ? encodeURIComponent(inputs.vhost as string) : '%2F';
                const res = await fetch(`${apiBase}/queues/${vhost}`, {
                    headers: { Authorization: auth, 'Content-Type': 'application/json' },
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error || data.reason || 'Failed to list queues' };
                return { output: { queues: data } };
            }
            case 'getQueue': {
                const vhost = inputs.vhost ? encodeURIComponent(inputs.vhost as string) : '%2F';
                const res = await fetch(`${apiBase}/queues/${vhost}/${encodeURIComponent(inputs.queue as string)}`, {
                    headers: { Authorization: auth, 'Content-Type': 'application/json' },
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error || data.reason || 'Failed to get queue' };
                return { output: data };
            }
            case 'createQueue': {
                const vhost = inputs.vhost ? encodeURIComponent(inputs.vhost as string) : '%2F';
                const body: any = {
                    durable: inputs.durable !== false,
                    auto_delete: inputs.autoDelete === true,
                    arguments: inputs.arguments || {},
                };
                const res = await fetch(`${apiBase}/queues/${vhost}/${encodeURIComponent(inputs.queue as string)}`, {
                    method: 'PUT',
                    headers: { Authorization: auth, 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });
                if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    return { error: data.error || data.reason || 'Failed to create queue' };
                }
                return { output: { success: true, queue: inputs.queue } };
            }
            case 'deleteQueue': {
                const vhost = inputs.vhost ? encodeURIComponent(inputs.vhost as string) : '%2F';
                const res = await fetch(`${apiBase}/queues/${vhost}/${encodeURIComponent(inputs.queue as string)}`, {
                    method: 'DELETE',
                    headers: { Authorization: auth },
                });
                if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    return { error: data.error || data.reason || 'Failed to delete queue' };
                }
                return { output: { success: true, queue: inputs.queue } };
            }
            case 'purgeQueue': {
                const vhost = inputs.vhost ? encodeURIComponent(inputs.vhost as string) : '%2F';
                const res = await fetch(`${apiBase}/queues/${vhost}/${encodeURIComponent(inputs.queue as string)}/contents`, {
                    method: 'DELETE',
                    headers: { Authorization: auth },
                });
                if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    return { error: data.error || data.reason || 'Failed to purge queue' };
                }
                return { output: { success: true, queue: inputs.queue } };
            }
            case 'listExchanges': {
                const vhost = inputs.vhost ? encodeURIComponent(inputs.vhost as string) : '%2F';
                const res = await fetch(`${apiBase}/exchanges/${vhost}`, {
                    headers: { Authorization: auth, 'Content-Type': 'application/json' },
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error || data.reason || 'Failed to list exchanges' };
                return { output: { exchanges: data } };
            }
            case 'createExchange': {
                const vhost = inputs.vhost ? encodeURIComponent(inputs.vhost as string) : '%2F';
                const body: any = {
                    type: inputs.type || 'direct',
                    durable: inputs.durable !== false,
                    auto_delete: inputs.autoDelete === true,
                    internal: inputs.internal === true,
                    arguments: inputs.arguments || {},
                };
                const res = await fetch(`${apiBase}/exchanges/${vhost}/${encodeURIComponent(inputs.exchange as string)}`, {
                    method: 'PUT',
                    headers: { Authorization: auth, 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });
                if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    return { error: data.error || data.reason || 'Failed to create exchange' };
                }
                return { output: { success: true, exchange: inputs.exchange } };
            }
            case 'deleteExchange': {
                const vhost = inputs.vhost ? encodeURIComponent(inputs.vhost as string) : '%2F';
                const res = await fetch(`${apiBase}/exchanges/${vhost}/${encodeURIComponent(inputs.exchange as string)}`, {
                    method: 'DELETE',
                    headers: { Authorization: auth },
                });
                if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    return { error: data.error || data.reason || 'Failed to delete exchange' };
                }
                return { output: { success: true, exchange: inputs.exchange } };
            }
            case 'listBindings': {
                const vhost = inputs.vhost ? encodeURIComponent(inputs.vhost as string) : '%2F';
                const res = await fetch(`${apiBase}/bindings/${vhost}`, {
                    headers: { Authorization: auth, 'Content-Type': 'application/json' },
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error || data.reason || 'Failed to list bindings' };
                return { output: { bindings: data } };
            }
            case 'createBinding': {
                const vhost = inputs.vhost ? encodeURIComponent(inputs.vhost as string) : '%2F';
                const body: any = {
                    routing_key: inputs.routingKey || '',
                    arguments: inputs.arguments || {},
                };
                const res = await fetch(`${apiBase}/bindings/${vhost}/e/${encodeURIComponent(inputs.exchange as string)}/q/${encodeURIComponent(inputs.queue as string)}`, {
                    method: 'POST',
                    headers: { Authorization: auth, 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });
                if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    return { error: data.error || data.reason || 'Failed to create binding' };
                }
                return { output: { success: true } };
            }
            case 'publishMessage': {
                const vhost = inputs.vhost ? encodeURIComponent(inputs.vhost as string) : '%2F';
                const body: any = {
                    properties: inputs.properties || {},
                    routing_key: inputs.routingKey || inputs.queue || '',
                    payload: typeof inputs.payload === 'string' ? inputs.payload : JSON.stringify(inputs.payload),
                    payload_encoding: inputs.payloadEncoding || 'string',
                };
                const exchangeName = encodeURIComponent((inputs.exchange as string) || 'amq.default');
                const res = await fetch(`${apiBase}/exchanges/${vhost}/${exchangeName}/publish`, {
                    method: 'POST',
                    headers: { Authorization: auth, 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error || data.reason || 'Failed to publish message' };
                return { output: data };
            }
            case 'getMessages': {
                const vhost = inputs.vhost ? encodeURIComponent(inputs.vhost as string) : '%2F';
                const body: any = {
                    count: inputs.count || 1,
                    ackmode: inputs.ackMode || 'ack_requeue_true',
                    encoding: inputs.encoding || 'auto',
                    truncate: inputs.truncate || 50000,
                };
                const res = await fetch(`${apiBase}/queues/${vhost}/${encodeURIComponent(inputs.queue as string)}/get`, {
                    method: 'POST',
                    headers: { Authorization: auth, 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error || data.reason || 'Failed to get messages' };
                return { output: { messages: data } };
            }
            case 'listVhosts': {
                const res = await fetch(`${apiBase}/vhosts`, {
                    headers: { Authorization: auth, 'Content-Type': 'application/json' },
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error || data.reason || 'Failed to list vhosts' };
                return { output: { vhosts: data } };
            }
            case 'createVhost': {
                const res = await fetch(`${apiBase}/vhosts/${encodeURIComponent(inputs.vhost as string)}`, {
                    method: 'PUT',
                    headers: { Authorization: auth, 'Content-Type': 'application/json' },
                    body: JSON.stringify({}),
                });
                if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    return { error: data.error || data.reason || 'Failed to create vhost' };
                }
                return { output: { success: true, vhost: inputs.vhost } };
            }
            case 'getOverview': {
                const res = await fetch(`${apiBase}/overview`, {
                    headers: { Authorization: auth, 'Content-Type': 'application/json' },
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error || data.reason || 'Failed to get overview' };
                return { output: data };
            }
            default:
                return { error: `Unknown action: ${actionName}` };
        }
    } catch (err: any) {
        logger.error?.(`RabbitMQ action error: ${err.message}`);
        return { error: err.message || 'Unexpected error in RabbitMQ action' };
    }
}
