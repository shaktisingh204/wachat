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

const BASE = 'AmazonEC2ContainerServiceV20141113';

export async function executeAwsEcsAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const accessKeyId = String(inputs.accessKeyId ?? '').trim();
        const secretAccessKey = String(inputs.secretAccessKey ?? '').trim();
        const region = String(inputs.region ?? 'us-east-1').trim();
        if (!accessKeyId || !secretAccessKey) throw new Error('accessKeyId and secretAccessKey are required.');

        const endpoint = `https://ecs.${region}.amazonaws.com`;

        const call = async (target: string, payload: object) => {
            const body = JSON.stringify(payload);
            const res = await awsFetch('POST', endpoint, region, 'ecs', accessKeyId, secretAccessKey, body, {
                'X-Amz-Target': `${BASE}.${target}`,
            });
            const json = await res.json() as any;
            if (!res.ok) throw new Error(json.message || json.Message || JSON.stringify(json));
            return json;
        };

        switch (actionName) {
            case 'listClusters': {
                logger.log('[ECS] Listing clusters');
                const data = await call('ListClusters', { maxResults: Number(inputs.maxResults ?? 100) });
                return { output: { clusterArns: data.clusterArns ?? [], count: String((data.clusterArns ?? []).length) } };
            }
            case 'describeClusters': {
                const clusters = inputs.clusters ? (Array.isArray(inputs.clusters) ? inputs.clusters : [inputs.clusters]) : [];
                logger.log('[ECS] Describing clusters');
                const data = await call('DescribeClusters', { clusters });
                return { output: { clusters: data.clusters ?? [], failures: data.failures ?? [] } };
            }
            case 'createCluster': {
                const clusterName = String(inputs.clusterName ?? '').trim();
                if (!clusterName) throw new Error('clusterName is required.');
                logger.log(`[ECS] Creating cluster ${clusterName}`);
                const data = await call('CreateCluster', { clusterName });
                return { output: { cluster: data.cluster } };
            }
            case 'deleteCluster': {
                const cluster = String(inputs.cluster ?? '').trim();
                if (!cluster) throw new Error('cluster is required.');
                logger.log(`[ECS] Deleting cluster ${cluster}`);
                const data = await call('DeleteCluster', { cluster });
                return { output: { cluster: data.cluster } };
            }
            case 'listServices': {
                const cluster = String(inputs.cluster ?? '').trim();
                if (!cluster) throw new Error('cluster is required.');
                logger.log(`[ECS] Listing services in ${cluster}`);
                const data = await call('ListServices', { cluster, maxResults: Number(inputs.maxResults ?? 100) });
                return { output: { serviceArns: data.serviceArns ?? [], count: String((data.serviceArns ?? []).length) } };
            }
            case 'describeServices': {
                const cluster = String(inputs.cluster ?? '').trim();
                const services = inputs.services ? (Array.isArray(inputs.services) ? inputs.services : [inputs.services]) : [];
                if (!cluster) throw new Error('cluster is required.');
                logger.log('[ECS] Describing services');
                const data = await call('DescribeServices', { cluster, services });
                return { output: { services: data.services ?? [], failures: data.failures ?? [] } };
            }
            case 'createService': {
                const cluster = String(inputs.cluster ?? '').trim();
                const serviceName = String(inputs.serviceName ?? '').trim();
                const taskDefinition = String(inputs.taskDefinition ?? '').trim();
                if (!cluster || !serviceName || !taskDefinition) throw new Error('cluster, serviceName, and taskDefinition are required.');
                logger.log(`[ECS] Creating service ${serviceName}`);
                const payload: any = { cluster, serviceName, taskDefinition, desiredCount: Number(inputs.desiredCount ?? 1) };
                if (inputs.launchType) payload.launchType = inputs.launchType;
                const data = await call('CreateService', payload);
                return { output: { service: data.service } };
            }
            case 'updateService': {
                const cluster = String(inputs.cluster ?? '').trim();
                const service = String(inputs.service ?? '').trim();
                if (!cluster || !service) throw new Error('cluster and service are required.');
                logger.log(`[ECS] Updating service ${service}`);
                const payload: any = { cluster, service };
                if (inputs.desiredCount !== undefined) payload.desiredCount = Number(inputs.desiredCount);
                if (inputs.taskDefinition) payload.taskDefinition = inputs.taskDefinition;
                const data = await call('UpdateService', payload);
                return { output: { service: data.service } };
            }
            case 'deleteService': {
                const cluster = String(inputs.cluster ?? '').trim();
                const service = String(inputs.service ?? '').trim();
                if (!cluster || !service) throw new Error('cluster and service are required.');
                logger.log(`[ECS] Deleting service ${service}`);
                const data = await call('DeleteService', { cluster, service, force: inputs.force === 'true' || inputs.force === true });
                return { output: { service: data.service } };
            }
            case 'listTasks': {
                const cluster = String(inputs.cluster ?? '').trim();
                if (!cluster) throw new Error('cluster is required.');
                logger.log(`[ECS] Listing tasks in ${cluster}`);
                const payload: any = { cluster, maxResults: Number(inputs.maxResults ?? 100) };
                if (inputs.serviceName) payload.serviceName = inputs.serviceName;
                if (inputs.desiredStatus) payload.desiredStatus = inputs.desiredStatus;
                const data = await call('ListTasks', payload);
                return { output: { taskArns: data.taskArns ?? [], count: String((data.taskArns ?? []).length) } };
            }
            case 'describeTasks': {
                const cluster = String(inputs.cluster ?? '').trim();
                const tasks = inputs.tasks ? (Array.isArray(inputs.tasks) ? inputs.tasks : [inputs.tasks]) : [];
                if (!cluster) throw new Error('cluster is required.');
                logger.log('[ECS] Describing tasks');
                const data = await call('DescribeTasks', { cluster, tasks });
                return { output: { tasks: data.tasks ?? [], failures: data.failures ?? [] } };
            }
            case 'runTask': {
                const cluster = String(inputs.cluster ?? '').trim();
                const taskDefinition = String(inputs.taskDefinition ?? '').trim();
                if (!cluster || !taskDefinition) throw new Error('cluster and taskDefinition are required.');
                logger.log(`[ECS] Running task ${taskDefinition}`);
                const payload: any = { cluster, taskDefinition, count: Number(inputs.count ?? 1) };
                if (inputs.launchType) payload.launchType = inputs.launchType;
                if (inputs.networkConfiguration) payload.networkConfiguration = inputs.networkConfiguration;
                const data = await call('RunTask', payload);
                return { output: { tasks: data.tasks ?? [], failures: data.failures ?? [] } };
            }
            case 'stopTask': {
                const cluster = String(inputs.cluster ?? '').trim();
                const task = String(inputs.task ?? '').trim();
                if (!cluster || !task) throw new Error('cluster and task are required.');
                logger.log(`[ECS] Stopping task ${task}`);
                const data = await call('StopTask', { cluster, task, reason: inputs.reason ?? 'Stopped by SabFlow' });
                return { output: { task: data.task } };
            }
            case 'listTaskDefinitions': {
                logger.log('[ECS] Listing task definitions');
                const payload: any = { maxResults: Number(inputs.maxResults ?? 100) };
                if (inputs.familyPrefix) payload.familyPrefix = inputs.familyPrefix;
                if (inputs.status) payload.status = inputs.status;
                const data = await call('ListTaskDefinitions', payload);
                return { output: { taskDefinitionArns: data.taskDefinitionArns ?? [], count: String((data.taskDefinitionArns ?? []).length) } };
            }
            case 'describeTaskDefinition': {
                const taskDefinition = String(inputs.taskDefinition ?? '').trim();
                if (!taskDefinition) throw new Error('taskDefinition is required.');
                logger.log(`[ECS] Describing task definition ${taskDefinition}`);
                const data = await call('DescribeTaskDefinition', { taskDefinition });
                return { output: { taskDefinition: data.taskDefinition, tags: data.tags ?? [] } };
            }
            default:
                return { error: `AWS ECS action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'AWS ECS action failed.' };
    }
}
