
'use server';

import { createHmac, createHash } from 'crypto';

function sign(key: Buffer, msg: string): Buffer {
    return createHmac('sha256', key).update(msg).digest();
}

function getSignatureKey(secret: string, date: string, region: string, service: string): Buffer {
    return sign(sign(sign(sign(Buffer.from('AWS4' + secret), date), region), service), 'aws4_request');
}

function buildSigV4Headers(method: string, url: string, body: string, service: string, region: string, accessKeyId: string, secretAccessKey: string, sessionToken?: string, extraHeaders?: Record<string, string>): Record<string, string> {
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:\-]|\.\d{3}/g, '').slice(0, 15) + 'Z';
    const dateStamp = amzDate.slice(0, 8);
    const parsedUrl = new URL(url);
    const host = parsedUrl.host;
    const canonicalUri = parsedUrl.pathname;
    const canonicalQuerystring = parsedUrl.searchParams.toString();
    const payloadHash = createHash('sha256').update(body).digest('hex');
    const headersObj: Record<string, string> = { host, 'x-amz-date': amzDate, 'x-amz-content-sha256': payloadHash, ...(sessionToken ? { 'x-amz-security-token': sessionToken } : {}), ...extraHeaders };
    const signedHeaders = Object.keys(headersObj).sort().join(';');
    const canonicalHeaders = Object.keys(headersObj).sort().map(k => `${k}:${headersObj[k]}\n`).join('');
    const canonicalRequest = [method, canonicalUri, canonicalQuerystring, canonicalHeaders, signedHeaders, payloadHash].join('\n');
    const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
    const stringToSign = ['AWS4-HMAC-SHA256', amzDate, credentialScope, createHash('sha256').update(canonicalRequest).digest('hex')].join('\n');
    const signingKey = getSignatureKey(secretAccessKey, dateStamp, region, service);
    const signature = createHmac('sha256', signingKey).update(stringToSign).digest('hex');
    return { ...headersObj, 'Authorization': `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`, 'Content-Type': 'application/x-www-form-urlencoded' };
}

function encodeForm(params: Record<string, string>): string {
    return Object.entries(params).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
}

function extractXml(text: string, tag: string): string {
    const match = text.match(new RegExp(`<${tag}>(.*?)</${tag}>`, 's'));
    return match ? match[1] : '';
}

async function sqsRequest(params: Record<string, string>, queueUrl: string, region: string, accessKeyId: string, secretAccessKey: string, sessionToken?: string): Promise<string> {
    const baseUrl = `https://sqs.${region}.amazonaws.com/`;
    const url = queueUrl || baseUrl;
    const body = encodeForm({ ...params, Version: '2012-11-05' });
    const headers = buildSigV4Headers('POST', url, body, 'sqs', region, accessKeyId, secretAccessKey, sessionToken);
    const res = await fetch(url, { method: 'POST', headers, body });
    const text = await res.text();
    if (!res.ok) throw new Error(text);
    return text;
}

function resolveQueueUrl(inputs: any, region: string): string {
    if (inputs.queueUrl) return String(inputs.queueUrl).trim();
    if (inputs.accountId && inputs.queueName) return `https://sqs.${region}.amazonaws.com/${inputs.accountId}/${inputs.queueName}`;
    return `https://sqs.${region}.amazonaws.com/`;
}

export async function executeAwsSqsAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        const region = String(inputs.region ?? 'us-east-1').trim();
        const accessKeyId = String(inputs.accessKeyId ?? '').trim();
        const secretAccessKey = String(inputs.secretAccessKey ?? '').trim();
        const sessionToken = inputs.sessionToken ? String(inputs.sessionToken).trim() : undefined;

        if (!accessKeyId || !secretAccessKey) throw new Error('accessKeyId and secretAccessKey are required.');

        const queueUrl = resolveQueueUrl(inputs, region);

        switch (actionName) {
            case 'sendMessage': {
                const messageBody = String(inputs.messageBody ?? inputs.message ?? '').trim();
                if (!messageBody) throw new Error('messageBody is required.');
                if (!inputs.queueUrl && !inputs.accountId) throw new Error('queueUrl or accountId+queueName is required.');
                const params: Record<string, string> = { Action: 'SendMessage', MessageBody: messageBody };
                if (inputs.delaySeconds !== undefined) params.DelaySeconds = String(inputs.delaySeconds);
                if (inputs.messageGroupId) params.MessageGroupId = String(inputs.messageGroupId);
                if (inputs.messageDeduplicationId) params.MessageDeduplicationId = String(inputs.messageDeduplicationId);
                const text = await sqsRequest(params, queueUrl, region, accessKeyId, secretAccessKey, sessionToken);
                const messageId = extractXml(text, 'MessageId');
                const md5 = extractXml(text, 'MD5OfMessageBody');
                logger.log(`[SQS] Message sent: ${messageId}`);
                return { output: { messageId, md5OfMessageBody: md5, status: 'sent' } };
            }

            case 'sendMessageBatch': {
                const messages = Array.isArray(inputs.messages) ? inputs.messages : [];
                if (!messages.length) throw new Error('messages array is required.');
                const params: Record<string, string> = { Action: 'SendMessageBatch' };
                messages.forEach((msg: any, i: number) => {
                    const idx = i + 1;
                    params[`SendMessageBatchRequestEntry.${idx}.Id`] = String(msg.id ?? i);
                    params[`SendMessageBatchRequestEntry.${idx}.MessageBody`] = String(msg.messageBody ?? msg.message ?? '');
                    if (msg.delaySeconds !== undefined) params[`SendMessageBatchRequestEntry.${idx}.DelaySeconds`] = String(msg.delaySeconds);
                });
                const text = await sqsRequest(params, queueUrl, region, accessKeyId, secretAccessKey, sessionToken);
                const ids = [...text.matchAll(/<MessageId>(.*?)<\/MessageId>/g)].map(m => m[1]);
                return { output: { successCount: String(ids.length), messageIds: ids } };
            }

            case 'receiveMessage': {
                const maxMessages = Number(inputs.maxNumberOfMessages ?? inputs.maxMessages ?? 1);
                const waitSeconds = Number(inputs.waitTimeSeconds ?? 0);
                const params: Record<string, string> = {
                    Action: 'ReceiveMessage',
                    MaxNumberOfMessages: String(Math.min(maxMessages, 10)),
                    WaitTimeSeconds: String(waitSeconds)
                };
                if (inputs.visibilityTimeout !== undefined) params.VisibilityTimeout = String(inputs.visibilityTimeout);
                if (inputs.attributeNames) params['AttributeName.1'] = 'All';
                const text = await sqsRequest(params, queueUrl, region, accessKeyId, secretAccessKey, sessionToken);
                const messages: any[] = [];
                const msgMatches = [...text.matchAll(/<Message>(.*?)<\/Message>/gs)];
                for (const match of msgMatches) {
                    const msgXml = match[1];
                    messages.push({
                        messageId: extractXml(msgXml, 'MessageId'),
                        receiptHandle: extractXml(msgXml, 'ReceiptHandle'),
                        body: extractXml(msgXml, 'Body'),
                        md5OfBody: extractXml(msgXml, 'MD5OfBody')
                    });
                }
                logger.log(`[SQS] Received ${messages.length} messages`);
                return { output: { messages, count: String(messages.length) } };
            }

            case 'deleteMessage': {
                const receiptHandle = String(inputs.receiptHandle ?? '').trim();
                if (!receiptHandle) throw new Error('receiptHandle is required.');
                await sqsRequest({ Action: 'DeleteMessage', ReceiptHandle: receiptHandle }, queueUrl, region, accessKeyId, secretAccessKey, sessionToken);
                return { output: { receiptHandle, status: 'deleted' } };
            }

            case 'deleteMessageBatch': {
                const receipts = Array.isArray(inputs.receiptHandles) ? inputs.receiptHandles : [];
                if (!receipts.length) throw new Error('receiptHandles array is required.');
                const params: Record<string, string> = { Action: 'DeleteMessageBatch' };
                receipts.forEach((rh: string, i: number) => {
                    params[`DeleteMessageBatchRequestEntry.${i + 1}.Id`] = String(i);
                    params[`DeleteMessageBatchRequestEntry.${i + 1}.ReceiptHandle`] = rh;
                });
                const text = await sqsRequest(params, queueUrl, region, accessKeyId, secretAccessKey, sessionToken);
                const ids = [...text.matchAll(/<Id>(.*?)<\/Id>/g)].map(m => m[1]);
                return { output: { deletedCount: String(ids.length), ids } };
            }

            case 'changeMessageVisibility': {
                const receiptHandle = String(inputs.receiptHandle ?? '').trim();
                const visibilityTimeout = Number(inputs.visibilityTimeout ?? 0);
                if (!receiptHandle) throw new Error('receiptHandle is required.');
                await sqsRequest({ Action: 'ChangeMessageVisibility', ReceiptHandle: receiptHandle, VisibilityTimeout: String(visibilityTimeout) }, queueUrl, region, accessKeyId, secretAccessKey, sessionToken);
                return { output: { receiptHandle, visibilityTimeout: String(visibilityTimeout), status: 'updated' } };
            }

            case 'getQueueAttributes': {
                const attrNames = Array.isArray(inputs.attributeNames) ? inputs.attributeNames : ['All'];
                const params: Record<string, string> = { Action: 'GetQueueAttributes' };
                attrNames.forEach((name: string, i: number) => { params[`AttributeName.${i + 1}`] = name; });
                const text = await sqsRequest(params, queueUrl, region, accessKeyId, secretAccessKey, sessionToken);
                const attrs: Record<string, string> = {};
                for (const m of text.matchAll(/<Name>(.*?)<\/Name>\s*<Value>(.*?)<\/Value>/gs)) {
                    attrs[m[1]] = m[2];
                }
                return { output: { attributes: attrs } };
            }

            case 'setQueueAttributes': {
                const attributes = inputs.attributes ?? {};
                const params: Record<string, string> = { Action: 'SetQueueAttributes' };
                Object.entries(attributes).forEach(([k, v], i) => {
                    params[`Attribute.${i + 1}.Name`] = k;
                    params[`Attribute.${i + 1}.Value`] = String(v);
                });
                await sqsRequest(params, queueUrl, region, accessKeyId, secretAccessKey, sessionToken);
                return { output: { status: 'updated' } };
            }

            case 'createQueue': {
                const queueName = String(inputs.queueName ?? '').trim();
                if (!queueName) throw new Error('queueName is required.');
                const baseUrl = `https://sqs.${region}.amazonaws.com/`;
                const params: Record<string, string> = { Action: 'CreateQueue', QueueName: queueName };
                if (inputs.delaySeconds !== undefined) { params['Attribute.1.Name'] = 'DelaySeconds'; params['Attribute.1.Value'] = String(inputs.delaySeconds); }
                const text = await sqsRequest(params, baseUrl, region, accessKeyId, secretAccessKey, sessionToken);
                const createdQueueUrl = extractXml(text, 'QueueUrl');
                return { output: { queueUrl: createdQueueUrl, queueName, status: 'created' } };
            }

            case 'deleteQueue': {
                await sqsRequest({ Action: 'DeleteQueue' }, queueUrl, region, accessKeyId, secretAccessKey, sessionToken);
                return { output: { queueUrl, status: 'deleted' } };
            }

            case 'listQueues': {
                const baseUrl = `https://sqs.${region}.amazonaws.com/`;
                const params: Record<string, string> = { Action: 'ListQueues' };
                if (inputs.queueNamePrefix) params.QueueNamePrefix = String(inputs.queueNamePrefix);
                const text = await sqsRequest(params, baseUrl, region, accessKeyId, secretAccessKey, sessionToken);
                const urls = [...text.matchAll(/<QueueUrl>(.*?)<\/QueueUrl>/g)].map(m => m[1]);
                return { output: { queues: urls.map(url => ({ queueUrl: url })), count: String(urls.length) } };
            }

            case 'purgeQueue': {
                await sqsRequest({ Action: 'PurgeQueue' }, queueUrl, region, accessKeyId, secretAccessKey, sessionToken);
                return { output: { queueUrl, status: 'purged' } };
            }

            case 'getQueueUrl': {
                const queueName = String(inputs.queueName ?? '').trim();
                if (!queueName) throw new Error('queueName is required.');
                const baseUrl = `https://sqs.${region}.amazonaws.com/`;
                const params: Record<string, string> = { Action: 'GetQueueUrl', QueueName: queueName };
                if (inputs.queueOwnerAWSAccountId) params.QueueOwnerAWSAccountId = String(inputs.queueOwnerAWSAccountId);
                const text = await sqsRequest(params, baseUrl, region, accessKeyId, secretAccessKey, sessionToken);
                const resolvedUrl = extractXml(text, 'QueueUrl');
                return { output: { queueUrl: resolvedUrl } };
            }

            default:
                throw new Error(`Unknown SQS action: ${actionName}`);
        }
    } catch (err: any) {
        return { error: err.message ?? String(err) };
    }
}
