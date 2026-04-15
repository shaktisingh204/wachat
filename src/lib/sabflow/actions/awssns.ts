
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

async function snsRequest(params: Record<string, string>, region: string, accessKeyId: string, secretAccessKey: string, sessionToken?: string): Promise<any> {
    const url = `https://sns.${region}.amazonaws.com/`;
    const body = encodeForm({ ...params, Version: '2010-03-31' });
    const headers = buildSigV4Headers('POST', url, body, 'sns', region, accessKeyId, secretAccessKey, sessionToken);
    const res = await fetch(url, { method: 'POST', headers, body });
    const text = await res.text();
    if (!res.ok) throw new Error(text);
    return text;
}

function extractXml(text: string, tag: string): string {
    const match = text.match(new RegExp(`<${tag}>(.*?)</${tag}>`, 's'));
    return match ? match[1] : '';
}

export async function executeAwsSnsAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        const region = String(inputs.region ?? 'us-east-1').trim();
        const accessKeyId = String(inputs.accessKeyId ?? '').trim();
        const secretAccessKey = String(inputs.secretAccessKey ?? '').trim();
        const sessionToken = inputs.sessionToken ? String(inputs.sessionToken).trim() : undefined;

        if (!accessKeyId || !secretAccessKey) throw new Error('accessKeyId and secretAccessKey are required.');

        switch (actionName) {
            case 'publish': {
                const message = String(inputs.message ?? '').trim();
                if (!message) throw new Error('message is required.');
                const params: Record<string, string> = { Action: 'Publish', Message: message };
                if (inputs.topicArn) params.TopicArn = String(inputs.topicArn);
                if (inputs.targetArn) params.TargetArn = String(inputs.targetArn);
                if (inputs.phoneNumber) params.PhoneNumber = String(inputs.phoneNumber);
                if (inputs.subject) params.Subject = String(inputs.subject);
                const text = await snsRequest(params, region, accessKeyId, secretAccessKey, sessionToken);
                const messageId = extractXml(text, 'MessageId');
                logger.log(`[SNS] Published message: ${messageId}`);
                return { output: { messageId, status: 'published' } };
            }

            case 'createTopic': {
                const name = String(inputs.name ?? '').trim();
                if (!name) throw new Error('name is required.');
                const text = await snsRequest({ Action: 'CreateTopic', Name: name }, region, accessKeyId, secretAccessKey, sessionToken);
                const topicArn = extractXml(text, 'TopicArn');
                return { output: { topicArn, name, status: 'created' } };
            }

            case 'deleteTopic': {
                const topicArn = String(inputs.topicArn ?? '').trim();
                if (!topicArn) throw new Error('topicArn is required.');
                await snsRequest({ Action: 'DeleteTopic', TopicArn: topicArn }, region, accessKeyId, secretAccessKey, sessionToken);
                return { output: { topicArn, status: 'deleted' } };
            }

            case 'listTopics': {
                const params: Record<string, string> = { Action: 'ListTopics' };
                if (inputs.nextToken) params.NextToken = String(inputs.nextToken);
                const text = await snsRequest(params, region, accessKeyId, secretAccessKey, sessionToken);
                const arns = [...text.matchAll(/<TopicArn>(.*?)<\/TopicArn>/g)].map(m => m[1]);
                const nextToken = extractXml(text, 'NextToken');
                return { output: { topics: arns.map(arn => ({ topicArn: arn })), nextToken: nextToken || null } };
            }

            case 'getTopic': {
                const topicArn = String(inputs.topicArn ?? '').trim();
                if (!topicArn) throw new Error('topicArn is required.');
                const text = await snsRequest({ Action: 'GetTopicAttributes', TopicArn: topicArn }, region, accessKeyId, secretAccessKey, sessionToken);
                const attrs: Record<string, string> = {};
                for (const m of text.matchAll(/<key>(.*?)<\/key>\s*<value>(.*?)<\/value>/gs)) {
                    attrs[m[1]] = m[2];
                }
                return { output: { topicArn, attributes: attrs } };
            }

            case 'subscribe': {
                const topicArn = String(inputs.topicArn ?? '').trim();
                const protocol = String(inputs.protocol ?? '').trim();
                const endpoint = String(inputs.endpoint ?? '').trim();
                if (!topicArn || !protocol) throw new Error('topicArn and protocol are required.');
                const params: Record<string, string> = { Action: 'Subscribe', TopicArn: topicArn, Protocol: protocol };
                if (endpoint) params.Endpoint = endpoint;
                const text = await snsRequest(params, region, accessKeyId, secretAccessKey, sessionToken);
                const subscriptionArn = extractXml(text, 'SubscriptionArn');
                return { output: { subscriptionArn, topicArn, protocol, status: 'subscribed' } };
            }

            case 'unsubscribe': {
                const subscriptionArn = String(inputs.subscriptionArn ?? '').trim();
                if (!subscriptionArn) throw new Error('subscriptionArn is required.');
                await snsRequest({ Action: 'Unsubscribe', SubscriptionArn: subscriptionArn }, region, accessKeyId, secretAccessKey, sessionToken);
                return { output: { subscriptionArn, status: 'unsubscribed' } };
            }

            case 'listSubscriptions': {
                const params: Record<string, string> = { Action: 'ListSubscriptions' };
                if (inputs.nextToken) params.NextToken = String(inputs.nextToken);
                const text = await snsRequest(params, region, accessKeyId, secretAccessKey, sessionToken);
                const arns = [...text.matchAll(/<SubscriptionArn>(.*?)<\/SubscriptionArn>/g)].map(m => m[1]);
                const nextToken = extractXml(text, 'NextToken');
                return { output: { subscriptions: arns.map(arn => ({ subscriptionArn: arn })), nextToken: nextToken || null } };
            }

            case 'listSubscriptionsByTopic': {
                const topicArn = String(inputs.topicArn ?? '').trim();
                if (!topicArn) throw new Error('topicArn is required.');
                const params: Record<string, string> = { Action: 'ListSubscriptionsByTopic', TopicArn: topicArn };
                if (inputs.nextToken) params.NextToken = String(inputs.nextToken);
                const text = await snsRequest(params, region, accessKeyId, secretAccessKey, sessionToken);
                const arns = [...text.matchAll(/<SubscriptionArn>(.*?)<\/SubscriptionArn>/g)].map(m => m[1]);
                return { output: { subscriptions: arns.map(arn => ({ subscriptionArn: arn })), topicArn } };
            }

            case 'confirmSubscription': {
                const topicArn = String(inputs.topicArn ?? '').trim();
                const token = String(inputs.token ?? '').trim();
                if (!topicArn || !token) throw new Error('topicArn and token are required.');
                const text = await snsRequest({ Action: 'ConfirmSubscription', TopicArn: topicArn, Token: token }, region, accessKeyId, secretAccessKey, sessionToken);
                const subscriptionArn = extractXml(text, 'SubscriptionArn');
                return { output: { subscriptionArn, status: 'confirmed' } };
            }

            case 'createPlatformApplication': {
                const name = String(inputs.name ?? '').trim();
                const platform = String(inputs.platform ?? '').trim();
                if (!name || !platform) throw new Error('name and platform are required.');
                const params: Record<string, string> = { Action: 'CreatePlatformApplication', Name: name, Platform: platform };
                if (inputs.platformCredential) params['Attributes.entry.1.key'] = 'PlatformCredential';
                if (inputs.platformCredential) params['Attributes.entry.1.value'] = String(inputs.platformCredential);
                const text = await snsRequest(params, region, accessKeyId, secretAccessKey, sessionToken);
                const platformApplicationArn = extractXml(text, 'PlatformApplicationArn');
                return { output: { platformApplicationArn, name, platform, status: 'created' } };
            }

            case 'createPlatformEndpoint': {
                const platformApplicationArn = String(inputs.platformApplicationArn ?? '').trim();
                const token = String(inputs.token ?? '').trim();
                if (!platformApplicationArn || !token) throw new Error('platformApplicationArn and token are required.');
                const params: Record<string, string> = { Action: 'CreatePlatformEndpoint', PlatformApplicationArn: platformApplicationArn, Token: token };
                if (inputs.customUserData) params.CustomUserData = String(inputs.customUserData);
                const text = await snsRequest(params, region, accessKeyId, secretAccessKey, sessionToken);
                const endpointArn = extractXml(text, 'EndpointArn');
                return { output: { endpointArn, status: 'created' } };
            }

            case 'publishBatch': {
                const topicArn = String(inputs.topicArn ?? '').trim();
                const messages = Array.isArray(inputs.messages) ? inputs.messages : [];
                if (!topicArn || !messages.length) throw new Error('topicArn and messages array are required.');
                const params: Record<string, string> = { Action: 'PublishBatch', TopicArn: topicArn };
                messages.forEach((msg: any, i: number) => {
                    params[`PublishBatchRequestEntries.member.${i + 1}.Id`] = String(msg.id ?? i + 1);
                    params[`PublishBatchRequestEntries.member.${i + 1}.Message`] = String(msg.message ?? '');
                });
                const text = await snsRequest(params, region, accessKeyId, secretAccessKey, sessionToken);
                const successIds = [...text.matchAll(/<MessageId>(.*?)<\/MessageId>/g)].map(m => m[1]);
                return { output: { successCount: String(successIds.length), messageIds: successIds } };
            }

            case 'listPlatformApplications': {
                const params: Record<string, string> = { Action: 'ListPlatformApplications' };
                if (inputs.nextToken) params.NextToken = String(inputs.nextToken);
                const text = await snsRequest(params, region, accessKeyId, secretAccessKey, sessionToken);
                const arns = [...text.matchAll(/<PlatformApplicationArn>(.*?)<\/PlatformApplicationArn>/g)].map(m => m[1]);
                const nextToken = extractXml(text, 'NextToken');
                return { output: { platformApplications: arns.map(arn => ({ platformApplicationArn: arn })), nextToken: nextToken || null } };
            }

            case 'getSmsAttributes': {
                const text = await snsRequest({ Action: 'GetSMSAttributes' }, region, accessKeyId, secretAccessKey, sessionToken);
                const attrs: Record<string, string> = {};
                for (const m of text.matchAll(/<key>(.*?)<\/key>\s*<value>(.*?)<\/value>/gs)) {
                    attrs[m[1]] = m[2];
                }
                return { output: { attributes: attrs } };
            }

            default:
                throw new Error(`Unknown SNS action: ${actionName}`);
        }
    } catch (err: any) {
        return { error: err.message ?? String(err) };
    }
}
