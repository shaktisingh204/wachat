'use server';

import { createHmac, createHash } from 'crypto';

function sha256(d: string): string { return createHash('sha256').update(d).digest('hex'); }
function hmac(k: Buffer | string, d: string): Buffer { return createHmac('sha256', k).update(d).digest(); }
function signingKey(secret: string, date: string, region: string, svc: string): Buffer {
    return hmac(hmac(hmac(hmac('AWS4' + secret, date), region), svc), 'aws4_request');
}
function awsFetch(method: string, url: string, region: string, svc: string, keyId: string, secret: string, body: string, contentType = 'application/json', extraHeaders: Record<string, string> = {}) {
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '').slice(0, 15) + 'Z';
    const ds = amzDate.slice(0, 8);
    const u = new URL(url);
    const allHeaders: Record<string, string> = {
        'Content-Type': contentType,
        'X-Amz-Date': amzDate,
        'Host': u.host,
        ...extraHeaders,
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

export async function executeAWSLambdaEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const accessKeyId = String(inputs.accessKeyId ?? '').trim();
        const secretAccessKey = String(inputs.secretAccessKey ?? '').trim();
        const region = String(inputs.region ?? 'us-east-1').trim();
        if (!accessKeyId || !secretAccessKey) throw new Error('accessKeyId and secretAccessKey are required.');

        const base = `https://lambda.${region}.amazonaws.com/2015-03-31`;

        const callGet = async (path: string) => {
            const res = await awsFetch('GET', `${base}${path}`, region, 'lambda', accessKeyId, secretAccessKey, '');
            const json = await res.json() as any;
            if (!res.ok) throw new Error(json.message || json.Message || JSON.stringify(json));
            return json;
        };

        const callPost = async (path: string, payload: object) => {
            const body = JSON.stringify(payload);
            const res = await awsFetch('POST', `${base}${path}`, region, 'lambda', accessKeyId, secretAccessKey, body);
            const json = await res.json() as any;
            if (!res.ok) throw new Error(json.message || json.Message || JSON.stringify(json));
            return json;
        };

        const callPut = async (path: string, payload: object) => {
            const body = JSON.stringify(payload);
            const res = await awsFetch('PUT', `${base}${path}`, region, 'lambda', accessKeyId, secretAccessKey, body);
            const json = await res.json() as any;
            if (!res.ok) throw new Error(json.message || json.Message || JSON.stringify(json));
            return json;
        };

        const callDelete = async (path: string) => {
            const res = await awsFetch('DELETE', `${base}${path}`, region, 'lambda', accessKeyId, secretAccessKey, '');
            if (!res.ok) {
                const json = await res.json() as any;
                throw new Error(json.message || json.Message || JSON.stringify(json));
            }
            return { success: true };
        };

        switch (actionName) {
            case 'listFunctions': {
                const marker = String(inputs.marker ?? '');
                const maxItems = String(inputs.maxItems ?? '50');
                const path = `/functions?MaxItems=${maxItems}${marker ? `&Marker=${encodeURIComponent(marker)}` : ''}`;
                const result = await callGet(path);
                return { output: result };
            }

            case 'getFunction': {
                const functionName = String(inputs.functionName ?? '').trim();
                if (!functionName) throw new Error('functionName is required.');
                const result = await callGet(`/functions/${encodeURIComponent(functionName)}`);
                return { output: result };
            }

            case 'createFunction': {
                const functionName = String(inputs.functionName ?? '').trim();
                const runtime = String(inputs.runtime ?? 'nodejs18.x').trim();
                const role = String(inputs.role ?? '').trim();
                const handler = String(inputs.handler ?? 'index.handler').trim();
                const s3Bucket = String(inputs.s3Bucket ?? '').trim();
                const s3Key = String(inputs.s3Key ?? '').trim();
                const description = String(inputs.description ?? '');
                const timeout = Number(inputs.timeout ?? 30);
                const memorySize = Number(inputs.memorySize ?? 128);
                if (!functionName || !role) throw new Error('functionName and role are required.');
                const payload: any = { FunctionName: functionName, Runtime: runtime, Role: role, Handler: handler, Description: description, Timeout: timeout, MemorySize: memorySize };
                if (s3Bucket && s3Key) {
                    payload.Code = { S3Bucket: s3Bucket, S3Key: s3Key };
                }
                const result = await callPost('/functions', payload);
                return { output: result };
            }

            case 'updateFunctionCode': {
                const functionName = String(inputs.functionName ?? '').trim();
                const s3Bucket = String(inputs.s3Bucket ?? '').trim();
                const s3Key = String(inputs.s3Key ?? '').trim();
                if (!functionName) throw new Error('functionName is required.');
                const payload: any = {};
                if (s3Bucket && s3Key) {
                    payload.S3Bucket = s3Bucket;
                    payload.S3Key = s3Key;
                }
                const result = await callPut(`/functions/${encodeURIComponent(functionName)}/code`, payload);
                return { output: result };
            }

            case 'updateFunctionConfiguration': {
                const functionName = String(inputs.functionName ?? '').trim();
                if (!functionName) throw new Error('functionName is required.');
                const payload: any = {};
                if (inputs.description !== undefined) payload.Description = String(inputs.description);
                if (inputs.handler !== undefined) payload.Handler = String(inputs.handler);
                if (inputs.timeout !== undefined) payload.Timeout = Number(inputs.timeout);
                if (inputs.memorySize !== undefined) payload.MemorySize = Number(inputs.memorySize);
                if (inputs.runtime !== undefined) payload.Runtime = String(inputs.runtime);
                const result = await callPut(`/functions/${encodeURIComponent(functionName)}/configuration`, payload);
                return { output: result };
            }

            case 'deleteFunction': {
                const functionName = String(inputs.functionName ?? '').trim();
                if (!functionName) throw new Error('functionName is required.');
                const result = await callDelete(`/functions/${encodeURIComponent(functionName)}`);
                return { output: result };
            }

            case 'invokeFunction': {
                const functionName = String(inputs.functionName ?? '').trim();
                if (!functionName) throw new Error('functionName is required.');
                const payload = inputs.payload ? JSON.stringify(inputs.payload) : '';
                const invocationType = String(inputs.invocationType ?? 'RequestResponse');
                const res = await awsFetch('POST', `${base}/functions/${encodeURIComponent(functionName)}/invocations`, region, 'lambda', accessKeyId, secretAccessKey, payload, 'application/json', { 'X-Amz-Invocation-Type': invocationType });
                const text = await res.text();
                let responsePayload: any = text;
                try { responsePayload = JSON.parse(text); } catch {}
                return { output: { statusCode: res.status, payload: responsePayload } };
            }

            case 'invokeFunctionAsync': {
                const functionName = String(inputs.functionName ?? '').trim();
                if (!functionName) throw new Error('functionName is required.');
                const payload = inputs.payload ? JSON.stringify(inputs.payload) : '';
                const res = await awsFetch('POST', `${base}/functions/${encodeURIComponent(functionName)}/invocations`, region, 'lambda', accessKeyId, secretAccessKey, payload, 'application/json', { 'X-Amz-Invocation-Type': 'Event' });
                return { output: { statusCode: res.status, queued: true } };
            }

            case 'listFunctionVersions': {
                const functionName = String(inputs.functionName ?? '').trim();
                if (!functionName) throw new Error('functionName is required.');
                const result = await callGet(`/functions/${encodeURIComponent(functionName)}/versions`);
                return { output: result };
            }

            case 'publishVersion': {
                const functionName = String(inputs.functionName ?? '').trim();
                const description = String(inputs.description ?? '');
                if (!functionName) throw new Error('functionName is required.');
                const result = await callPost(`/functions/${encodeURIComponent(functionName)}/versions`, { Description: description });
                return { output: result };
            }

            case 'createAlias': {
                const functionName = String(inputs.functionName ?? '').trim();
                const aliasName = String(inputs.aliasName ?? '').trim();
                const functionVersion = String(inputs.functionVersion ?? '$LATEST').trim();
                const description = String(inputs.description ?? '');
                if (!functionName || !aliasName) throw new Error('functionName and aliasName are required.');
                const result = await callPost(`/functions/${encodeURIComponent(functionName)}/aliases`, { Name: aliasName, FunctionVersion: functionVersion, Description: description });
                return { output: result };
            }

            case 'updateAlias': {
                const functionName = String(inputs.functionName ?? '').trim();
                const aliasName = String(inputs.aliasName ?? '').trim();
                const functionVersion = String(inputs.functionVersion ?? '$LATEST').trim();
                if (!functionName || !aliasName) throw new Error('functionName and aliasName are required.');
                const result = await callPut(`/functions/${encodeURIComponent(functionName)}/aliases/${encodeURIComponent(aliasName)}`, { FunctionVersion: functionVersion });
                return { output: result };
            }

            case 'listAliases': {
                const functionName = String(inputs.functionName ?? '').trim();
                if (!functionName) throw new Error('functionName is required.');
                const result = await callGet(`/functions/${encodeURIComponent(functionName)}/aliases`);
                return { output: result };
            }

            case 'addPermission': {
                const functionName = String(inputs.functionName ?? '').trim();
                const statementId = String(inputs.statementId ?? '').trim();
                const action = String(inputs.action ?? 'lambda:InvokeFunction').trim();
                const principal = String(inputs.principal ?? '').trim();
                if (!functionName || !statementId || !principal) throw new Error('functionName, statementId, and principal are required.');
                const result = await callPost(`/functions/${encodeURIComponent(functionName)}/policy`, { StatementId: statementId, Action: action, Principal: principal });
                return { output: result };
            }

            case 'listEventSourceMappings': {
                const functionName = String(inputs.functionName ?? '');
                const path = `/event-source-mappings${functionName ? `?FunctionName=${encodeURIComponent(functionName)}` : ''}`;
                const result = await callGet(path);
                return { output: result };
            }

            default:
                return { error: `Action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Action failed.' };
    }
}
