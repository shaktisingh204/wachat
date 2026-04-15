'use server';

export async function executeGooglePubsubAction(actionName: string, inputs: any, user: any, logger: any) {
    const { accessToken, projectId, topicId, subscriptionId, snapshotId, messages, ackIds, maxMessages, ackDeadlineSeconds } = inputs;
    const base = 'https://pubsub.googleapis.com/v1';
    const headers: Record<string, string> = {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
    };
    const topicPath = `projects/${projectId}/topics/${topicId}`;
    const subPath = `projects/${projectId}/subscriptions/${subscriptionId}`;

    try {
        switch (actionName) {
            case 'listTopics': {
                const params = new URLSearchParams();
                if (inputs.pageSize) params.set('pageSize', String(inputs.pageSize));
                if (inputs.pageToken) params.set('pageToken', inputs.pageToken);
                const res = await fetch(`${base}/projects/${projectId}/topics?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'listTopics failed' };
                return { output: data };
            }
            case 'createTopic': {
                const body: any = {};
                if (inputs.labels) body.labels = inputs.labels;
                if (inputs.messageRetentionDuration) body.messageRetentionDuration = inputs.messageRetentionDuration;
                const res = await fetch(`${base}/${topicPath}`, {
                    method: 'PUT', headers, body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'createTopic failed' };
                return { output: data };
            }
            case 'deleteTopic': {
                const res = await fetch(`${base}/${topicPath}`, { method: 'DELETE', headers });
                if (res.status === 200 || res.status === 204) return { output: { success: true } };
                const data = await res.json();
                return { error: data.error?.message || 'deleteTopic failed' };
            }
            case 'publishMessage': {
                const message = Array.isArray(messages) ? messages[0] : messages;
                const data64 = Buffer.from(typeof message === 'string' ? message : JSON.stringify(message)).toString('base64');
                const body = {
                    messages: [{ data: data64, attributes: inputs.attributes || {} }],
                };
                const res = await fetch(`${base}/${topicPath}:publish`, {
                    method: 'POST', headers, body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'publishMessage failed' };
                return { output: data };
            }
            case 'publishMessages': {
                const msgArray = Array.isArray(messages) ? messages : [messages];
                const body = {
                    messages: msgArray.map((m: any) => ({
                        data: Buffer.from(typeof m === 'string' ? m : JSON.stringify(m)).toString('base64'),
                        attributes: inputs.attributes || {},
                    })),
                };
                const res = await fetch(`${base}/${topicPath}:publish`, {
                    method: 'POST', headers, body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'publishMessages failed' };
                return { output: data };
            }
            case 'listSubscriptions': {
                const params = new URLSearchParams();
                if (inputs.pageSize) params.set('pageSize', String(inputs.pageSize));
                if (inputs.pageToken) params.set('pageToken', inputs.pageToken);
                const res = await fetch(`${base}/projects/${projectId}/subscriptions?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'listSubscriptions failed' };
                return { output: data };
            }
            case 'createSubscription': {
                const body: any = {
                    topic: `projects/${projectId}/topics/${topicId}`,
                };
                if (inputs.ackDeadlineSeconds) body.ackDeadlineSeconds = Number(inputs.ackDeadlineSeconds);
                if (inputs.pushEndpoint) {
                    body.pushConfig = { pushEndpoint: inputs.pushEndpoint };
                }
                if (inputs.messageRetentionDuration) body.messageRetentionDuration = inputs.messageRetentionDuration;
                const res = await fetch(`${base}/${subPath}`, {
                    method: 'PUT', headers, body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'createSubscription failed' };
                return { output: data };
            }
            case 'deleteSubscription': {
                const res = await fetch(`${base}/${subPath}`, { method: 'DELETE', headers });
                if (res.status === 200 || res.status === 204) return { output: { success: true } };
                const data = await res.json();
                return { error: data.error?.message || 'deleteSubscription failed' };
            }
            case 'pullMessages': {
                const body = { maxMessages: Number(maxMessages) || 10 };
                const res = await fetch(`${base}/${subPath}:pull`, {
                    method: 'POST', headers, body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'pullMessages failed' };
                return { output: data };
            }
            case 'acknowledgeMessages': {
                const ackIdsArray = Array.isArray(ackIds) ? ackIds : [ackIds];
                const body = { ackIds: ackIdsArray };
                const res = await fetch(`${base}/${subPath}:acknowledge`, {
                    method: 'POST', headers, body: JSON.stringify(body),
                });
                if (res.status === 200 || res.status === 204) return { output: { success: true } };
                const data = await res.json();
                return { error: data.error?.message || 'acknowledgeMessages failed' };
            }
            case 'modifyAckDeadline': {
                const ackIdsArray = Array.isArray(ackIds) ? ackIds : [ackIds];
                const body = {
                    ackIds: ackIdsArray,
                    ackDeadlineSeconds: Number(ackDeadlineSeconds) || 60,
                };
                const res = await fetch(`${base}/${subPath}:modifyAckDeadline`, {
                    method: 'POST', headers, body: JSON.stringify(body),
                });
                if (res.status === 200 || res.status === 204) return { output: { success: true } };
                const data = await res.json();
                return { error: data.error?.message || 'modifyAckDeadline failed' };
            }
            case 'getTopicIamPolicy': {
                const res = await fetch(`${base}/${topicPath}:getIamPolicy`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'getTopicIamPolicy failed' };
                return { output: data };
            }
            case 'getSubscriptionIamPolicy': {
                const res = await fetch(`${base}/${subPath}:getIamPolicy`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'getSubscriptionIamPolicy failed' };
                return { output: data };
            }
            case 'listSnapshots': {
                const params = new URLSearchParams();
                if (inputs.pageSize) params.set('pageSize', String(inputs.pageSize));
                if (inputs.pageToken) params.set('pageToken', inputs.pageToken);
                const res = await fetch(`${base}/projects/${projectId}/snapshots?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'listSnapshots failed' };
                return { output: data };
            }
            case 'createSnapshot': {
                const snapshotPath = `projects/${projectId}/snapshots/${snapshotId}`;
                const body = { subscription: subPath };
                const res = await fetch(`${base}/${snapshotPath}`, {
                    method: 'PUT', headers, body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'createSnapshot failed' };
                return { output: data };
            }
            default:
                return { error: `Unknown Pub/Sub action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Pub/Sub action error: ${err.message}`);
        return { error: err.message || 'Pub/Sub action failed' };
    }
}
