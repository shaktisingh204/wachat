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

async function snsCall(action: string, params: Record<string, string>, region: string, keyId: string, secret: string) {
    const base = `https://sns.${region}.amazonaws.com/`;
    const body = new URLSearchParams({ Action: action, Version: '2010-03-31', ...params }).toString();
    const res = await awsFetch('POST', base, region, 'sns', keyId, secret, body);
    const text = await res.text();
    if (!res.ok) throw new Error(text);
    return { xml: text };
}

export async function executeAWSSNSEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const accessKeyId = String(inputs.accessKeyId ?? '').trim();
        const secretAccessKey = String(inputs.secretAccessKey ?? '').trim();
        const region = String(inputs.region ?? 'us-east-1').trim();
        if (!accessKeyId || !secretAccessKey) throw new Error('accessKeyId and secretAccessKey are required.');

        switch (actionName) {
            case 'listTopics': {
                const params: Record<string, string> = {};
                if (inputs.nextToken) params.NextToken = String(inputs.nextToken);
                const result = await snsCall('ListTopics', params, region, accessKeyId, secretAccessKey);
                return { output: result };
            }

            case 'createTopic': {
                const name = String(inputs.name ?? '').trim();
                if (!name) throw new Error('name is required.');
                const params: Record<string, string> = { Name: name };
                const result = await snsCall('CreateTopic', params, region, accessKeyId, secretAccessKey);
                return { output: result };
            }

            case 'deleteTopic': {
                const topicArn = String(inputs.topicArn ?? '').trim();
                if (!topicArn) throw new Error('topicArn is required.');
                const result = await snsCall('DeleteTopic', { TopicArn: topicArn }, region, accessKeyId, secretAccessKey);
                return { output: result };
            }

            case 'getTopicAttributes': {
                const topicArn = String(inputs.topicArn ?? '').trim();
                if (!topicArn) throw new Error('topicArn is required.');
                const result = await snsCall('GetTopicAttributes', { TopicArn: topicArn }, region, accessKeyId, secretAccessKey);
                return { output: result };
            }

            case 'setTopicAttributes': {
                const topicArn = String(inputs.topicArn ?? '').trim();
                const attributeName = String(inputs.attributeName ?? '').trim();
                const attributeValue = String(inputs.attributeValue ?? '');
                if (!topicArn || !attributeName) throw new Error('topicArn and attributeName are required.');
                const result = await snsCall('SetTopicAttributes', { TopicArn: topicArn, AttributeName: attributeName, AttributeValue: attributeValue }, region, accessKeyId, secretAccessKey);
                return { output: result };
            }

            case 'publish': {
                const topicArn = String(inputs.topicArn ?? '').trim();
                const targetArn = String(inputs.targetArn ?? '').trim();
                const message = String(inputs.message ?? '').trim();
                const subject = String(inputs.subject ?? '');
                if (!message) throw new Error('message is required.');
                if (!topicArn && !targetArn) throw new Error('topicArn or targetArn is required.');
                const params: Record<string, string> = { Message: message };
                if (topicArn) params.TopicArn = topicArn;
                if (targetArn) params.TargetArn = targetArn;
                if (subject) params.Subject = subject;
                const result = await snsCall('Publish', params, region, accessKeyId, secretAccessKey);
                return { output: result };
            }

            case 'publishBatch': {
                const topicArn = String(inputs.topicArn ?? '').trim();
                const messages = Array.isArray(inputs.messages) ? inputs.messages : [];
                if (!topicArn) throw new Error('topicArn is required.');
                if (!messages.length) throw new Error('messages array is required.');
                const params: Record<string, string> = { TopicArn: topicArn };
                messages.forEach((m: any, i: number) => {
                    params[`PublishBatchRequestEntries.member.${i + 1}.Id`] = String(m.id ?? `msg-${i}`);
                    params[`PublishBatchRequestEntries.member.${i + 1}.Message`] = String(m.message ?? '');
                    if (m.subject) params[`PublishBatchRequestEntries.member.${i + 1}.Subject`] = String(m.subject);
                });
                const result = await snsCall('PublishBatch', params, region, accessKeyId, secretAccessKey);
                return { output: result };
            }

            case 'listSubscriptions': {
                const params: Record<string, string> = {};
                if (inputs.nextToken) params.NextToken = String(inputs.nextToken);
                const result = await snsCall('ListSubscriptions', params, region, accessKeyId, secretAccessKey);
                return { output: result };
            }

            case 'subscribe': {
                const topicArn = String(inputs.topicArn ?? '').trim();
                const protocol = String(inputs.protocol ?? '').trim();
                const endpoint = String(inputs.endpoint ?? '').trim();
                if (!topicArn || !protocol || !endpoint) throw new Error('topicArn, protocol, and endpoint are required.');
                const result = await snsCall('Subscribe', { TopicArn: topicArn, Protocol: protocol, Endpoint: endpoint }, region, accessKeyId, secretAccessKey);
                return { output: result };
            }

            case 'unsubscribe': {
                const subscriptionArn = String(inputs.subscriptionArn ?? '').trim();
                if (!subscriptionArn) throw new Error('subscriptionArn is required.');
                const result = await snsCall('Unsubscribe', { SubscriptionArn: subscriptionArn }, region, accessKeyId, secretAccessKey);
                return { output: result };
            }

            case 'confirmSubscription': {
                const topicArn = String(inputs.topicArn ?? '').trim();
                const token = String(inputs.token ?? '').trim();
                if (!topicArn || !token) throw new Error('topicArn and token are required.');
                const result = await snsCall('ConfirmSubscription', { TopicArn: topicArn, Token: token }, region, accessKeyId, secretAccessKey);
                return { output: result };
            }

            case 'listPhoneNumbers': {
                const params: Record<string, string> = {};
                if (inputs.nextToken) params.NextToken = String(inputs.nextToken);
                const result = await snsCall('ListPhoneNumbersOptedOut', params, region, accessKeyId, secretAccessKey);
                return { output: result };
            }

            case 'publishSMS': {
                const phoneNumber = String(inputs.phoneNumber ?? '').trim();
                const message = String(inputs.message ?? '').trim();
                if (!phoneNumber || !message) throw new Error('phoneNumber and message are required.');
                const result = await snsCall('Publish', { PhoneNumber: phoneNumber, Message: message }, region, accessKeyId, secretAccessKey);
                return { output: result };
            }

            case 'createPlatformApplication': {
                const name = String(inputs.name ?? '').trim();
                const platform = String(inputs.platform ?? '').trim();
                const platformCredential = String(inputs.platformCredential ?? '').trim();
                if (!name || !platform || !platformCredential) throw new Error('name, platform, and platformCredential are required.');
                const result = await snsCall('CreatePlatformApplication', {
                    Name: name,
                    Platform: platform,
                    'Attributes.entry.1.key': 'PlatformCredential',
                    'Attributes.entry.1.value': platformCredential,
                }, region, accessKeyId, secretAccessKey);
                return { output: result };
            }

            case 'createEndpoint': {
                const platformApplicationArn = String(inputs.platformApplicationArn ?? '').trim();
                const token = String(inputs.token ?? '').trim();
                if (!platformApplicationArn || !token) throw new Error('platformApplicationArn and token are required.');
                const result = await snsCall('CreatePlatformEndpoint', { PlatformApplicationArn: platformApplicationArn, Token: token }, region, accessKeyId, secretAccessKey);
                return { output: result };
            }

            default:
                return { error: `Action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Action failed.' };
    }
}
