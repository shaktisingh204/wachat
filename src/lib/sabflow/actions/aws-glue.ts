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

async function gluePost(target: string, payload: any, region: string, keyId: string, secret: string) {
    const url = `https://glue.${region}.amazonaws.com`;
    return awsFetch('POST', url, region, 'glue', keyId, secret, JSON.stringify(payload), { 'X-Amz-Target': `AWSGlue.${target}` });
}

export async function executeAwsGlueAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const keyId: string = inputs.aws_access_key_id || inputs.accessKeyId || '';
        const secret: string = inputs.aws_secret_access_key || inputs.secretAccessKey || '';
        const region: string = inputs.region || 'us-east-1';

        switch (actionName) {
            case 'listDatabases': {
                const res = await gluePost('GetDatabases', {
                    MaxResults: inputs.maxResults || inputs.max_results || 100,
                    NextToken: inputs.nextToken || inputs.next_token,
                    CatalogId: inputs.catalogId || inputs.catalog_id,
                }, region, keyId, secret);
                const data = await res.json();
                if (!res.ok) return { error: data.Message || JSON.stringify(data) };
                return { output: data };
            }
            case 'getDatabase': {
                const res = await gluePost('GetDatabase', {
                    Name: inputs.name || inputs.database_name,
                    CatalogId: inputs.catalogId || inputs.catalog_id,
                }, region, keyId, secret);
                const data = await res.json();
                if (!res.ok) return { error: data.Message || JSON.stringify(data) };
                return { output: data };
            }
            case 'createDatabase': {
                const res = await gluePost('CreateDatabase', {
                    DatabaseInput: {
                        Name: inputs.name || inputs.database_name,
                        Description: inputs.description,
                        LocationUri: inputs.locationUri || inputs.location_uri,
                    },
                    CatalogId: inputs.catalogId || inputs.catalog_id,
                }, region, keyId, secret);
                const data = await res.json();
                if (!res.ok) return { error: data.Message || JSON.stringify(data) };
                return { output: data };
            }
            case 'deleteDatabase': {
                const res = await gluePost('DeleteDatabase', {
                    Name: inputs.name || inputs.database_name,
                    CatalogId: inputs.catalogId || inputs.catalog_id,
                }, region, keyId, secret);
                const data = await res.json();
                if (!res.ok) return { error: data.Message || JSON.stringify(data) };
                return { output: { success: true } };
            }
            case 'listTables': {
                const res = await gluePost('GetTables', {
                    DatabaseName: inputs.databaseName || inputs.database_name,
                    MaxResults: inputs.maxResults || inputs.max_results || 100,
                    NextToken: inputs.nextToken || inputs.next_token,
                    CatalogId: inputs.catalogId || inputs.catalog_id,
                }, region, keyId, secret);
                const data = await res.json();
                if (!res.ok) return { error: data.Message || JSON.stringify(data) };
                return { output: data };
            }
            case 'getTable': {
                const res = await gluePost('GetTable', {
                    DatabaseName: inputs.databaseName || inputs.database_name,
                    Name: inputs.name || inputs.table_name,
                    CatalogId: inputs.catalogId || inputs.catalog_id,
                }, region, keyId, secret);
                const data = await res.json();
                if (!res.ok) return { error: data.Message || JSON.stringify(data) };
                return { output: data };
            }
            case 'createTable': {
                const res = await gluePost('CreateTable', {
                    DatabaseName: inputs.databaseName || inputs.database_name,
                    TableInput: inputs.tableInput || inputs.table_input || { Name: inputs.name || inputs.table_name },
                    CatalogId: inputs.catalogId || inputs.catalog_id,
                }, region, keyId, secret);
                const data = await res.json();
                if (!res.ok) return { error: data.Message || JSON.stringify(data) };
                return { output: data };
            }
            case 'deleteTable': {
                const res = await gluePost('DeleteTable', {
                    DatabaseName: inputs.databaseName || inputs.database_name,
                    Name: inputs.name || inputs.table_name,
                    CatalogId: inputs.catalogId || inputs.catalog_id,
                }, region, keyId, secret);
                const data = await res.json();
                if (!res.ok) return { error: data.Message || JSON.stringify(data) };
                return { output: { success: true } };
            }
            case 'listJobs': {
                const res = await gluePost('GetJobs', {
                    MaxResults: inputs.maxResults || inputs.max_results || 100,
                    NextToken: inputs.nextToken || inputs.next_token,
                }, region, keyId, secret);
                const data = await res.json();
                if (!res.ok) return { error: data.Message || JSON.stringify(data) };
                return { output: data };
            }
            case 'getJob': {
                const res = await gluePost('GetJob', {
                    JobName: inputs.jobName || inputs.job_name,
                }, region, keyId, secret);
                const data = await res.json();
                if (!res.ok) return { error: data.Message || JSON.stringify(data) };
                return { output: data };
            }
            case 'startJobRun': {
                const res = await gluePost('StartJobRun', {
                    JobName: inputs.jobName || inputs.job_name,
                    Arguments: inputs.arguments || inputs.args || {},
                    WorkerType: inputs.workerType || inputs.worker_type,
                    NumberOfWorkers: inputs.numberOfWorkers || inputs.number_of_workers,
                }, region, keyId, secret);
                const data = await res.json();
                if (!res.ok) return { error: data.Message || JSON.stringify(data) };
                return { output: data };
            }
            case 'getJobRun': {
                const res = await gluePost('GetJobRun', {
                    JobName: inputs.jobName || inputs.job_name,
                    RunId: inputs.runId || inputs.run_id,
                }, region, keyId, secret);
                const data = await res.json();
                if (!res.ok) return { error: data.Message || JSON.stringify(data) };
                return { output: data };
            }
            case 'listJobRuns': {
                const res = await gluePost('GetJobRuns', {
                    JobName: inputs.jobName || inputs.job_name,
                    MaxResults: inputs.maxResults || inputs.max_results || 100,
                    NextToken: inputs.nextToken || inputs.next_token,
                }, region, keyId, secret);
                const data = await res.json();
                if (!res.ok) return { error: data.Message || JSON.stringify(data) };
                return { output: data };
            }
            case 'createCrawler': {
                const res = await gluePost('CreateCrawler', {
                    Name: inputs.name || inputs.crawler_name,
                    Role: inputs.role || inputs.role_arn,
                    DatabaseName: inputs.databaseName || inputs.database_name,
                    Targets: inputs.targets || {},
                    Schedule: inputs.schedule,
                    Description: inputs.description,
                }, region, keyId, secret);
                const data = await res.json();
                if (!res.ok) return { error: data.Message || JSON.stringify(data) };
                return { output: data };
            }
            case 'startCrawler': {
                const res = await gluePost('StartCrawler', {
                    Name: inputs.name || inputs.crawler_name,
                }, region, keyId, secret);
                const data = await res.json();
                if (!res.ok) return { error: data.Message || JSON.stringify(data) };
                return { output: { success: true } };
            }
            default:
                return { error: `Unknown AWS Glue action: ${actionName}` };
        }
    } catch (e: any) {
        logger.log(`AWS Glue action error: ${e.message}`);
        return { error: e.message || 'Unknown error in AWS Glue action' };
    }
}
