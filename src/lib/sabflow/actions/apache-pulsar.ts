'use server';

export async function executeApachePulsarAction(actionName: string, inputs: any, user: any, logger: any) {
    const serviceUrl = (inputs.serviceUrl as string)?.replace(/\/$/, '');
    const token = inputs.token as string;

    if (!serviceUrl) return { error: 'serviceUrl is required' };

    const adminBase = `${serviceUrl}/admin/v3`;
    const buildHeaders = (extra?: Record<string, string>): Record<string, string> => {
        const headers: Record<string, string> = { 'Content-Type': 'application/json', ...extra };
        if (token) headers['Authorization'] = `Bearer ${token}`;
        return headers;
    };

    try {
        switch (actionName) {
            case 'listTenants': {
                const res = await fetch(`${adminBase}/tenants`, {
                    headers: buildHeaders(),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.reason || data.message || 'Failed to list tenants' };
                return { output: { tenants: data } };
            }
            case 'createTenant': {
                const body: any = {
                    adminRoles: inputs.adminRoles || [],
                    allowedClusters: inputs.allowedClusters || [],
                };
                const res = await fetch(`${adminBase}/tenants/${encodeURIComponent(inputs.tenant as string)}`, {
                    method: 'PUT',
                    headers: buildHeaders(),
                    body: JSON.stringify(body),
                });
                if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    return { error: data.reason || data.message || 'Failed to create tenant' };
                }
                return { output: { success: true, tenant: inputs.tenant } };
            }
            case 'listNamespaces': {
                const res = await fetch(`${adminBase}/namespaces/${encodeURIComponent(inputs.tenant as string)}`, {
                    headers: buildHeaders(),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.reason || data.message || 'Failed to list namespaces' };
                return { output: { namespaces: data } };
            }
            case 'createNamespace': {
                const namespace = `${inputs.tenant}/${inputs.namespace}`;
                const body: any = inputs.policies || {};
                const res = await fetch(`${adminBase}/namespaces/${encodeURIComponent(namespace)}`, {
                    method: 'PUT',
                    headers: buildHeaders(),
                    body: JSON.stringify(body),
                });
                if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    return { error: data.reason || data.message || 'Failed to create namespace' };
                }
                return { output: { success: true, namespace } };
            }
            case 'listTopics': {
                const namespace = `${inputs.tenant}/${inputs.namespace}`;
                const topicDomain = inputs.persistent === false ? 'non-persistent' : 'persistent';
                const res = await fetch(`${adminBase}/${topicDomain}/${encodeURIComponent(namespace)}`, {
                    headers: buildHeaders(),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.reason || data.message || 'Failed to list topics' };
                return { output: { topics: data } };
            }
            case 'createTopic': {
                const topicDomain = inputs.persistent === false ? 'non-persistent' : 'persistent';
                const topicPath = `${inputs.tenant}/${inputs.namespace}/${inputs.topic}`;
                const res = await fetch(`${adminBase}/${topicDomain}/${encodeURIComponent(topicPath)}`, {
                    method: 'PUT',
                    headers: buildHeaders(),
                    body: JSON.stringify({}),
                });
                if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    return { error: data.reason || data.message || 'Failed to create topic' };
                }
                return { output: { success: true, topic: topicPath } };
            }
            case 'deleteTopic': {
                const topicDomain = inputs.persistent === false ? 'non-persistent' : 'persistent';
                const topicPath = `${inputs.tenant}/${inputs.namespace}/${inputs.topic}`;
                const force = inputs.force === true ? '?force=true' : '';
                const res = await fetch(`${adminBase}/${topicDomain}/${encodeURIComponent(topicPath)}${force}`, {
                    method: 'DELETE',
                    headers: buildHeaders(),
                });
                if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    return { error: data.reason || data.message || 'Failed to delete topic' };
                }
                return { output: { success: true, topic: topicPath } };
            }
            case 'getTopicStats': {
                const topicDomain = inputs.persistent === false ? 'non-persistent' : 'persistent';
                const topicPath = `${inputs.tenant}/${inputs.namespace}/${inputs.topic}`;
                const res = await fetch(`${adminBase}/${topicDomain}/${encodeURIComponent(topicPath)}/stats`, {
                    headers: buildHeaders(),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.reason || data.message || 'Failed to get topic stats' };
                return { output: data };
            }
            case 'produceMessage': {
                const topicPath = `${inputs.tenant}/${inputs.namespace}/${inputs.topic}`;
                const persistent = inputs.persistent === false ? 'non-persistent' : 'persistent';
                const producerUrl = `${serviceUrl}/${persistent}://${topicPath}`;
                const messagePayload = typeof inputs.payload === 'string'
                    ? Buffer.from(inputs.payload).toString('base64')
                    : Buffer.from(JSON.stringify(inputs.payload)).toString('base64');
                const body: any = {
                    payload: messagePayload,
                    properties: inputs.properties || {},
                    key: inputs.key,
                    eventTime: inputs.eventTime,
                };
                const res = await fetch(`${adminBase}/persistent/${encodeURIComponent(topicPath)}/publish`, {
                    method: 'POST',
                    headers: buildHeaders({ 'Content-Type': 'application/json' }),
                    body: JSON.stringify([body]),
                });
                const data = await res.json().catch(() => ({ status: res.status }));
                if (!res.ok) return { error: data.reason || data.message || 'Failed to produce message' };
                return { output: data };
            }
            case 'peekMessages': {
                const topicDomain = inputs.persistent === false ? 'non-persistent' : 'persistent';
                const topicPath = `${inputs.tenant}/${inputs.namespace}/${inputs.topic}`;
                const subscription = inputs.subscription as string;
                const count = inputs.count || 1;
                const res = await fetch(`${adminBase}/${topicDomain}/${encodeURIComponent(topicPath)}/subscription/${encodeURIComponent(subscription)}/position/${count}`, {
                    headers: buildHeaders(),
                });
                const data = await res.json().catch(() => ({}));
                if (!res.ok) return { error: data.reason || data.message || 'Failed to peek messages' };
                return { output: { messages: data } };
            }
            case 'getSubscriptions': {
                const topicDomain = inputs.persistent === false ? 'non-persistent' : 'persistent';
                const topicPath = `${inputs.tenant}/${inputs.namespace}/${inputs.topic}`;
                const res = await fetch(`${adminBase}/${topicDomain}/${encodeURIComponent(topicPath)}/subscriptions`, {
                    headers: buildHeaders(),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.reason || data.message || 'Failed to get subscriptions' };
                return { output: { subscriptions: data } };
            }
            case 'createSubscription': {
                const topicDomain = inputs.persistent === false ? 'non-persistent' : 'persistent';
                const topicPath = `${inputs.tenant}/${inputs.namespace}/${inputs.topic}`;
                const res = await fetch(`${adminBase}/${topicDomain}/${encodeURIComponent(topicPath)}/subscription/${encodeURIComponent(inputs.subscription as string)}`, {
                    method: 'PUT',
                    headers: buildHeaders(),
                    body: JSON.stringify(inputs.messageId || { ledgerId: 0, entryId: -1, partitionIndex: -1 }),
                });
                if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    return { error: data.reason || data.message || 'Failed to create subscription' };
                }
                return { output: { success: true, subscription: inputs.subscription } };
            }
            case 'deleteSubscription': {
                const topicDomain = inputs.persistent === false ? 'non-persistent' : 'persistent';
                const topicPath = `${inputs.tenant}/${inputs.namespace}/${inputs.topic}`;
                const res = await fetch(`${adminBase}/${topicDomain}/${encodeURIComponent(topicPath)}/subscription/${encodeURIComponent(inputs.subscription as string)}`, {
                    method: 'DELETE',
                    headers: buildHeaders(),
                });
                if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    return { error: data.reason || data.message || 'Failed to delete subscription' };
                }
                return { output: { success: true, subscription: inputs.subscription } };
            }
            case 'resetCursor': {
                const topicDomain = inputs.persistent === false ? 'non-persistent' : 'persistent';
                const topicPath = `${inputs.tenant}/${inputs.namespace}/${inputs.topic}`;
                const timestamp = inputs.timestamp || Date.now();
                const res = await fetch(`${adminBase}/${topicDomain}/${encodeURIComponent(topicPath)}/subscription/${encodeURIComponent(inputs.subscription as string)}/resetcursor/${timestamp}`, {
                    method: 'POST',
                    headers: buildHeaders(),
                });
                if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    return { error: data.reason || data.message || 'Failed to reset cursor' };
                }
                return { output: { success: true } };
            }
            case 'listClusters': {
                const res = await fetch(`${adminBase}/clusters`, {
                    headers: buildHeaders(),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.reason || data.message || 'Failed to list clusters' };
                return { output: { clusters: data } };
            }
            default:
                return { error: `Unknown action: ${actionName}` };
        }
    } catch (err: any) {
        logger.error?.(`ApachePulsar action error: ${err.message}`);
        return { error: err.message || 'Unexpected error in ApachePulsar action' };
    }
}
