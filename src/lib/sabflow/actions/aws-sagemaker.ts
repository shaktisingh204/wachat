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

async function sagemakerPost(target: string, payload: any, region: string, keyId: string, secret: string) {
    const url = `https://sagemaker.${region}.amazonaws.com`;
    return awsFetch('POST', url, region, 'sagemaker', keyId, secret, JSON.stringify(payload), { 'X-Amz-Target': `SageMaker.${target}` });
}

export async function executeAwsSagemakerAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const keyId: string = inputs.aws_access_key_id || inputs.accessKeyId || '';
        const secret: string = inputs.aws_secret_access_key || inputs.secretAccessKey || '';
        const region: string = inputs.region || 'us-east-1';

        switch (actionName) {
            case 'createTrainingJob': {
                const res = await sagemakerPost('CreateTrainingJob', {
                    TrainingJobName: inputs.trainingJobName || inputs.training_job_name,
                    AlgorithmSpecification: inputs.algorithmSpecification || inputs.algorithm_specification,
                    RoleArn: inputs.roleArn || inputs.role_arn,
                    InputDataConfig: inputs.inputDataConfig || inputs.input_data_config,
                    OutputDataConfig: inputs.outputDataConfig || inputs.output_data_config,
                    ResourceConfig: inputs.resourceConfig || inputs.resource_config,
                    StoppingCondition: inputs.stoppingCondition || inputs.stopping_condition,
                }, region, keyId, secret);
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: data };
            }
            case 'describeTrainingJob': {
                const res = await sagemakerPost('DescribeTrainingJob', {
                    TrainingJobName: inputs.trainingJobName || inputs.training_job_name,
                }, region, keyId, secret);
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: data };
            }
            case 'listTrainingJobs': {
                const res = await sagemakerPost('ListTrainingJobs', {
                    MaxResults: inputs.maxResults || inputs.max_results || 100,
                    NextToken: inputs.nextToken || inputs.next_token,
                }, region, keyId, secret);
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: data };
            }
            case 'stopTrainingJob': {
                const res = await sagemakerPost('StopTrainingJob', {
                    TrainingJobName: inputs.trainingJobName || inputs.training_job_name,
                }, region, keyId, secret);
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: data };
            }
            case 'createModel': {
                const res = await sagemakerPost('CreateModel', {
                    ModelName: inputs.modelName || inputs.model_name,
                    PrimaryContainer: inputs.primaryContainer || inputs.primary_container,
                    ExecutionRoleArn: inputs.executionRoleArn || inputs.execution_role_arn,
                }, region, keyId, secret);
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: data };
            }
            case 'describeModel': {
                const res = await sagemakerPost('DescribeModel', {
                    ModelName: inputs.modelName || inputs.model_name,
                }, region, keyId, secret);
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: data };
            }
            case 'listModels': {
                const res = await sagemakerPost('ListModels', {
                    MaxResults: inputs.maxResults || inputs.max_results || 100,
                    NextToken: inputs.nextToken || inputs.next_token,
                }, region, keyId, secret);
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: data };
            }
            case 'deleteModel': {
                const res = await sagemakerPost('DeleteModel', {
                    ModelName: inputs.modelName || inputs.model_name,
                }, region, keyId, secret);
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: { success: true } };
            }
            case 'createEndpointConfig': {
                const res = await sagemakerPost('CreateEndpointConfig', {
                    EndpointConfigName: inputs.endpointConfigName || inputs.endpoint_config_name,
                    ProductionVariants: inputs.productionVariants || inputs.production_variants,
                }, region, keyId, secret);
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: data };
            }
            case 'describeEndpointConfig': {
                const res = await sagemakerPost('DescribeEndpointConfig', {
                    EndpointConfigName: inputs.endpointConfigName || inputs.endpoint_config_name,
                }, region, keyId, secret);
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: data };
            }
            case 'createEndpoint': {
                const res = await sagemakerPost('CreateEndpoint', {
                    EndpointName: inputs.endpointName || inputs.endpoint_name,
                    EndpointConfigName: inputs.endpointConfigName || inputs.endpoint_config_name,
                }, region, keyId, secret);
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: data };
            }
            case 'describeEndpoint': {
                const res = await sagemakerPost('DescribeEndpoint', {
                    EndpointName: inputs.endpointName || inputs.endpoint_name,
                }, region, keyId, secret);
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: data };
            }
            case 'listEndpoints': {
                const res = await sagemakerPost('ListEndpoints', {
                    MaxResults: inputs.maxResults || inputs.max_results || 100,
                    NextToken: inputs.nextToken || inputs.next_token,
                }, region, keyId, secret);
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: data };
            }
            case 'deleteEndpoint': {
                const res = await sagemakerPost('DeleteEndpoint', {
                    EndpointName: inputs.endpointName || inputs.endpoint_name,
                }, region, keyId, secret);
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: { success: true } };
            }
            case 'invokeEndpoint': {
                const endpointName: string = inputs.endpointName || inputs.endpoint_name;
                const body = typeof inputs.body === 'string' ? inputs.body : JSON.stringify(inputs.body || inputs.payload || {});
                const url = `https://runtime.sagemaker.${region}.amazonaws.com/endpoints/${encodeURIComponent(endpointName)}/invocations`;
                const res = await awsFetch('POST', url, region, 'sagemaker', keyId, secret, body, {
                    'Content-Type': inputs.contentType || inputs.content_type || 'application/json',
                });
                const responseText = await res.text();
                if (!res.ok) return { error: responseText };
                try { return { output: JSON.parse(responseText) }; } catch { return { output: { raw: responseText } }; }
            }
            default:
                return { error: `Unknown AWS SageMaker action: ${actionName}` };
        }
    } catch (e: any) {
        logger.log(`AWS SageMaker action error: ${e.message}`);
        return { error: e.message || 'Unknown error in AWS SageMaker action' };
    }
}
