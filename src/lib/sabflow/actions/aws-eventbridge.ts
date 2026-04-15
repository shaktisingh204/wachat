'use server';

import { createHmac, createHash } from 'crypto';

function sha256(d: string): string { return createHash('sha256').update(d).digest('hex'); }
function hmac(k: Buffer | string, d: string): Buffer { return createHmac('sha256', k).update(d).digest(); }
function signingKey(secret: string, date: string, region: string, svc: string): Buffer {
    return hmac(hmac(hmac(hmac('AWS4' + secret, date), region), svc), 'aws4_request');
}
function awsFetch(method: string, url: string, region: string, svc: string, keyId: string, secret: string, body: string, extraHeaders: Record<string, string> = {}) {
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '').slice(0, 15) + 'Z';
    const ds = amzDate.slice(0, 8);
    const u = new URL(url);
    const allHeaders: Record<string, string> = { 'Content-Type': 'application/x-amz-json-1.1', 'X-Amz-Date': amzDate, 'Host': u.host, ...extraHeaders };
    const sh = Object.keys(allHeaders).map(k => k.toLowerCase()).sort().join(';');
    const ch = Object.entries(allHeaders).map(([k, v]) => `${k.toLowerCase()}:${v}\n`).sort().join('');
    const cr = [method, u.pathname, u.search.slice(1), ch, sh, sha256(body)].join('\n');
    const scope = `${ds}/${region}/${svc}/aws4_request`;
    const sts = `AWS4-HMAC-SHA256\n${amzDate}\n${scope}\n${sha256(cr)}`;
    const sig = hmac(signingKey(secret, ds, region, svc), sts).toString('hex');
    allHeaders['Authorization'] = `AWS4-HMAC-SHA256 Credential=${keyId}/${scope},SignedHeaders=${sh},Signature=${sig}`;
    return fetch(url, { method, headers: allHeaders, body: body || undefined });
}

async function ebPost(target: string, payload: any, region: string, keyId: string, secret: string) {
    const url = `https://events.${region}.amazonaws.com`;
    return awsFetch('POST', url, region, 'events', keyId, secret, JSON.stringify(payload), { 'X-Amz-Target': `AmazonEventBridge.${target}` });
}

export async function executeAwsEventbridgeAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const keyId: string = inputs.aws_access_key_id || inputs.accessKeyId || '';
        const secret: string = inputs.aws_secret_access_key || inputs.secretAccessKey || '';
        const region: string = inputs.region || 'us-east-1';

        switch (actionName) {
            case 'listEventBuses': {
                const res = await ebPost('ListEventBuses', {
                    Limit: inputs.limit || inputs.max_results || 100,
                    NextToken: inputs.nextToken || inputs.next_token,
                    NamePrefix: inputs.namePrefix || inputs.name_prefix,
                }, region, keyId, secret);
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: data };
            }
            case 'createEventBus': {
                const res = await ebPost('CreateEventBus', {
                    Name: inputs.name || inputs.event_bus_name,
                    EventSourceName: inputs.eventSourceName || inputs.event_source_name,
                    Tags: inputs.tags,
                }, region, keyId, secret);
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: data };
            }
            case 'deleteEventBus': {
                const res = await ebPost('DeleteEventBus', {
                    Name: inputs.name || inputs.event_bus_name,
                }, region, keyId, secret);
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: { success: true } };
            }
            case 'putEvents': {
                const entries = inputs.entries || inputs.events || [];
                const res = await ebPost('PutEvents', {
                    Entries: entries.map((e: any) => ({
                        Source: e.source || e.Source,
                        DetailType: e.detailType || e.DetailType,
                        Detail: typeof (e.detail || e.Detail) === 'string' ? (e.detail || e.Detail) : JSON.stringify(e.detail || e.Detail || {}),
                        EventBusName: e.eventBusName || e.EventBusName || inputs.eventBusName || inputs.event_bus_name,
                        Resources: e.resources || e.Resources,
                        Time: e.time || e.Time,
                    })),
                }, region, keyId, secret);
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: data };
            }
            case 'listRules': {
                const res = await ebPost('ListRules', {
                    EventBusName: inputs.eventBusName || inputs.event_bus_name,
                    Limit: inputs.limit || inputs.max_results || 100,
                    NextToken: inputs.nextToken || inputs.next_token,
                    NamePrefix: inputs.namePrefix || inputs.name_prefix,
                }, region, keyId, secret);
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: data };
            }
            case 'putRule': {
                const res = await ebPost('PutRule', {
                    Name: inputs.name || inputs.rule_name,
                    EventBusName: inputs.eventBusName || inputs.event_bus_name,
                    ScheduleExpression: inputs.scheduleExpression || inputs.schedule_expression,
                    EventPattern: typeof inputs.eventPattern === 'string' ? inputs.eventPattern : JSON.stringify(inputs.eventPattern || inputs.event_pattern || {}),
                    State: inputs.state || 'ENABLED',
                    Description: inputs.description,
                    RoleArn: inputs.roleArn || inputs.role_arn,
                }, region, keyId, secret);
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: data };
            }
            case 'deleteRule': {
                const res = await ebPost('DeleteRule', {
                    Name: inputs.name || inputs.rule_name,
                    EventBusName: inputs.eventBusName || inputs.event_bus_name,
                    Force: inputs.force || false,
                }, region, keyId, secret);
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: { success: true } };
            }
            case 'listTargetsByRule': {
                const res = await ebPost('ListTargetsByRule', {
                    Rule: inputs.rule || inputs.rule_name,
                    EventBusName: inputs.eventBusName || inputs.event_bus_name,
                    Limit: inputs.limit || inputs.max_results || 100,
                    NextToken: inputs.nextToken || inputs.next_token,
                }, region, keyId, secret);
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: data };
            }
            case 'putTargets': {
                const res = await ebPost('PutTargets', {
                    Rule: inputs.rule || inputs.rule_name,
                    EventBusName: inputs.eventBusName || inputs.event_bus_name,
                    Targets: inputs.targets || [],
                }, region, keyId, secret);
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: data };
            }
            case 'removeTargets': {
                const res = await ebPost('RemoveTargets', {
                    Rule: inputs.rule || inputs.rule_name,
                    EventBusName: inputs.eventBusName || inputs.event_bus_name,
                    Ids: inputs.ids || inputs.target_ids || [],
                    Force: inputs.force || false,
                }, region, keyId, secret);
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: data };
            }
            case 'listConnections': {
                const res = await ebPost('ListConnections', {
                    Limit: inputs.limit || inputs.max_results || 100,
                    NextToken: inputs.nextToken || inputs.next_token,
                    NamePrefix: inputs.namePrefix || inputs.name_prefix,
                    ConnectionState: inputs.connectionState || inputs.connection_state,
                }, region, keyId, secret);
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: data };
            }
            case 'createConnection': {
                const res = await ebPost('CreateConnection', {
                    Name: inputs.name || inputs.connection_name,
                    Description: inputs.description,
                    AuthorizationType: inputs.authorizationType || inputs.authorization_type || 'API_KEY',
                    AuthParameters: inputs.authParameters || inputs.auth_parameters || {},
                }, region, keyId, secret);
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: data };
            }
            case 'updateConnection': {
                const res = await ebPost('UpdateConnection', {
                    Name: inputs.name || inputs.connection_name,
                    Description: inputs.description,
                    AuthorizationType: inputs.authorizationType || inputs.authorization_type,
                    AuthParameters: inputs.authParameters || inputs.auth_parameters,
                }, region, keyId, secret);
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: data };
            }
            case 'deleteConnection': {
                const res = await ebPost('DeleteConnection', {
                    Name: inputs.name || inputs.connection_name,
                }, region, keyId, secret);
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: data };
            }
            case 'describeConnection': {
                const res = await ebPost('DescribeConnection', {
                    Name: inputs.name || inputs.connection_name,
                }, region, keyId, secret);
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: data };
            }
            default:
                return { error: `Unknown AWS EventBridge action: ${actionName}` };
        }
    } catch (e: any) {
        logger.log(`AWS EventBridge action error: ${e.message}`);
        return { error: e.message || 'Unknown error in AWS EventBridge action' };
    }
}
