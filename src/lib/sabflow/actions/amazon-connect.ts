'use server';

import { createHmac, createHash } from 'crypto';

function sha256(d: string): string {
    return createHash('sha256').update(d).digest('hex');
}

function hmac(k: Buffer | string, d: string): Buffer {
    return createHmac('sha256', k).update(d).digest();
}

function awsFetch(
    method: string,
    url: string,
    region: string,
    svc: string,
    keyId: string,
    secret: string,
    body: string
) {
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '').slice(0, 15) + 'Z';
    const ds = amzDate.slice(0, 8);
    const u = new URL(url);
    const allHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Amz-Date': amzDate,
        'Host': u.host,
    };
    const sh = Object.keys(allHeaders).map(k => k.toLowerCase()).sort().join(';');
    const ch = Object.entries(allHeaders).map(([k, v]) => `${k.toLowerCase()}:${v}\n`).sort().join('');
    const cr = [method, u.pathname, u.search.slice(1), ch, sh, sha256(body)].join('\n');
    const scope = `${ds}/${region}/${svc}/aws4_request`;
    const sts = `AWS4-HMAC-SHA256\n${amzDate}\n${scope}\n${sha256(cr)}`;
    const sig = hmac(
        hmac(hmac(hmac(hmac('AWS4' + secret, ds), region), svc), 'aws4_request'),
        sts
    ).toString('hex');
    allHeaders['Authorization'] =
        `AWS4-HMAC-SHA256 Credential=${keyId}/${scope},SignedHeaders=${sh},Signature=${sig}`;
    return fetch(url, { method, headers: allHeaders, body: body || undefined });
}

export async function executeAmazonConnectAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
) {
    try {
        const region = inputs.region || 'us-east-1';
        const keyId = inputs.accessKeyId;
        const secret = inputs.secretAccessKey;
        const instanceId = inputs.instanceId || '';
        const base = `https://connect.${region}.amazonaws.com`;

        switch (actionName) {
            case 'listInstances': {
                const url = `${base}/instance`;
                const res = await awsFetch('GET', url, region, 'connect', keyId, secret, '');
                const data = await res.json();
                return { output: data };
            }

            case 'getInstance': {
                const url = `${base}/instance/${instanceId}`;
                const res = await awsFetch('GET', url, region, 'connect', keyId, secret, '');
                const data = await res.json();
                return { output: data };
            }

            case 'listQueues': {
                const queueType = inputs.queueType || 'STANDARD';
                const url = `${base}/queues-summary/${instanceId}?queueTypes=${queueType}`;
                const res = await awsFetch('GET', url, region, 'connect', keyId, secret, '');
                const data = await res.json();
                return { output: data };
            }

            case 'getQueue': {
                const queueId = inputs.queueId;
                const url = `${base}/queues/${instanceId}/${queueId}`;
                const res = await awsFetch('GET', url, region, 'connect', keyId, secret, '');
                const data = await res.json();
                return { output: data };
            }

            case 'listContactFlows': {
                const url = `${base}/contact-flows-summary/${instanceId}`;
                const res = await awsFetch('GET', url, region, 'connect', keyId, secret, '');
                const data = await res.json();
                return { output: data };
            }

            case 'getContactFlow': {
                const contactFlowId = inputs.contactFlowId;
                const url = `${base}/contact-flows/${instanceId}/${contactFlowId}`;
                const res = await awsFetch('GET', url, region, 'connect', keyId, secret, '');
                const data = await res.json();
                return { output: data };
            }

            case 'listUsers': {
                const url = `${base}/users-summary/${instanceId}`;
                const res = await awsFetch('GET', url, region, 'connect', keyId, secret, '');
                const data = await res.json();
                return { output: data };
            }

            case 'getUser': {
                const userId = inputs.userId;
                const url = `${base}/users/${instanceId}/${userId}`;
                const res = await awsFetch('GET', url, region, 'connect', keyId, secret, '');
                const data = await res.json();
                return { output: data };
            }

            case 'createUser': {
                const url = `${base}/users/${instanceId}`;
                const body = JSON.stringify({
                    Username: inputs.username,
                    Password: inputs.password,
                    IdentityInfo: inputs.identityInfo || {},
                    PhoneConfig: inputs.phoneConfig || {},
                    SecurityProfileIds: inputs.securityProfileIds || [],
                    RoutingProfileId: inputs.routingProfileId,
                });
                const res = await awsFetch('PUT', url, region, 'connect', keyId, secret, body);
                const data = await res.json();
                return { output: data };
            }

            case 'updateUser': {
                const userId = inputs.userId;
                const url = `${base}/users/${instanceId}/${userId}/identity-info`;
                const body = JSON.stringify({ IdentityInfo: inputs.identityInfo || {} });
                const res = await awsFetch('POST', url, region, 'connect', keyId, secret, body);
                const data = await res.json();
                return { output: data };
            }

            case 'deleteUser': {
                const userId = inputs.userId;
                const url = `${base}/users/${instanceId}/${userId}`;
                const res = await awsFetch('DELETE', url, region, 'connect', keyId, secret, '');
                const data = await res.json();
                return { output: data };
            }

            case 'startOutboundContact': {
                const url = `${base}/contact/outbound-voice`;
                const body = JSON.stringify({
                    DestinationPhoneNumber: inputs.destinationPhoneNumber,
                    ContactFlowId: inputs.contactFlowId,
                    InstanceId: instanceId,
                    SourcePhoneNumber: inputs.sourcePhoneNumber,
                    Attributes: inputs.attributes || {},
                });
                const res = await awsFetch('PUT', url, region, 'connect', keyId, secret, body);
                const data = await res.json();
                return { output: data };
            }

            case 'stopContact': {
                const url = `${base}/contact/stop`;
                const body = JSON.stringify({
                    ContactId: inputs.contactId,
                    InstanceId: instanceId,
                });
                const res = await awsFetch('POST', url, region, 'connect', keyId, secret, body);
                const data = await res.json();
                return { output: data };
            }

            case 'getContactAttributes': {
                const contactId = inputs.contactId;
                const url = `${base}/contact/attributes/${instanceId}/${contactId}`;
                const res = await awsFetch('GET', url, region, 'connect', keyId, secret, '');
                const data = await res.json();
                return { output: data };
            }

            case 'listRoutingProfiles': {
                const url = `${base}/routing-profiles-summary/${instanceId}`;
                const res = await awsFetch('GET', url, region, 'connect', keyId, secret, '');
                const data = await res.json();
                return { output: data };
            }

            default:
                return { error: `Unknown Amazon Connect action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Amazon Connect action error: ${err.message}`);
        return { error: err.message || 'Amazon Connect action failed' };
    }
}
