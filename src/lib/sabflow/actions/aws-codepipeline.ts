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

const TARGET_PREFIX = 'CodePipeline_20150709';

export async function executeAwsCodepipelineAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const accessKeyId = String(inputs.accessKeyId ?? '').trim();
        const secretAccessKey = String(inputs.secretAccessKey ?? '').trim();
        const region = String(inputs.region ?? 'us-east-1').trim();
        if (!accessKeyId || !secretAccessKey) throw new Error('accessKeyId and secretAccessKey are required.');

        const endpoint = `https://codepipeline.${region}.amazonaws.com`;

        const call = async (target: string, payload: object) => {
            const body = JSON.stringify(payload);
            const res = await awsFetch('POST', endpoint, region, 'codepipeline', accessKeyId, secretAccessKey, body, {
                'X-Amz-Target': `${TARGET_PREFIX}.${target}`,
            });
            const json = await res.json() as any;
            if (!res.ok) throw new Error(json.message || json.Message || JSON.stringify(json));
            return json;
        };

        switch (actionName) {
            case 'listPipelines': {
                logger.log('[CodePipeline] Listing pipelines');
                const data = await call('ListPipelines', {});
                const pipelines = (data.pipelines ?? []).map((p: any) => ({ name: p.name, version: p.version, updated: p.updated }));
                return { output: { pipelines, count: String(pipelines.length) } };
            }
            case 'getPipeline': {
                const name = String(inputs.name ?? '').trim();
                if (!name) throw new Error('name is required.');
                logger.log(`[CodePipeline] Getting pipeline ${name}`);
                const data = await call('GetPipeline', { name });
                return { output: { pipeline: data.pipeline, metadata: data.metadata } };
            }
            case 'createPipeline': {
                const pipeline = inputs.pipeline;
                if (!pipeline) throw new Error('pipeline definition object is required.');
                logger.log(`[CodePipeline] Creating pipeline ${pipeline.name ?? ''}`);
                const data = await call('CreatePipeline', { pipeline });
                return { output: { pipeline: data.pipeline } };
            }
            case 'updatePipeline': {
                const pipeline = inputs.pipeline;
                if (!pipeline) throw new Error('pipeline definition object is required.');
                logger.log(`[CodePipeline] Updating pipeline ${pipeline.name ?? ''}`);
                const data = await call('UpdatePipeline', { pipeline });
                return { output: { pipeline: data.pipeline } };
            }
            case 'deletePipeline': {
                const name = String(inputs.name ?? '').trim();
                if (!name) throw new Error('name is required.');
                logger.log(`[CodePipeline] Deleting pipeline ${name}`);
                await call('DeletePipeline', { name });
                return { output: { deleted: 'true', name } };
            }
            case 'startPipelineExecution': {
                const name = String(inputs.name ?? '').trim();
                if (!name) throw new Error('name is required.');
                logger.log(`[CodePipeline] Starting execution for pipeline ${name}`);
                const payload: any = { name };
                if (inputs.clientRequestToken) payload.clientRequestToken = inputs.clientRequestToken;
                const data = await call('StartPipelineExecution', payload);
                return { output: { pipelineExecutionId: data.pipelineExecutionId } };
            }
            case 'stopPipelineExecution': {
                const pipelineName = String(inputs.pipelineName ?? '').trim();
                const pipelineExecutionId = String(inputs.pipelineExecutionId ?? '').trim();
                if (!pipelineName || !pipelineExecutionId) throw new Error('pipelineName and pipelineExecutionId are required.');
                logger.log(`[CodePipeline] Stopping execution ${pipelineExecutionId}`);
                const payload: any = { pipelineName, pipelineExecutionId, abandon: inputs.abandon === 'true' || inputs.abandon === true };
                if (inputs.reason) payload.reason = inputs.reason;
                const data = await call('StopPipelineExecution', payload);
                return { output: { pipelineExecutionId: data.pipelineExecutionId } };
            }
            case 'getPipelineExecution': {
                const pipelineName = String(inputs.pipelineName ?? '').trim();
                const pipelineExecutionId = String(inputs.pipelineExecutionId ?? '').trim();
                if (!pipelineName || !pipelineExecutionId) throw new Error('pipelineName and pipelineExecutionId are required.');
                logger.log(`[CodePipeline] Getting execution ${pipelineExecutionId}`);
                const data = await call('GetPipelineExecution', { pipelineName, pipelineExecutionId });
                return { output: { pipelineExecution: data.pipelineExecution } };
            }
            case 'listPipelineExecutions': {
                const pipelineName = String(inputs.pipelineName ?? '').trim();
                if (!pipelineName) throw new Error('pipelineName is required.');
                logger.log(`[CodePipeline] Listing executions for ${pipelineName}`);
                const data = await call('ListPipelineExecutions', { pipelineName, maxResults: Number(inputs.maxResults ?? 20) });
                const summaries = data.pipelineExecutionSummaries ?? [];
                return { output: { pipelineExecutionSummaries: summaries, count: String(summaries.length) } };
            }
            case 'getPipelineState': {
                const name = String(inputs.name ?? '').trim();
                if (!name) throw new Error('name is required.');
                logger.log(`[CodePipeline] Getting state for pipeline ${name}`);
                const data = await call('GetPipelineState', { name });
                return { output: { pipelineName: data.pipelineName, pipelineVersion: String(data.pipelineVersion ?? ''), stageStates: data.stageStates ?? [] } };
            }
            case 'listActionExecutions': {
                const pipelineName = String(inputs.pipelineName ?? '').trim();
                if (!pipelineName) throw new Error('pipelineName is required.');
                logger.log(`[CodePipeline] Listing action executions for ${pipelineName}`);
                const payload: any = { pipelineName, maxResults: Number(inputs.maxResults ?? 20) };
                if (inputs.filter) payload.filter = inputs.filter;
                const data = await call('ListActionExecutions', payload);
                const items = data.actionExecutionDetails ?? [];
                return { output: { actionExecutionDetails: items, count: String(items.length) } };
            }
            case 'retryStageExecution': {
                const pipelineName = String(inputs.pipelineName ?? '').trim();
                const stageName = String(inputs.stageName ?? '').trim();
                const pipelineExecutionId = String(inputs.pipelineExecutionId ?? '').trim();
                const retryMode = String(inputs.retryMode ?? 'FAILED_ACTIONS').trim();
                if (!pipelineName || !stageName || !pipelineExecutionId) throw new Error('pipelineName, stageName, and pipelineExecutionId are required.');
                logger.log(`[CodePipeline] Retrying stage ${stageName} for ${pipelineName}`);
                const data = await call('RetryStageExecution', { pipelineName, stageName, pipelineExecutionId, retryMode });
                return { output: { pipelineExecutionId: data.pipelineExecutionId } };
            }
            case 'listWebhooks': {
                logger.log('[CodePipeline] Listing webhooks');
                const data = await call('ListWebhooks', { MaxResults: Number(inputs.maxResults ?? 100) });
                const webhooks = data.webhooks ?? [];
                return { output: { webhooks, count: String(webhooks.length) } };
            }
            case 'putWebhook': {
                const webhook = inputs.webhook;
                if (!webhook) throw new Error('webhook definition object is required.');
                logger.log(`[CodePipeline] Putting webhook ${webhook.name ?? ''}`);
                const payload: any = { webhook };
                if (inputs.tags) payload.tags = inputs.tags;
                const data = await call('PutWebhook', payload);
                return { output: { webhook: data.webhook } };
            }
            case 'deleteWebhook': {
                const name = String(inputs.name ?? '').trim();
                if (!name) throw new Error('name is required.');
                logger.log(`[CodePipeline] Deleting webhook ${name}`);
                await call('DeleteWebhook', { name });
                return { output: { deleted: 'true', name } };
            }
            default:
                return { error: `AWS CodePipeline action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'AWS CodePipeline action failed.' };
    }
}
