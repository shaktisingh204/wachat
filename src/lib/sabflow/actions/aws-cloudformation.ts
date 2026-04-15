'use server';

import { createHmac, createHash } from 'crypto';

function sha256(d: string): string { return createHash('sha256').update(d).digest('hex'); }
function hmac(k: Buffer | string, d: string): Buffer { return createHmac('sha256', k).update(d).digest(); }
function signingKey(secret: string, date: string, region: string, svc: string): Buffer {
    return hmac(hmac(hmac(hmac('AWS4' + secret, date), region), svc), 'aws4_request');
}

function cfnFetch(region: string, keyId: string, secret: string, formBody: string) {
    const svc = 'cloudformation';
    const url = `https://cloudformation.${region}.amazonaws.com/`;
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '').slice(0, 15) + 'Z';
    const ds = amzDate.slice(0, 8);
    const u = new URL(url);
    const allHeaders: Record<string, string> = {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Amz-Date': amzDate,
        'Host': u.host,
    };
    const sh = Object.keys(allHeaders).map(k => k.toLowerCase()).sort().join(';');
    const ch = Object.entries(allHeaders).map(([k, v]) => `${k.toLowerCase()}:${v}\n`).sort().join('');
    const cr = ['POST', '/', '', ch, sh, sha256(formBody)].join('\n');
    const scope = `${ds}/${region}/${svc}/aws4_request`;
    const sts = `AWS4-HMAC-SHA256\n${amzDate}\n${scope}\n${sha256(cr)}`;
    const sig = hmac(signingKey(secret, ds, region, svc), sts).toString('hex');
    allHeaders['Authorization'] = `AWS4-HMAC-SHA256 Credential=${keyId}/${scope},SignedHeaders=${sh},Signature=${sig}`;
    return fetch(url, { method: 'POST', headers: allHeaders, body: formBody });
}

function buildForm(params: Record<string, string | undefined>): string {
    const filtered = Object.entries(params).filter(([, v]) => v !== undefined) as [string, string][];
    return filtered.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
}

function extractTag(xml: string, tag: string): string {
    const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
    return m ? m[1].trim() : '';
}

function extractAll(xml: string, tag: string): string[] {
    const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'g');
    const results: string[] = [];
    let m;
    while ((m = re.exec(xml)) !== null) results.push(m[1].trim());
    return results;
}

function xmlToJson(xml: string): any {
    // Simple heuristic: return raw xml with key fields extracted
    return { raw: xml };
}

export async function executeAwsCloudFormationAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const region = inputs.region || 'us-east-1';
        const keyId = inputs.accessKeyId || inputs.key_id;
        const secret = inputs.secretAccessKey || inputs.secret;
        const VERSION = '2010-05-15';

        const call = async (action: string, extra: Record<string, string | undefined> = {}) => {
            const form = buildForm({ Action: action, Version: VERSION, ...extra });
            const res = await cfnFetch(region, keyId, secret, form);
            const text = await res.text();
            if (!res.ok) {
                const msg = extractTag(text, 'Message') || extractTag(text, 'message') || text;
                return { error: msg };
            }
            return { output: { raw: text } };
        };

        switch (actionName) {
            case 'listStacks': {
                const params: Record<string, string | undefined> = {};
                if (inputs.stackStatusFilter) params['StackStatusFilter.member.1'] = inputs.stackStatusFilter;
                if (inputs.nextToken) params.NextToken = inputs.nextToken;
                return await call('ListStacks', params);
            }
            case 'describeStacks': {
                return await call('DescribeStacks', inputs.stackName ? { StackName: inputs.stackName } : {});
            }
            case 'createStack': {
                const params: Record<string, string | undefined> = {
                    StackName: inputs.stackName,
                };
                if (inputs.templateBody) params.TemplateBody = inputs.templateBody;
                if (inputs.templateUrl) params.TemplateURL = inputs.templateUrl;
                if (inputs.capabilities) params['Capabilities.member.1'] = inputs.capabilities;
                if (inputs.onFailure) params.OnFailure = inputs.onFailure;
                return await call('CreateStack', params);
            }
            case 'updateStack': {
                const params: Record<string, string | undefined> = {
                    StackName: inputs.stackName,
                };
                if (inputs.templateBody) params.TemplateBody = inputs.templateBody;
                if (inputs.templateUrl) params.TemplateURL = inputs.templateUrl;
                if (inputs.usePreviousTemplate) params.UsePreviousTemplate = 'true';
                return await call('UpdateStack', params);
            }
            case 'deleteStack': {
                return await call('DeleteStack', { StackName: inputs.stackName });
            }
            case 'describeStackResources': {
                return await call('DescribeStackResources', { StackName: inputs.stackName });
            }
            case 'getTemplate': {
                const params: Record<string, string | undefined> = { StackName: inputs.stackName };
                if (inputs.templateStage) params.TemplateStage = inputs.templateStage;
                return await call('GetTemplate', params);
            }
            case 'validateTemplate': {
                const params: Record<string, string | undefined> = {};
                if (inputs.templateBody) params.TemplateBody = inputs.templateBody;
                if (inputs.templateUrl) params.TemplateURL = inputs.templateUrl;
                return await call('ValidateTemplate', params);
            }
            case 'listStackResources': {
                const params: Record<string, string | undefined> = { StackName: inputs.stackName };
                if (inputs.nextToken) params.NextToken = inputs.nextToken;
                return await call('ListStackResources', params);
            }
            case 'describeStackEvents': {
                const params: Record<string, string | undefined> = { StackName: inputs.stackName };
                if (inputs.nextToken) params.NextToken = inputs.nextToken;
                return await call('DescribeStackEvents', params);
            }
            case 'estimateTemplateCost': {
                const params: Record<string, string | undefined> = {};
                if (inputs.templateBody) params.TemplateBody = inputs.templateBody;
                if (inputs.templateUrl) params.TemplateURL = inputs.templateUrl;
                return await call('EstimateTemplateCost', params);
            }
            case 'listChangeSets': {
                const params: Record<string, string | undefined> = { StackName: inputs.stackName };
                if (inputs.nextToken) params.NextToken = inputs.nextToken;
                return await call('ListChangeSets', params);
            }
            case 'createChangeSet': {
                const params: Record<string, string | undefined> = {
                    StackName: inputs.stackName,
                    ChangeSetName: inputs.changeSetName,
                    ChangeSetType: inputs.changeSetType || 'UPDATE',
                };
                if (inputs.templateBody) params.TemplateBody = inputs.templateBody;
                if (inputs.templateUrl) params.TemplateURL = inputs.templateUrl;
                return await call('CreateChangeSet', params);
            }
            case 'describeChangeSet': {
                return await call('DescribeChangeSet', {
                    StackName: inputs.stackName,
                    ChangeSetName: inputs.changeSetName,
                });
            }
            case 'executeChangeSet': {
                return await call('ExecuteChangeSet', {
                    StackName: inputs.stackName,
                    ChangeSetName: inputs.changeSetName,
                });
            }
            default:
                return { error: `Unknown CloudFormation action: ${actionName}` };
        }
    } catch (err: any) {
        return { error: err.message || 'Unexpected error in executeAwsCloudFormationAction' };
    }
}
