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

export async function executeAwsLightsailAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const region = inputs.region || 'us-east-1';
        const keyId = inputs.accessKeyId || inputs.key_id;
        const secret = inputs.secretAccessKey || inputs.secret;
        const baseUrl = `https://lightsail.${region}.amazonaws.com`;
        const svc = 'lightsail';

        const lightsailFetch = (target: string, body: Record<string, any>) =>
            awsFetch('POST', baseUrl + '/', region, svc, keyId, secret, JSON.stringify(body), {
                'X-Amz-Target': `Lightsail_20161128.${target}`,
            });

        switch (actionName) {
            case 'getInstances': {
                const body: Record<string, any> = {};
                if (inputs.pageToken) body.pageToken = inputs.pageToken;
                const res = await lightsailFetch('GetInstances', body);
                const data = await res.json();
                if (!res.ok) return { error: data.message || data.__type || 'GetInstances failed' };
                return { output: data };
            }
            case 'getInstance': {
                const res = await lightsailFetch('GetInstance', { instanceName: inputs.instanceName });
                const data = await res.json();
                if (!res.ok) return { error: data.message || data.__type || 'GetInstance failed' };
                return { output: data };
            }
            case 'createInstances': {
                const body: Record<string, any> = {
                    instanceNames: inputs.instanceNames || [inputs.instanceName],
                    availabilityZone: inputs.availabilityZone,
                    blueprintId: inputs.blueprintId,
                    bundleId: inputs.bundleId,
                };
                if (inputs.userData) body.userData = inputs.userData;
                if (inputs.keyPairName) body.keyPairName = inputs.keyPairName;
                const res = await lightsailFetch('CreateInstances', body);
                const data = await res.json();
                if (!res.ok) return { error: data.message || data.__type || 'CreateInstances failed' };
                return { output: data };
            }
            case 'deleteInstance': {
                const res = await lightsailFetch('DeleteInstance', {
                    instanceName: inputs.instanceName,
                    forceDeleteAddOns: inputs.forceDeleteAddOns || false,
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || data.__type || 'DeleteInstance failed' };
                return { output: { deleted: true, ...data } };
            }
            case 'rebootInstance': {
                const res = await lightsailFetch('RebootInstance', { instanceName: inputs.instanceName });
                const data = await res.json();
                if (!res.ok) return { error: data.message || data.__type || 'RebootInstance failed' };
                return { output: data };
            }
            case 'stopInstance': {
                const res = await lightsailFetch('StopInstance', {
                    instanceName: inputs.instanceName,
                    force: inputs.force || false,
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || data.__type || 'StopInstance failed' };
                return { output: data };
            }
            case 'startInstance': {
                const res = await lightsailFetch('StartInstance', { instanceName: inputs.instanceName });
                const data = await res.json();
                if (!res.ok) return { error: data.message || data.__type || 'StartInstance failed' };
                return { output: data };
            }
            case 'getInstanceState': {
                const res = await lightsailFetch('GetInstanceState', { instanceName: inputs.instanceName });
                const data = await res.json();
                if (!res.ok) return { error: data.message || data.__type || 'GetInstanceState failed' };
                return { output: data };
            }
            case 'createInstanceSnapshot': {
                const res = await lightsailFetch('CreateInstanceSnapshot', {
                    instanceName: inputs.instanceName,
                    instanceSnapshotName: inputs.snapshotName,
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || data.__type || 'CreateInstanceSnapshot failed' };
                return { output: data };
            }
            case 'getInstanceSnapshots': {
                const body: Record<string, any> = {};
                if (inputs.pageToken) body.pageToken = inputs.pageToken;
                const res = await lightsailFetch('GetInstanceSnapshots', body);
                const data = await res.json();
                if (!res.ok) return { error: data.message || data.__type || 'GetInstanceSnapshots failed' };
                return { output: data };
            }
            case 'getStaticIps': {
                const body: Record<string, any> = {};
                if (inputs.pageToken) body.pageToken = inputs.pageToken;
                const res = await lightsailFetch('GetStaticIps', body);
                const data = await res.json();
                if (!res.ok) return { error: data.message || data.__type || 'GetStaticIps failed' };
                return { output: data };
            }
            case 'allocateStaticIp': {
                const res = await lightsailFetch('AllocateStaticIp', { staticIpName: inputs.staticIpName });
                const data = await res.json();
                if (!res.ok) return { error: data.message || data.__type || 'AllocateStaticIp failed' };
                return { output: data };
            }
            case 'attachStaticIp': {
                const res = await lightsailFetch('AttachStaticIp', {
                    staticIpName: inputs.staticIpName,
                    instanceName: inputs.instanceName,
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || data.__type || 'AttachStaticIp failed' };
                return { output: data };
            }
            case 'getLoadBalancers': {
                const body: Record<string, any> = {};
                if (inputs.pageToken) body.pageToken = inputs.pageToken;
                const res = await lightsailFetch('GetLoadBalancers', body);
                const data = await res.json();
                if (!res.ok) return { error: data.message || data.__type || 'GetLoadBalancers failed' };
                return { output: data };
            }
            case 'createLoadBalancer': {
                const body: Record<string, any> = {
                    loadBalancerName: inputs.loadBalancerName,
                    instancePort: inputs.instancePort || 80,
                };
                if (inputs.healthCheckPath) body.healthCheckPath = inputs.healthCheckPath;
                if (inputs.certificateName) body.certificateName = inputs.certificateName;
                const res = await lightsailFetch('CreateLoadBalancer', body);
                const data = await res.json();
                if (!res.ok) return { error: data.message || data.__type || 'CreateLoadBalancer failed' };
                return { output: data };
            }
            default:
                return { error: `Unknown Lightsail action: ${actionName}` };
        }
    } catch (err: any) {
        return { error: err.message || 'Unexpected error in executeAwsLightsailAction' };
    }
}
