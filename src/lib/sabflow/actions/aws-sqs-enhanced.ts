'use server';

import { createHmac, createHash } from 'crypto';

function sha256(d: string): string { return createHash('sha256').update(d).digest('hex'); }
function hmac(k: Buffer | string, d: string): Buffer { return createHmac('sha256', k).update(d).digest(); }
function signingKey(secret: string, date: string, region: string, svc: string): Buffer {
    return hmac(hmac(hmac(hmac('AWS4' + secret, date), region), svc), 'aws4_request');
}
function awsFetch(method: string, url: string, region: string, svc: string, keyId: string, secret: string, body: string, contentType = 'application/x-www-form-urlencoded') {
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '').slice(0, 15) + 'Z';
    const ds = amzDate.slice(0, 8);
    const u = new URL(url);
    const allHeaders: Record<string, string> = {
        'Content-Type': contentType,
        'X-Amz-Date': amzDate,
        'Host': u.host,
    };
    const sh = Object.keys(allHeaders).map(k => k.toLowerCase()).sort().join(';');
    const ch = Object.entries(allHeaders).map(([k, v]) => `${k.toLowerCase()}:${v}\n`).sort().join('');
    const cr = [method, u.pathname, u.search.slice(1), ch, sh, sha256(body)].join('\n');
    const scope = `${ds}/${region}/${svc}/aws4_request`;
    const sts = `AWS4-HMAC-SHA256\n${amzDate}\n${scope}\n${sha256(cr)}`;
    const sig = hmac(signingKey(secret, ds, region, svc), sts).toString('hex');
    allHeaders['Authorization'] = `AWS4-HMAC-SHA256 Credential=${keyId}/${scope},SignedHeaders=${sh},Signature=${sig}`;
    return fetch(url, { method, headers: allHeaders, body: body || undefined });
}

async function sqsCall(action: string, params: Record<string, string>, region: string, keyId: string, secret: string, queueUrl?: string) {
    const endpoint = queueUrl ?? `https://sqs.${region}.amazonaws.com/`;
    const body = new URLSearchParams({ Action: action, Version: '2012-11-05', ...params }).toString();
    const res = await awsFetch('POST', endpoint, region, 'sqs', keyId, secret, body);
    const text = await res.text();
    if (!res.ok) throw new Error(text);
    return { xml: text };
}

export async function executeAWSSQSEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const accessKeyId = String(inputs.accessKeyId ?? '').trim();
        const secretAccessKey = String(inputs.secretAccessKey ?? '').trim();
        const region = String(inputs.region ?? 'us-east-1').trim();
        if (!accessKeyId || !secretAccessKey) throw new Error('accessKeyId and secretAccessKey are required.');

        switch (actionName) {
            case 'createQueue': {
                const queueName = String(inputs.queueName ?? '').trim();
                if (!queueName) throw new Error('queueName is required.');
                const params: Record<string, string> = { QueueName: queueName };
                if (inputs.isFifo === true || inputs.isFifo === 'true') {
                    params['Attribute.1.Name'] = 'FifoQueue';
                    params['Attribute.1.Value'] = 'true';
                }
                if (inputs.visibilityTimeout !== undefined) {
                    params['Attribute.2.Name'] = 'VisibilityTimeout';
                    params['Attribute.2.Value'] = String(inputs.visibilityTimeout);
                }
                const result = await sqsCall('CreateQueue', params, region, accessKeyId, secretAccessKey);
                return { output: result };
            }

            case 'listQueues': {
                const params: Record<string, string> = {};
                if (inputs.queueNamePrefix) params.QueueNamePrefix = String(inputs.queueNamePrefix);
                if (inputs.nextToken) params.NextToken = String(inputs.nextToken);
                const result = await sqsCall('ListQueues', params, region, accessKeyId, secretAccessKey);
                return { output: result };
            }

            case 'getQueueUrl': {
                const queueName = String(inputs.queueName ?? '').trim();
                if (!queueName) throw new Error('queueName is required.');
                const result = await sqsCall('GetQueueUrl', { QueueName: queueName }, region, accessKeyId, secretAccessKey);
                return { output: result };
            }

            case 'deleteQueue': {
                const queueUrl = String(inputs.queueUrl ?? '').trim();
                if (!queueUrl) throw new Error('queueUrl is required.');
                const result = await sqsCall('DeleteQueue', { QueueUrl: queueUrl }, region, accessKeyId, secretAccessKey, queueUrl);
                return { output: result };
            }

            case 'getQueueAttributes': {
                const queueUrl = String(inputs.queueUrl ?? '').trim();
                if (!queueUrl) throw new Error('queueUrl is required.');
                const result = await sqsCall('GetQueueAttributes', { QueueUrl: queueUrl, 'AttributeName.1': 'All' }, region, accessKeyId, secretAccessKey, queueUrl);
                return { output: result };
            }

            case 'setQueueAttributes': {
                const queueUrl = String(inputs.queueUrl ?? '').trim();
                if (!queueUrl) throw new Error('queueUrl is required.');
                const attributes = inputs.attributes ?? {};
                const params: Record<string, string> = { QueueUrl: queueUrl };
                Object.entries(attributes).forEach(([k, v], i) => {
                    params[`Attribute.${i + 1}.Name`] = k;
                    params[`Attribute.${i + 1}.Value`] = String(v);
                });
                const result = await sqsCall('SetQueueAttributes', params, region, accessKeyId, secretAccessKey, queueUrl);
                return { output: result };
            }

            case 'sendMessage': {
                const queueUrl = String(inputs.queueUrl ?? '').trim();
                const messageBody = String(inputs.messageBody ?? '').trim();
                if (!queueUrl || !messageBody) throw new Error('queueUrl and messageBody are required.');
                const params: Record<string, string> = { QueueUrl: queueUrl, MessageBody: messageBody };
                if (inputs.delaySeconds !== undefined) params.DelaySeconds = String(inputs.delaySeconds);
                if (inputs.messageGroupId) params.MessageGroupId = String(inputs.messageGroupId);
                if (inputs.messageDeduplicationId) params.MessageDeduplicationId = String(inputs.messageDeduplicationId);
                const result = await sqsCall('SendMessage', params, region, accessKeyId, secretAccessKey, queueUrl);
                return { output: result };
            }

            case 'receiveMessage': {
                const queueUrl = String(inputs.queueUrl ?? '').trim();
                if (!queueUrl) throw new Error('queueUrl is required.');
                const maxMessages = String(inputs.maxMessages ?? '1');
                const waitTimeSeconds = String(inputs.waitTimeSeconds ?? '0');
                const visibilityTimeout = String(inputs.visibilityTimeout ?? '30');
                const result = await sqsCall('ReceiveMessage', {
                    QueueUrl: queueUrl,
                    MaxNumberOfMessages: maxMessages,
                    WaitTimeSeconds: waitTimeSeconds,
                    VisibilityTimeout: visibilityTimeout,
                    'AttributeName.1': 'All',
                }, region, accessKeyId, secretAccessKey, queueUrl);
                return { output: result };
            }

            case 'deleteMessage': {
                const queueUrl = String(inputs.queueUrl ?? '').trim();
                const receiptHandle = String(inputs.receiptHandle ?? '').trim();
                if (!queueUrl || !receiptHandle) throw new Error('queueUrl and receiptHandle are required.');
                const result = await sqsCall('DeleteMessage', { QueueUrl: queueUrl, ReceiptHandle: receiptHandle }, region, accessKeyId, secretAccessKey, queueUrl);
                return { output: result };
            }

            case 'deleteMessageBatch': {
                const queueUrl = String(inputs.queueUrl ?? '').trim();
                const entries = Array.isArray(inputs.entries) ? inputs.entries : [];
                if (!queueUrl) throw new Error('queueUrl is required.');
                if (!entries.length) throw new Error('entries array is required.');
                const params: Record<string, string> = { QueueUrl: queueUrl };
                entries.forEach((e: any, i: number) => {
                    params[`DeleteMessageBatchRequestEntry.${i + 1}.Id`] = String(e.id ?? `entry-${i}`);
                    params[`DeleteMessageBatchRequestEntry.${i + 1}.ReceiptHandle`] = String(e.receiptHandle ?? '');
                });
                const result = await sqsCall('DeleteMessageBatch', params, region, accessKeyId, secretAccessKey, queueUrl);
                return { output: result };
            }

            case 'sendMessageBatch': {
                const queueUrl = String(inputs.queueUrl ?? '').trim();
                const entries = Array.isArray(inputs.entries) ? inputs.entries : [];
                if (!queueUrl) throw new Error('queueUrl is required.');
                if (!entries.length) throw new Error('entries array is required.');
                const params: Record<string, string> = { QueueUrl: queueUrl };
                entries.forEach((e: any, i: number) => {
                    params[`SendMessageBatchRequestEntry.${i + 1}.Id`] = String(e.id ?? `entry-${i}`);
                    params[`SendMessageBatchRequestEntry.${i + 1}.MessageBody`] = String(e.messageBody ?? '');
                    if (e.delaySeconds !== undefined) params[`SendMessageBatchRequestEntry.${i + 1}.DelaySeconds`] = String(e.delaySeconds);
                });
                const result = await sqsCall('SendMessageBatch', params, region, accessKeyId, secretAccessKey, queueUrl);
                return { output: result };
            }

            case 'purgeQueue': {
                const queueUrl = String(inputs.queueUrl ?? '').trim();
                if (!queueUrl) throw new Error('queueUrl is required.');
                const result = await sqsCall('PurgeQueue', { QueueUrl: queueUrl }, region, accessKeyId, secretAccessKey, queueUrl);
                return { output: result };
            }

            case 'changeMessageVisibility': {
                const queueUrl = String(inputs.queueUrl ?? '').trim();
                const receiptHandle = String(inputs.receiptHandle ?? '').trim();
                const visibilityTimeout = String(inputs.visibilityTimeout ?? '30');
                if (!queueUrl || !receiptHandle) throw new Error('queueUrl and receiptHandle are required.');
                const result = await sqsCall('ChangeMessageVisibility', { QueueUrl: queueUrl, ReceiptHandle: receiptHandle, VisibilityTimeout: visibilityTimeout }, region, accessKeyId, secretAccessKey, queueUrl);
                return { output: result };
            }

            case 'addPermission': {
                const queueUrl = String(inputs.queueUrl ?? '').trim();
                const label = String(inputs.label ?? '').trim();
                const awsAccountId = String(inputs.awsAccountId ?? '').trim();
                const actions = Array.isArray(inputs.actions) ? inputs.actions : ['SendMessage'];
                if (!queueUrl || !label || !awsAccountId) throw new Error('queueUrl, label, and awsAccountId are required.');
                const params: Record<string, string> = { QueueUrl: queueUrl, Label: label };
                params['AWSAccountId.1'] = awsAccountId;
                actions.forEach((a: string, i: number) => { params[`ActionName.${i + 1}`] = a; });
                const result = await sqsCall('AddPermission', params, region, accessKeyId, secretAccessKey, queueUrl);
                return { output: result };
            }

            case 'listDeadLetterSourceQueues': {
                const queueUrl = String(inputs.queueUrl ?? '').trim();
                if (!queueUrl) throw new Error('queueUrl is required.');
                const result = await sqsCall('ListDeadLetterSourceQueues', { QueueUrl: queueUrl }, region, accessKeyId, secretAccessKey, queueUrl);
                return { output: result };
            }

            default:
                return { error: `Action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Action failed.' };
    }
}
