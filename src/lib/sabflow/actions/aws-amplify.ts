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

export async function executeAwsAmplifyAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const region = inputs.region || 'us-east-1';
        const keyId = inputs.accessKeyId || inputs.key_id;
        const secret = inputs.secretAccessKey || inputs.secret;
        const svc = 'amplify';
        const base = `https://amplify.${region}.amazonaws.com`;

        const ampFetch = (method: string, path: string, body?: Record<string, any>) =>
            awsFetch(method, base + path, region, svc, keyId, secret, body ? JSON.stringify(body) : '');

        switch (actionName) {
            case 'listApps': {
                const qs = inputs.nextToken ? `?nextToken=${encodeURIComponent(inputs.nextToken)}` : '';
                const res = await ampFetch('GET', `/apps${qs}`);
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'listApps failed' };
                return { output: data };
            }
            case 'getApp': {
                const res = await ampFetch('GET', `/apps/${inputs.appId}`);
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'getApp failed' };
                return { output: data };
            }
            case 'createApp': {
                const body: Record<string, any> = { name: inputs.name };
                if (inputs.description) body.description = inputs.description;
                if (inputs.repository) body.repository = inputs.repository;
                if (inputs.platform) body.platform = inputs.platform;
                if (inputs.iamServiceRoleArn) body.iamServiceRoleArn = inputs.iamServiceRoleArn;
                if (inputs.oauthToken) body.oauthToken = inputs.oauthToken;
                if (inputs.environmentVariables) body.environmentVariables = inputs.environmentVariables;
                const res = await ampFetch('POST', '/apps', body);
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'createApp failed' };
                return { output: data };
            }
            case 'updateApp': {
                const body: Record<string, any> = {};
                if (inputs.name) body.name = inputs.name;
                if (inputs.description) body.description = inputs.description;
                if (inputs.platform) body.platform = inputs.platform;
                if (inputs.environmentVariables) body.environmentVariables = inputs.environmentVariables;
                const res = await ampFetch('POST', `/apps/${inputs.appId}`, body);
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'updateApp failed' };
                return { output: data };
            }
            case 'deleteApp': {
                const res = await ampFetch('DELETE', `/apps/${inputs.appId}`);
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'deleteApp failed' };
                return { output: { deleted: true, ...data } };
            }
            case 'listBranches': {
                const qs = inputs.nextToken ? `?nextToken=${encodeURIComponent(inputs.nextToken)}` : '';
                const res = await ampFetch('GET', `/apps/${inputs.appId}/branches${qs}`);
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'listBranches failed' };
                return { output: data };
            }
            case 'getBranch': {
                const res = await ampFetch('GET', `/apps/${inputs.appId}/branches/${encodeURIComponent(inputs.branchName)}`);
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'getBranch failed' };
                return { output: data };
            }
            case 'createBranch': {
                const body: Record<string, any> = { branchName: inputs.branchName };
                if (inputs.description) body.description = inputs.description;
                if (inputs.stage) body.stage = inputs.stage;
                if (inputs.environmentVariables) body.environmentVariables = inputs.environmentVariables;
                if (inputs.enableAutoBuild !== undefined) body.enableAutoBuild = inputs.enableAutoBuild;
                const res = await ampFetch('POST', `/apps/${inputs.appId}/branches`, body);
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'createBranch failed' };
                return { output: data };
            }
            case 'updateBranch': {
                const body: Record<string, any> = {};
                if (inputs.description) body.description = inputs.description;
                if (inputs.stage) body.stage = inputs.stage;
                if (inputs.environmentVariables) body.environmentVariables = inputs.environmentVariables;
                if (inputs.enableAutoBuild !== undefined) body.enableAutoBuild = inputs.enableAutoBuild;
                const res = await ampFetch('POST', `/apps/${inputs.appId}/branches/${encodeURIComponent(inputs.branchName)}`, body);
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'updateBranch failed' };
                return { output: data };
            }
            case 'deleteBranch': {
                const res = await ampFetch('DELETE', `/apps/${inputs.appId}/branches/${encodeURIComponent(inputs.branchName)}`);
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'deleteBranch failed' };
                return { output: { deleted: true, ...data } };
            }
            case 'listJobs': {
                const qs = inputs.nextToken ? `?nextToken=${encodeURIComponent(inputs.nextToken)}` : '';
                const res = await ampFetch('GET', `/apps/${inputs.appId}/branches/${encodeURIComponent(inputs.branchName)}/jobs${qs}`);
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'listJobs failed' };
                return { output: data };
            }
            case 'startJob': {
                const body: Record<string, any> = { jobType: inputs.jobType || 'RELEASE' };
                if (inputs.jobReason) body.jobReason = inputs.jobReason;
                if (inputs.commitId) body.commitId = inputs.commitId;
                if (inputs.commitMessage) body.commitMessage = inputs.commitMessage;
                const res = await ampFetch('POST', `/apps/${inputs.appId}/branches/${encodeURIComponent(inputs.branchName)}/jobs`, body);
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'startJob failed' };
                return { output: data };
            }
            case 'getJob': {
                const res = await ampFetch('GET', `/apps/${inputs.appId}/branches/${encodeURIComponent(inputs.branchName)}/jobs/${inputs.jobId}`);
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'getJob failed' };
                return { output: data };
            }
            case 'stopJob': {
                const res = await ampFetch('DELETE', `/apps/${inputs.appId}/branches/${encodeURIComponent(inputs.branchName)}/jobs/${inputs.jobId}`);
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'stopJob failed' };
                return { output: { stopped: true, ...data } };
            }
            case 'listDomainAssociations': {
                const qs = inputs.nextToken ? `?nextToken=${encodeURIComponent(inputs.nextToken)}` : '';
                const res = await ampFetch('GET', `/apps/${inputs.appId}/domains${qs}`);
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'listDomainAssociations failed' };
                return { output: data };
            }
            default:
                return { error: `Unknown Amplify action: ${actionName}` };
        }
    } catch (err: any) {
        return { error: err.message || 'Unexpected error in executeAwsAmplifyAction' };
    }
}
