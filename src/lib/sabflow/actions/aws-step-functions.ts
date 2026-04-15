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

async function sfnPost(target: string, payload: any, region: string, keyId: string, secret: string) {
    const url = `https://states.${region}.amazonaws.com`;
    return awsFetch('POST', url, region, 'states', keyId, secret, JSON.stringify(payload), { 'X-Amz-Target': `AmazonStates.${target}` });
}

export async function executeAwsStepFunctionsAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const keyId: string = inputs.aws_access_key_id || inputs.accessKeyId || '';
        const secret: string = inputs.aws_secret_access_key || inputs.secretAccessKey || '';
        const region: string = inputs.region || 'us-east-1';

        switch (actionName) {
            case 'listStateMachines': {
                const res = await sfnPost('ListStateMachines', {
                    maxResults: inputs.maxResults || inputs.max_results || 100,
                    nextToken: inputs.nextToken || inputs.next_token,
                }, region, keyId, secret);
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: data };
            }
            case 'describeStateMachine': {
                const res = await sfnPost('DescribeStateMachine', {
                    stateMachineArn: inputs.stateMachineArn || inputs.state_machine_arn,
                }, region, keyId, secret);
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: data };
            }
            case 'createStateMachine': {
                const res = await sfnPost('CreateStateMachine', {
                    name: inputs.name,
                    definition: typeof inputs.definition === 'string' ? inputs.definition : JSON.stringify(inputs.definition),
                    roleArn: inputs.roleArn || inputs.role_arn,
                    type: inputs.type || 'STANDARD',
                    loggingConfiguration: inputs.loggingConfiguration || inputs.logging_configuration,
                    tracingConfiguration: inputs.tracingConfiguration || inputs.tracing_configuration,
                }, region, keyId, secret);
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: data };
            }
            case 'updateStateMachine': {
                const res = await sfnPost('UpdateStateMachine', {
                    stateMachineArn: inputs.stateMachineArn || inputs.state_machine_arn,
                    definition: typeof inputs.definition === 'string' ? inputs.definition : JSON.stringify(inputs.definition),
                    roleArn: inputs.roleArn || inputs.role_arn,
                    loggingConfiguration: inputs.loggingConfiguration || inputs.logging_configuration,
                }, region, keyId, secret);
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: data };
            }
            case 'deleteStateMachine': {
                const res = await sfnPost('DeleteStateMachine', {
                    stateMachineArn: inputs.stateMachineArn || inputs.state_machine_arn,
                }, region, keyId, secret);
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: { success: true } };
            }
            case 'startExecution': {
                const inputPayload = inputs.input || inputs.payload;
                const res = await sfnPost('StartExecution', {
                    stateMachineArn: inputs.stateMachineArn || inputs.state_machine_arn,
                    name: inputs.name || inputs.execution_name,
                    input: typeof inputPayload === 'string' ? inputPayload : JSON.stringify(inputPayload || {}),
                }, region, keyId, secret);
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: data };
            }
            case 'describeExecution': {
                const res = await sfnPost('DescribeExecution', {
                    executionArn: inputs.executionArn || inputs.execution_arn,
                }, region, keyId, secret);
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: data };
            }
            case 'listExecutions': {
                const res = await sfnPost('ListExecutions', {
                    stateMachineArn: inputs.stateMachineArn || inputs.state_machine_arn,
                    statusFilter: inputs.statusFilter || inputs.status_filter,
                    maxResults: inputs.maxResults || inputs.max_results || 100,
                    nextToken: inputs.nextToken || inputs.next_token,
                }, region, keyId, secret);
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: data };
            }
            case 'stopExecution': {
                const res = await sfnPost('StopExecution', {
                    executionArn: inputs.executionArn || inputs.execution_arn,
                    error: inputs.error,
                    cause: inputs.cause,
                }, region, keyId, secret);
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: data };
            }
            case 'getExecutionHistory': {
                const res = await sfnPost('GetExecutionHistory', {
                    executionArn: inputs.executionArn || inputs.execution_arn,
                    maxResults: inputs.maxResults || inputs.max_results || 100,
                    nextToken: inputs.nextToken || inputs.next_token,
                    reverseOrder: inputs.reverseOrder || inputs.reverse_order || false,
                }, region, keyId, secret);
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: data };
            }
            case 'listActivities': {
                const res = await sfnPost('ListActivities', {
                    maxResults: inputs.maxResults || inputs.max_results || 100,
                    nextToken: inputs.nextToken || inputs.next_token,
                }, region, keyId, secret);
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: data };
            }
            case 'createActivity': {
                const res = await sfnPost('CreateActivity', {
                    name: inputs.name || inputs.activity_name,
                    tags: inputs.tags,
                }, region, keyId, secret);
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: data };
            }
            case 'deleteActivity': {
                const res = await sfnPost('DeleteActivity', {
                    activityArn: inputs.activityArn || inputs.activity_arn,
                }, region, keyId, secret);
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: { success: true } };
            }
            case 'sendTaskSuccess': {
                const taskOutput = inputs.output || inputs.task_output;
                const res = await sfnPost('SendTaskSuccess', {
                    taskToken: inputs.taskToken || inputs.task_token,
                    output: typeof taskOutput === 'string' ? taskOutput : JSON.stringify(taskOutput || {}),
                }, region, keyId, secret);
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: { success: true } };
            }
            case 'sendTaskFailure': {
                const res = await sfnPost('SendTaskFailure', {
                    taskToken: inputs.taskToken || inputs.task_token,
                    error: inputs.error,
                    cause: inputs.cause,
                }, region, keyId, secret);
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: { success: true } };
            }
            default:
                return { error: `Unknown AWS Step Functions action: ${actionName}` };
        }
    } catch (e: any) {
        logger.log(`AWS Step Functions action error: ${e.message}`);
        return { error: e.message || 'Unknown error in AWS Step Functions action' };
    }
}
