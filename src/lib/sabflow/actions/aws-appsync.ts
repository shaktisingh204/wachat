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
    const allHeaders: Record<string, string> = { 'Content-Type': 'application/json', 'X-Amz-Date': amzDate, 'Host': u.host, ...extraHeaders };
    const sh = Object.keys(allHeaders).map(k => k.toLowerCase()).sort().join(';');
    const ch = Object.entries(allHeaders).map(([k, v]) => `${k.toLowerCase()}:${v}\n`).sort().join('');
    const cr = [method, u.pathname, u.search.slice(1), ch, sh, sha256(body || '')].join('\n');
    const scope = `${ds}/${region}/${svc}/aws4_request`;
    const sts = `AWS4-HMAC-SHA256\n${amzDate}\n${scope}\n${sha256(cr)}`;
    const sig = hmac(signingKey(secret, ds, region, svc), sts).toString('hex');
    allHeaders['Authorization'] = `AWS4-HMAC-SHA256 Credential=${keyId}/${scope},SignedHeaders=${sh},Signature=${sig}`;
    return fetch(url, { method, headers: allHeaders, body: body || undefined });
}

export async function executeAwsAppSyncAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const region = inputs.region || 'us-east-1';
        const keyId = inputs.accessKeyId || inputs.key_id;
        const secret = inputs.secretAccessKey || inputs.secret;
        const svc = 'appsync';
        const base = `https://appsync.${region}.amazonaws.com`;

        const asFetch = (method: string, path: string, body?: Record<string, any>) =>
            awsFetch(method, base + path, region, svc, keyId, secret, body ? JSON.stringify(body) : '');

        switch (actionName) {
            case 'listGraphqlApis': {
                const params = new URLSearchParams();
                if (inputs.nextToken) params.set('nextToken', inputs.nextToken);
                if (inputs.maxResults) params.set('maxResults', String(inputs.maxResults));
                const qs = params.toString() ? `?${params}` : '';
                const res = await asFetch('GET', `/v1/apis${qs}`);
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'listGraphqlApis failed' };
                return { output: data };
            }
            case 'getGraphqlApi': {
                const res = await asFetch('GET', `/v1/apis/${inputs.apiId}`);
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'getGraphqlApi failed' };
                return { output: data };
            }
            case 'createGraphqlApi': {
                const body: Record<string, any> = {
                    name: inputs.name,
                    authenticationType: inputs.authenticationType || 'API_KEY',
                };
                if (inputs.logConfig) body.logConfig = inputs.logConfig;
                if (inputs.userPoolConfig) body.userPoolConfig = inputs.userPoolConfig;
                if (inputs.openIDConnectConfig) body.openIDConnectConfig = inputs.openIDConnectConfig;
                if (inputs.tags) body.tags = inputs.tags;
                const res = await asFetch('POST', '/v1/apis', body);
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'createGraphqlApi failed' };
                return { output: data };
            }
            case 'updateGraphqlApi': {
                const body: Record<string, any> = {
                    name: inputs.name,
                    authenticationType: inputs.authenticationType,
                };
                if (inputs.logConfig) body.logConfig = inputs.logConfig;
                if (inputs.userPoolConfig) body.userPoolConfig = inputs.userPoolConfig;
                const res = await asFetch('POST', `/v1/apis/${inputs.apiId}`, body);
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'updateGraphqlApi failed' };
                return { output: data };
            }
            case 'deleteGraphqlApi': {
                const res = await asFetch('DELETE', `/v1/apis/${inputs.apiId}`);
                const data = await res.json().catch(() => ({}));
                if (!res.ok) return { error: data.message || 'deleteGraphqlApi failed' };
                return { output: { deleted: true, apiId: inputs.apiId } };
            }
            case 'listDataSources': {
                const params = new URLSearchParams();
                if (inputs.nextToken) params.set('nextToken', inputs.nextToken);
                if (inputs.maxResults) params.set('maxResults', String(inputs.maxResults));
                const qs = params.toString() ? `?${params}` : '';
                const res = await asFetch('GET', `/v1/apis/${inputs.apiId}/datasources${qs}`);
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'listDataSources failed' };
                return { output: data };
            }
            case 'createDataSource': {
                const body: Record<string, any> = {
                    name: inputs.name,
                    type: inputs.type || 'NONE',
                };
                if (inputs.description) body.description = inputs.description;
                if (inputs.serviceRoleArn) body.serviceRoleArn = inputs.serviceRoleArn;
                if (inputs.dynamodbConfig) body.dynamodbConfig = inputs.dynamodbConfig;
                if (inputs.lambdaConfig) body.lambdaConfig = inputs.lambdaConfig;
                if (inputs.elasticsearchConfig) body.elasticsearchConfig = inputs.elasticsearchConfig;
                if (inputs.httpConfig) body.httpConfig = inputs.httpConfig;
                const res = await asFetch('POST', `/v1/apis/${inputs.apiId}/datasources`, body);
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'createDataSource failed' };
                return { output: data };
            }
            case 'getDataSource': {
                const res = await asFetch('GET', `/v1/apis/${inputs.apiId}/datasources/${inputs.name}`);
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'getDataSource failed' };
                return { output: data };
            }
            case 'updateDataSource': {
                const body: Record<string, any> = { type: inputs.type };
                if (inputs.description) body.description = inputs.description;
                if (inputs.serviceRoleArn) body.serviceRoleArn = inputs.serviceRoleArn;
                if (inputs.dynamodbConfig) body.dynamodbConfig = inputs.dynamodbConfig;
                if (inputs.lambdaConfig) body.lambdaConfig = inputs.lambdaConfig;
                if (inputs.httpConfig) body.httpConfig = inputs.httpConfig;
                const res = await asFetch('POST', `/v1/apis/${inputs.apiId}/datasources/${inputs.name}`, body);
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'updateDataSource failed' };
                return { output: data };
            }
            case 'deleteDataSource': {
                const res = await asFetch('DELETE', `/v1/apis/${inputs.apiId}/datasources/${inputs.name}`);
                const data = await res.json().catch(() => ({}));
                if (!res.ok) return { error: data.message || 'deleteDataSource failed' };
                return { output: { deleted: true, name: inputs.name } };
            }
            case 'listResolvers': {
                const params = new URLSearchParams();
                if (inputs.nextToken) params.set('nextToken', inputs.nextToken);
                const qs = params.toString() ? `?${params}` : '';
                const res = await asFetch('GET', `/v1/apis/${inputs.apiId}/types/${inputs.typeName}/resolvers${qs}`);
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'listResolvers failed' };
                return { output: data };
            }
            case 'createResolver': {
                const body: Record<string, any> = {
                    fieldName: inputs.fieldName,
                    dataSourceName: inputs.dataSourceName,
                    kind: inputs.kind || 'UNIT',
                };
                if (inputs.requestMappingTemplate) body.requestMappingTemplate = inputs.requestMappingTemplate;
                if (inputs.responseMappingTemplate) body.responseMappingTemplate = inputs.responseMappingTemplate;
                if (inputs.pipelineConfig) body.pipelineConfig = inputs.pipelineConfig;
                const res = await asFetch('POST', `/v1/apis/${inputs.apiId}/types/${inputs.typeName}/resolvers`, body);
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'createResolver failed' };
                return { output: data };
            }
            case 'updateResolver': {
                const body: Record<string, any> = {
                    dataSourceName: inputs.dataSourceName,
                    kind: inputs.kind || 'UNIT',
                };
                if (inputs.requestMappingTemplate) body.requestMappingTemplate = inputs.requestMappingTemplate;
                if (inputs.responseMappingTemplate) body.responseMappingTemplate = inputs.responseMappingTemplate;
                const res = await asFetch('POST', `/v1/apis/${inputs.apiId}/types/${inputs.typeName}/resolvers/${inputs.fieldName}`, body);
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'updateResolver failed' };
                return { output: data };
            }
            case 'deleteResolver': {
                const res = await asFetch('DELETE', `/v1/apis/${inputs.apiId}/types/${inputs.typeName}/resolvers/${inputs.fieldName}`);
                const data = await res.json().catch(() => ({}));
                if (!res.ok) return { error: data.message || 'deleteResolver failed' };
                return { output: { deleted: true, fieldName: inputs.fieldName } };
            }
            case 'executeGraphQL': {
                // Execute a GraphQL query/mutation against an AppSync API endpoint
                const endpoint = inputs.graphqlEndpoint || `https://${inputs.apiId}.appsync-api.${region}.amazonaws.com/graphql`;
                const body = JSON.stringify({
                    query: inputs.query,
                    variables: inputs.variables || {},
                    operationName: inputs.operationName,
                });
                const res = await awsFetch('POST', endpoint, region, svc, keyId, secret, body);
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'executeGraphQL failed' };
                if (data.errors?.length) return { error: JSON.stringify(data.errors) };
                return { output: data };
            }
            default:
                return { error: `Unknown AppSync action: ${actionName}` };
        }
    } catch (err: any) {
        return { error: err.message || 'Unexpected error in executeAwsAppSyncAction' };
    }
}
