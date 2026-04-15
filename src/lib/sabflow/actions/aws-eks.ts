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

export async function executeAwsEksAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const accessKeyId = String(inputs.accessKeyId ?? '').trim();
        const secretAccessKey = String(inputs.secretAccessKey ?? '').trim();
        const region = String(inputs.region ?? 'us-east-1').trim();
        if (!accessKeyId || !secretAccessKey) throw new Error('accessKeyId and secretAccessKey are required.');

        const base = `https://eks.${region}.amazonaws.com`;

        const get = async (path: string) => {
            const res = await awsFetch('GET', `${base}${path}`, region, 'eks', accessKeyId, secretAccessKey, '');
            const json = await res.json() as any;
            if (!res.ok) throw new Error(json.message || json.Message || JSON.stringify(json));
            return json;
        };
        const post = async (path: string, payload: object) => {
            const body = JSON.stringify(payload);
            const res = await awsFetch('POST', `${base}${path}`, region, 'eks', accessKeyId, secretAccessKey, body);
            const json = await res.json() as any;
            if (!res.ok) throw new Error(json.message || json.Message || JSON.stringify(json));
            return json;
        };
        const del = async (path: string) => {
            const res = await awsFetch('DELETE', `${base}${path}`, region, 'eks', accessKeyId, secretAccessKey, '');
            const json = await res.json() as any;
            if (!res.ok) throw new Error(json.message || json.Message || JSON.stringify(json));
            return json;
        };
        const patch = async (path: string, payload: object) => {
            const body = JSON.stringify(payload);
            const res = await awsFetch('PUT', `${base}${path}`, region, 'eks', accessKeyId, secretAccessKey, body);
            const json = await res.json() as any;
            if (!res.ok) throw new Error(json.message || json.Message || JSON.stringify(json));
            return json;
        };

        switch (actionName) {
            case 'listClusters': {
                logger.log('[EKS] Listing clusters');
                const data = await get('/clusters');
                return { output: { clusters: data.clusters ?? [], count: String((data.clusters ?? []).length) } };
            }
            case 'createCluster': {
                const name = String(inputs.name ?? '').trim();
                const roleArn = String(inputs.roleArn ?? '').trim();
                if (!name || !roleArn) throw new Error('name and roleArn are required.');
                logger.log(`[EKS] Creating cluster ${name}`);
                const payload: any = { name, roleArn, resourcesVpcConfig: inputs.resourcesVpcConfig ?? {} };
                if (inputs.version) payload.version = inputs.version;
                const data = await post('/clusters', payload);
                return { output: { cluster: data.cluster } };
            }
            case 'describeCluster': {
                const name = String(inputs.name ?? '').trim();
                if (!name) throw new Error('name is required.');
                logger.log(`[EKS] Describing cluster ${name}`);
                const data = await get(`/clusters/${name}`);
                return { output: { cluster: data.cluster } };
            }
            case 'deleteCluster': {
                const name = String(inputs.name ?? '').trim();
                if (!name) throw new Error('name is required.');
                logger.log(`[EKS] Deleting cluster ${name}`);
                const data = await del(`/clusters/${name}`);
                return { output: { cluster: data.cluster } };
            }
            case 'updateClusterConfig': {
                const name = String(inputs.name ?? '').trim();
                if (!name) throw new Error('name is required.');
                logger.log(`[EKS] Updating cluster config ${name}`);
                const payload: any = {};
                if (inputs.resourcesVpcConfig) payload.resourcesVpcConfig = inputs.resourcesVpcConfig;
                if (inputs.logging) payload.logging = inputs.logging;
                const data = await patch(`/clusters/${name}/update-config`, payload);
                return { output: { update: data.update } };
            }
            case 'listNodegroups': {
                const clusterName = String(inputs.clusterName ?? '').trim();
                if (!clusterName) throw new Error('clusterName is required.');
                logger.log(`[EKS] Listing nodegroups in ${clusterName}`);
                const data = await get(`/clusters/${clusterName}/node-groups`);
                return { output: { nodegroups: data.nodegroups ?? [], count: String((data.nodegroups ?? []).length) } };
            }
            case 'createNodegroup': {
                const clusterName = String(inputs.clusterName ?? '').trim();
                const nodegroupName = String(inputs.nodegroupName ?? '').trim();
                const nodeRole = String(inputs.nodeRole ?? '').trim();
                const subnets = inputs.subnets ? (Array.isArray(inputs.subnets) ? inputs.subnets : [inputs.subnets]) : [];
                if (!clusterName || !nodegroupName || !nodeRole) throw new Error('clusterName, nodegroupName, and nodeRole are required.');
                logger.log(`[EKS] Creating nodegroup ${nodegroupName}`);
                const payload: any = { nodegroupName, nodeRole, subnets };
                if (inputs.scalingConfig) payload.scalingConfig = inputs.scalingConfig;
                if (inputs.instanceTypes) payload.instanceTypes = inputs.instanceTypes;
                const data = await post(`/clusters/${clusterName}/node-groups`, payload);
                return { output: { nodegroup: data.nodegroup } };
            }
            case 'describeNodegroup': {
                const clusterName = String(inputs.clusterName ?? '').trim();
                const nodegroupName = String(inputs.nodegroupName ?? '').trim();
                if (!clusterName || !nodegroupName) throw new Error('clusterName and nodegroupName are required.');
                logger.log(`[EKS] Describing nodegroup ${nodegroupName}`);
                const data = await get(`/clusters/${clusterName}/node-groups/${nodegroupName}`);
                return { output: { nodegroup: data.nodegroup } };
            }
            case 'deleteNodegroup': {
                const clusterName = String(inputs.clusterName ?? '').trim();
                const nodegroupName = String(inputs.nodegroupName ?? '').trim();
                if (!clusterName || !nodegroupName) throw new Error('clusterName and nodegroupName are required.');
                logger.log(`[EKS] Deleting nodegroup ${nodegroupName}`);
                const data = await del(`/clusters/${clusterName}/node-groups/${nodegroupName}`);
                return { output: { nodegroup: data.nodegroup } };
            }
            case 'updateNodegroupConfig': {
                const clusterName = String(inputs.clusterName ?? '').trim();
                const nodegroupName = String(inputs.nodegroupName ?? '').trim();
                if (!clusterName || !nodegroupName) throw new Error('clusterName and nodegroupName are required.');
                logger.log(`[EKS] Updating nodegroup config ${nodegroupName}`);
                const payload: any = {};
                if (inputs.scalingConfig) payload.scalingConfig = inputs.scalingConfig;
                if (inputs.labels) payload.labels = inputs.labels;
                const data = await post(`/clusters/${clusterName}/node-groups/${nodegroupName}/update-config`, payload);
                return { output: { update: data.update } };
            }
            case 'listAddons': {
                const clusterName = String(inputs.clusterName ?? '').trim();
                if (!clusterName) throw new Error('clusterName is required.');
                logger.log(`[EKS] Listing addons for ${clusterName}`);
                const data = await get(`/clusters/${clusterName}/addons`);
                return { output: { addons: data.addons ?? [], count: String((data.addons ?? []).length) } };
            }
            case 'createAddon': {
                const clusterName = String(inputs.clusterName ?? '').trim();
                const addonName = String(inputs.addonName ?? '').trim();
                if (!clusterName || !addonName) throw new Error('clusterName and addonName are required.');
                logger.log(`[EKS] Creating addon ${addonName}`);
                const payload: any = { addonName };
                if (inputs.addonVersion) payload.addonVersion = inputs.addonVersion;
                if (inputs.serviceAccountRoleArn) payload.serviceAccountRoleArn = inputs.serviceAccountRoleArn;
                const data = await post(`/clusters/${clusterName}/addons`, payload);
                return { output: { addon: data.addon } };
            }
            case 'deleteAddon': {
                const clusterName = String(inputs.clusterName ?? '').trim();
                const addonName = String(inputs.addonName ?? '').trim();
                if (!clusterName || !addonName) throw new Error('clusterName and addonName are required.');
                logger.log(`[EKS] Deleting addon ${addonName}`);
                const data = await del(`/clusters/${clusterName}/addons/${addonName}`);
                return { output: { addon: data.addon } };
            }
            case 'describeAddon': {
                const clusterName = String(inputs.clusterName ?? '').trim();
                const addonName = String(inputs.addonName ?? '').trim();
                if (!clusterName || !addonName) throw new Error('clusterName and addonName are required.');
                logger.log(`[EKS] Describing addon ${addonName}`);
                const data = await get(`/clusters/${clusterName}/addons/${addonName}`);
                return { output: { addon: data.addon } };
            }
            case 'listUpdates': {
                const name = String(inputs.name ?? '').trim();
                if (!name) throw new Error('name (cluster name) is required.');
                logger.log(`[EKS] Listing updates for ${name}`);
                const data = await get(`/clusters/${name}/updates`);
                return { output: { updateIds: data.updateIds ?? [], count: String((data.updateIds ?? []).length) } };
            }
            default:
                return { error: `AWS EKS action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'AWS EKS action failed.' };
    }
}
