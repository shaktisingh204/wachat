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
    const cr = [method, u.pathname, u.search.slice(1), ch, sh, sha256(body)].join('\n');
    const scope = `${ds}/${region}/${svc}/aws4_request`;
    const sts = `AWS4-HMAC-SHA256\n${amzDate}\n${scope}\n${sha256(cr)}`;
    const sig = hmac(signingKey(secret, ds, region, svc), sts).toString('hex');
    allHeaders['Authorization'] = `AWS4-HMAC-SHA256 Credential=${keyId}/${scope},SignedHeaders=${sh},Signature=${sig}`;
    return fetch(url, { method, headers: allHeaders, body: body || undefined });
}

export async function executeAwsBedrockAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const keyId: string = inputs.aws_access_key_id || inputs.accessKeyId || '';
        const secret: string = inputs.aws_secret_access_key || inputs.secretAccessKey || '';
        const region: string = inputs.region || 'us-east-1';
        const runtimeBase = `https://bedrock-runtime.${region}.amazonaws.com`;
        const controlBase = `https://bedrock.${region}.amazonaws.com`;

        switch (actionName) {
            case 'invokeModel': {
                const modelId: string = inputs.modelId || inputs.model_id;
                const body = JSON.stringify(inputs.body || inputs.payload || {});
                const url = `${runtimeBase}/model/${encodeURIComponent(modelId)}/invoke`;
                const res = await awsFetch('POST', url, region, 'bedrock', keyId, secret, body);
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: data };
            }
            case 'invokeModelWithStream': {
                const modelId: string = inputs.modelId || inputs.model_id;
                const body = JSON.stringify(inputs.body || inputs.payload || {});
                const url = `${runtimeBase}/model/${encodeURIComponent(modelId)}/invoke-with-response-stream`;
                const res = await awsFetch('POST', url, region, 'bedrock', keyId, secret, body);
                const data = await res.text();
                if (!res.ok) return { error: data };
                return { output: { raw: data } };
            }
            case 'listFoundationModels': {
                const url = `${controlBase}/foundation-models`;
                const res = await awsFetch('GET', url, region, 'bedrock', keyId, secret, '');
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: data };
            }
            case 'getFoundationModel': {
                const modelId: string = inputs.modelId || inputs.model_id;
                const url = `${controlBase}/foundation-models/${encodeURIComponent(modelId)}`;
                const res = await awsFetch('GET', url, region, 'bedrock', keyId, secret, '');
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: data };
            }
            case 'listCustomModels': {
                const url = `${controlBase}/custom-models`;
                const res = await awsFetch('GET', url, region, 'bedrock', keyId, secret, '');
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: data };
            }
            case 'getCustomModel': {
                const modelId: string = inputs.modelId || inputs.model_id;
                const url = `${controlBase}/custom-models/${encodeURIComponent(modelId)}`;
                const res = await awsFetch('GET', url, region, 'bedrock', keyId, secret, '');
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: data };
            }
            case 'createModelCustomizationJob': {
                const body = JSON.stringify({
                    jobName: inputs.jobName || inputs.job_name,
                    customModelName: inputs.customModelName || inputs.custom_model_name,
                    roleArn: inputs.roleArn || inputs.role_arn,
                    baseModelIdentifier: inputs.baseModelIdentifier || inputs.base_model_identifier,
                    trainingDataConfig: inputs.trainingDataConfig || inputs.training_data_config,
                    outputDataConfig: inputs.outputDataConfig || inputs.output_data_config,
                    hyperParameters: inputs.hyperParameters || inputs.hyper_parameters || {},
                });
                const url = `${controlBase}/model-customization-jobs`;
                const res = await awsFetch('POST', url, region, 'bedrock', keyId, secret, body);
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: data };
            }
            case 'getModelCustomizationJob': {
                const jobId: string = inputs.jobId || inputs.job_id;
                const url = `${controlBase}/model-customization-jobs/${encodeURIComponent(jobId)}`;
                const res = await awsFetch('GET', url, region, 'bedrock', keyId, secret, '');
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: data };
            }
            case 'listModelCustomizationJobs': {
                const url = `${controlBase}/model-customization-jobs`;
                const res = await awsFetch('GET', url, region, 'bedrock', keyId, secret, '');
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: data };
            }
            case 'createProvisionedModelThroughput': {
                const body = JSON.stringify({
                    modelUnits: inputs.modelUnits || inputs.model_units,
                    provisionedModelName: inputs.provisionedModelName || inputs.provisioned_model_name,
                    modelId: inputs.modelId || inputs.model_id,
                });
                const url = `${controlBase}/provisioned-model-throughput`;
                const res = await awsFetch('POST', url, region, 'bedrock', keyId, secret, body);
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: data };
            }
            case 'getProvisionedModelThroughput': {
                const provisionedModelId: string = inputs.provisionedModelId || inputs.provisioned_model_id;
                const url = `${controlBase}/provisioned-model-throughput/${encodeURIComponent(provisionedModelId)}`;
                const res = await awsFetch('GET', url, region, 'bedrock', keyId, secret, '');
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: data };
            }
            case 'listProvisionedModelThroughputs': {
                const url = `${controlBase}/provisioned-model-throughput`;
                const res = await awsFetch('GET', url, region, 'bedrock', keyId, secret, '');
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: data };
            }
            case 'deleteProvisionedModelThroughput': {
                const provisionedModelId: string = inputs.provisionedModelId || inputs.provisioned_model_id;
                const url = `${controlBase}/provisioned-model-throughput/${encodeURIComponent(provisionedModelId)}`;
                const res = await awsFetch('DELETE', url, region, 'bedrock', keyId, secret, '');
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: data };
            }
            case 'invokeClaudeModel': {
                const modelId: string = inputs.modelId || inputs.model_id || 'anthropic.claude-3-5-sonnet-20241022-v2:0';
                const prompt: string = inputs.prompt || inputs.message || '';
                const maxTokens: number = inputs.maxTokens || inputs.max_tokens || 1024;
                const body = JSON.stringify({
                    anthropic_version: 'bedrock-2023-05-31',
                    max_tokens: maxTokens,
                    messages: [{ role: 'user', content: prompt }],
                });
                const url = `${runtimeBase}/model/${encodeURIComponent(modelId)}/invoke`;
                const res = await awsFetch('POST', url, region, 'bedrock', keyId, secret, body);
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: data };
            }
            case 'invokeEmbeddingModel': {
                const modelId: string = inputs.modelId || inputs.model_id || 'amazon.titan-embed-text-v1';
                const inputText: string = inputs.inputText || inputs.input_text || inputs.text || '';
                const body = JSON.stringify({ inputText });
                const url = `${runtimeBase}/model/${encodeURIComponent(modelId)}/invoke`;
                const res = await awsFetch('POST', url, region, 'bedrock', keyId, secret, body);
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: data };
            }
            default:
                return { error: `Unknown AWS Bedrock action: ${actionName}` };
        }
    } catch (e: any) {
        logger.log(`AWS Bedrock action error: ${e.message}`);
        return { error: e.message || 'Unknown error in AWS Bedrock action' };
    }
}
