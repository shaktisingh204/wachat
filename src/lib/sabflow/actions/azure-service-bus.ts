'use server';

import { createHmac } from 'crypto';

function generateSasToken(resourceUri: string, keyName: string, key: string, expiresInSeconds = 3600): string {
    const encoded = encodeURIComponent(resourceUri);
    const expiry = Math.floor(Date.now() / 1000) + expiresInSeconds;
    const stringToSign = `${encoded}\n${expiry}`;
    const sig = createHmac('sha256', key).update(stringToSign, 'utf8').digest('base64');
    return `SharedAccessSignature sr=${encoded}&sig=${encodeURIComponent(sig)}&se=${expiry}&skn=${keyName}`;
}

export async function executeAzureServiceBusAction(actionName: string, inputs: any, user: any, logger: any) {
    const namespace = inputs.namespace;
    const keyName = inputs.keyName || 'RootManageSharedAccessKey';
    const key = inputs.key;
    const baseUrl = `https://${namespace}.servicebus.windows.net`;

    function authHeader(resourceUri: string): Record<string, string> {
        const sas = generateSasToken(resourceUri, keyName, key);
        return {
            'Authorization': sas,
            'Content-Type': 'application/json',
        };
    }

    try {
        switch (actionName) {
            case 'sendMessage': {
                const queueOrTopic = inputs.queueOrTopic;
                const message = inputs.message;
                const resourceUri = `${baseUrl}/${queueOrTopic}/messages`;
                const body = typeof message === 'string' ? message : JSON.stringify(message);
                const headers: Record<string, string> = {
                    ...authHeader(resourceUri),
                    'Content-Type': inputs.contentType || 'application/json',
                };
                const res = await fetch(resourceUri, { method: 'POST', headers, body });
                return { output: { status: res.status, sent: res.ok } };
            }

            case 'receiveMessage': {
                const queueOrTopic = inputs.queueOrTopic;
                const lockDuration = inputs.lockDuration || 60;
                const resourceUri = `${baseUrl}/${queueOrTopic}/messages/head?timeout=${lockDuration}`;
                const res = await fetch(resourceUri, {
                    method: 'POST',
                    headers: authHeader(`${baseUrl}/${queueOrTopic}`),
                });
                const text = await res.text();
                const lockToken = res.headers.get('brokerproperties');
                return { output: { status: res.status, message: text, brokerProperties: lockToken } };
            }

            case 'peekMessage': {
                const queueOrTopic = inputs.queueOrTopic;
                const resourceUri = `${baseUrl}/${queueOrTopic}/messages/head`;
                const res = await fetch(resourceUri, {
                    headers: authHeader(`${baseUrl}/${queueOrTopic}`),
                });
                const text = await res.text();
                return { output: { status: res.status, message: text } };
            }

            case 'completeMessage': {
                const queueOrTopic = inputs.queueOrTopic;
                const lockToken = inputs.lockToken;
                const resourceUri = `${baseUrl}/${queueOrTopic}/messages/${lockToken}`;
                const res = await fetch(resourceUri, {
                    method: 'DELETE',
                    headers: authHeader(`${baseUrl}/${queueOrTopic}`),
                });
                return { output: { status: res.status, completed: res.ok } };
            }

            case 'abandonMessage': {
                const queueOrTopic = inputs.queueOrTopic;
                const lockToken = inputs.lockToken;
                const resourceUri = `${baseUrl}/${queueOrTopic}/messages/${lockToken}`;
                const res = await fetch(resourceUri, {
                    method: 'PUT',
                    headers: authHeader(`${baseUrl}/${queueOrTopic}`),
                });
                return { output: { status: res.status, abandoned: res.ok } };
            }

            case 'deadLetterMessage': {
                const queueOrTopic = inputs.queueOrTopic;
                const lockToken = inputs.lockToken;
                const reason = inputs.reason || 'ManualDeadLetter';
                const resourceUri = `${baseUrl}/${queueOrTopic}/messages/${lockToken}?deadletter=true`;
                const res = await fetch(resourceUri, {
                    method: 'DELETE',
                    headers: {
                        ...authHeader(`${baseUrl}/${queueOrTopic}`),
                        'DeadLetterReason': reason,
                    },
                });
                return { output: { status: res.status, deadLettered: res.ok } };
            }

            case 'sendBatch': {
                const queueOrTopic = inputs.queueOrTopic;
                const messages: any[] = inputs.messages || [];
                const resourceUri = `${baseUrl}/${queueOrTopic}/messages`;
                const results = [];
                for (const msg of messages) {
                    const body = typeof msg === 'string' ? msg : JSON.stringify(msg);
                    const res = await fetch(resourceUri, {
                        method: 'POST',
                        headers: authHeader(resourceUri),
                        body,
                    });
                    results.push({ status: res.status, sent: res.ok });
                }
                return { output: { results } };
            }

            case 'listQueues': {
                const resourceUri = `${baseUrl}/$Resources/queues`;
                const res = await fetch(resourceUri, { headers: authHeader(resourceUri) });
                const text = await res.text();
                return { output: { status: res.status, body: text } };
            }

            case 'createQueue': {
                const queueName = inputs.queueName;
                const resourceUri = `${baseUrl}/${queueName}`;
                const body = inputs.queueDescription || `<?xml version="1.0" encoding="utf-8"?><entry xmlns="http://www.w3.org/2005/Atom"><content type="application/xml"><QueueDescription xmlns="http://schemas.microsoft.com/netservices/2010/10/servicebus/connect" /></content></entry>`;
                const res = await fetch(resourceUri, {
                    method: 'PUT',
                    headers: {
                        ...authHeader(resourceUri),
                        'Content-Type': 'application/atom+xml;type=entry;charset=utf-8',
                    },
                    body,
                });
                const text = await res.text();
                return { output: { status: res.status, body: text } };
            }

            case 'deleteQueue': {
                const queueName = inputs.queueName;
                const resourceUri = `${baseUrl}/${queueName}`;
                const res = await fetch(resourceUri, {
                    method: 'DELETE',
                    headers: authHeader(resourceUri),
                });
                return { output: { status: res.status, deleted: res.ok } };
            }

            case 'getQueueRuntimeProperties': {
                const queueName = inputs.queueName;
                const resourceUri = `${baseUrl}/${queueName}?enrich=true`;
                const res = await fetch(resourceUri, { headers: authHeader(`${baseUrl}/${queueName}`) });
                const text = await res.text();
                return { output: { status: res.status, body: text } };
            }

            case 'listTopics': {
                const resourceUri = `${baseUrl}/$Resources/topics`;
                const res = await fetch(resourceUri, { headers: authHeader(resourceUri) });
                const text = await res.text();
                return { output: { status: res.status, body: text } };
            }

            case 'createTopic': {
                const topicName = inputs.topicName;
                const resourceUri = `${baseUrl}/${topicName}`;
                const body = inputs.topicDescription || `<?xml version="1.0" encoding="utf-8"?><entry xmlns="http://www.w3.org/2005/Atom"><content type="application/xml"><TopicDescription xmlns="http://schemas.microsoft.com/netservices/2010/10/servicebus/connect" /></content></entry>`;
                const res = await fetch(resourceUri, {
                    method: 'PUT',
                    headers: {
                        ...authHeader(resourceUri),
                        'Content-Type': 'application/atom+xml;type=entry;charset=utf-8',
                    },
                    body,
                });
                const text = await res.text();
                return { output: { status: res.status, body: text } };
            }

            case 'createSubscription': {
                const topicName = inputs.topicName;
                const subscriptionName = inputs.subscriptionName;
                const resourceUri = `${baseUrl}/${topicName}/subscriptions/${subscriptionName}`;
                const body = inputs.subscriptionDescription || `<?xml version="1.0" encoding="utf-8"?><entry xmlns="http://www.w3.org/2005/Atom"><content type="application/xml"><SubscriptionDescription xmlns="http://schemas.microsoft.com/netservices/2010/10/servicebus/connect" /></content></entry>`;
                const res = await fetch(resourceUri, {
                    method: 'PUT',
                    headers: {
                        ...authHeader(resourceUri),
                        'Content-Type': 'application/atom+xml;type=entry;charset=utf-8',
                    },
                    body,
                });
                const text = await res.text();
                return { output: { status: res.status, body: text } };
            }

            case 'listSubscriptions': {
                const topicName = inputs.topicName;
                const resourceUri = `${baseUrl}/${topicName}/subscriptions`;
                const res = await fetch(resourceUri, { headers: authHeader(resourceUri) });
                const text = await res.text();
                return { output: { status: res.status, body: text } };
            }

            default:
                return { error: `Unknown Azure Service Bus action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Azure Service Bus action error: ${err.message}`);
        return { error: err.message || 'Azure Service Bus action failed' };
    }
}
