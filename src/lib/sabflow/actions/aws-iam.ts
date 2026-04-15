'use server';

import { createHmac, createHash } from 'crypto';

function sha256(d: string): string { return createHash('sha256').update(d).digest('hex'); }
function hmac(k: Buffer | string, d: string): Buffer { return createHmac('sha256', k).update(d).digest(); }
function signingKey(secret: string, date: string, region: string, svc: string): Buffer {
    return hmac(hmac(hmac(hmac('AWS4' + secret, date), region), svc), 'aws4_request');
}

// IAM uses form-encoded POST body with query-string style params
function iamFetch(keyId: string, secret: string, formBody: string) {
    const region = 'us-east-1'; // IAM is global
    const svc = 'iam';
    const url = 'https://iam.amazonaws.com/';
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

function buildForm(params: Record<string, string>): string {
    return Object.entries({ Version: '2010-05-08', ...params })
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join('&');
}

// Minimal XML value extractor
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

export async function executeAwsIamAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const accessKeyId = String(inputs.accessKeyId ?? '').trim();
        const secretAccessKey = String(inputs.secretAccessKey ?? '').trim();
        if (!accessKeyId || !secretAccessKey) throw new Error('accessKeyId and secretAccessKey are required.');

        const call = async (params: Record<string, string>) => {
            const form = buildForm(params);
            const res = await iamFetch(accessKeyId, secretAccessKey, form);
            const text = await res.text();
            if (!res.ok) {
                const msg = extractTag(text, 'Message') || extractTag(text, 'message') || text.slice(0, 300);
                throw new Error(msg);
            }
            return text;
        };

        switch (actionName) {
            case 'listUsers': {
                logger.log('[IAM] Listing users');
                const xml = await call({ Action: 'ListUsers', MaxItems: String(inputs.maxItems ?? '100') });
                const userNames = extractAll(xml, 'UserName');
                const userIds = extractAll(xml, 'UserId');
                const users = userNames.map((n, i) => ({ userName: n, userId: userIds[i] ?? '' }));
                return { output: { users, count: String(users.length) } };
            }
            case 'getUser': {
                const userName = String(inputs.userName ?? '').trim();
                logger.log(`[IAM] Getting user ${userName || '(caller)'}`);
                const params: Record<string, string> = { Action: 'GetUser' };
                if (userName) params.UserName = userName;
                const xml = await call(params);
                return { output: { userName: extractTag(xml, 'UserName'), userId: extractTag(xml, 'UserId'), arn: extractTag(xml, 'Arn') } };
            }
            case 'createUser': {
                const userName = String(inputs.userName ?? '').trim();
                if (!userName) throw new Error('userName is required.');
                logger.log(`[IAM] Creating user ${userName}`);
                const params: Record<string, string> = { Action: 'CreateUser', UserName: userName };
                if (inputs.path) params.Path = inputs.path;
                const xml = await call(params);
                return { output: { userName: extractTag(xml, 'UserName'), userId: extractTag(xml, 'UserId'), arn: extractTag(xml, 'Arn') } };
            }
            case 'deleteUser': {
                const userName = String(inputs.userName ?? '').trim();
                if (!userName) throw new Error('userName is required.');
                logger.log(`[IAM] Deleting user ${userName}`);
                await call({ Action: 'DeleteUser', UserName: userName });
                return { output: { deleted: 'true', userName } };
            }
            case 'listGroups': {
                logger.log('[IAM] Listing groups');
                const xml = await call({ Action: 'ListGroups', MaxItems: String(inputs.maxItems ?? '100') });
                const groupNames = extractAll(xml, 'GroupName');
                const groupIds = extractAll(xml, 'GroupId');
                const groups = groupNames.map((n, i) => ({ groupName: n, groupId: groupIds[i] ?? '' }));
                return { output: { groups, count: String(groups.length) } };
            }
            case 'createGroup': {
                const groupName = String(inputs.groupName ?? '').trim();
                if (!groupName) throw new Error('groupName is required.');
                logger.log(`[IAM] Creating group ${groupName}`);
                const params: Record<string, string> = { Action: 'CreateGroup', GroupName: groupName };
                if (inputs.path) params.Path = inputs.path;
                const xml = await call(params);
                return { output: { groupName: extractTag(xml, 'GroupName'), groupId: extractTag(xml, 'GroupId'), arn: extractTag(xml, 'Arn') } };
            }
            case 'listPolicies': {
                logger.log('[IAM] Listing policies');
                const params: Record<string, string> = { Action: 'ListPolicies', MaxItems: String(inputs.maxItems ?? '100') };
                if (inputs.scope) params.Scope = inputs.scope; // All | AWS | Local
                const xml = await call(params);
                const policyNames = extractAll(xml, 'PolicyName');
                const arns = extractAll(xml, 'Arn');
                const policies = policyNames.map((n, i) => ({ policyName: n, arn: arns[i] ?? '' }));
                return { output: { policies, count: String(policies.length) } };
            }
            case 'attachUserPolicy': {
                const userName = String(inputs.userName ?? '').trim();
                const policyArn = String(inputs.policyArn ?? '').trim();
                if (!userName || !policyArn) throw new Error('userName and policyArn are required.');
                logger.log(`[IAM] Attaching policy ${policyArn} to user ${userName}`);
                await call({ Action: 'AttachUserPolicy', UserName: userName, PolicyArn: policyArn });
                return { output: { attached: 'true', userName, policyArn } };
            }
            case 'detachUserPolicy': {
                const userName = String(inputs.userName ?? '').trim();
                const policyArn = String(inputs.policyArn ?? '').trim();
                if (!userName || !policyArn) throw new Error('userName and policyArn are required.');
                logger.log(`[IAM] Detaching policy ${policyArn} from user ${userName}`);
                await call({ Action: 'DetachUserPolicy', UserName: userName, PolicyArn: policyArn });
                return { output: { detached: 'true', userName, policyArn } };
            }
            case 'listRoles': {
                logger.log('[IAM] Listing roles');
                const xml = await call({ Action: 'ListRoles', MaxItems: String(inputs.maxItems ?? '100') });
                const roleNames = extractAll(xml, 'RoleName');
                const roleIds = extractAll(xml, 'RoleId');
                const roles = roleNames.map((n, i) => ({ roleName: n, roleId: roleIds[i] ?? '' }));
                return { output: { roles, count: String(roles.length) } };
            }
            case 'createRole': {
                const roleName = String(inputs.roleName ?? '').trim();
                const assumeRolePolicyDocument = String(inputs.assumeRolePolicyDocument ?? '').trim();
                if (!roleName || !assumeRolePolicyDocument) throw new Error('roleName and assumeRolePolicyDocument are required.');
                logger.log(`[IAM] Creating role ${roleName}`);
                const params: Record<string, string> = { Action: 'CreateRole', RoleName: roleName, AssumeRolePolicyDocument: assumeRolePolicyDocument };
                if (inputs.description) params.Description = inputs.description;
                const xml = await call(params);
                return { output: { roleName: extractTag(xml, 'RoleName'), roleId: extractTag(xml, 'RoleId'), arn: extractTag(xml, 'Arn') } };
            }
            case 'deleteRole': {
                const roleName = String(inputs.roleName ?? '').trim();
                if (!roleName) throw new Error('roleName is required.');
                logger.log(`[IAM] Deleting role ${roleName}`);
                await call({ Action: 'DeleteRole', RoleName: roleName });
                return { output: { deleted: 'true', roleName } };
            }
            case 'listAccessKeys': {
                const userName = String(inputs.userName ?? '').trim();
                logger.log(`[IAM] Listing access keys${userName ? ` for ${userName}` : ''}`);
                const params: Record<string, string> = { Action: 'ListAccessKeys' };
                if (userName) params.UserName = userName;
                const xml = await call(params);
                const keyIds = extractAll(xml, 'AccessKeyId');
                const statuses = extractAll(xml, 'Status');
                const keys = keyIds.map((id, i) => ({ accessKeyId: id, status: statuses[i] ?? '' }));
                return { output: { accessKeyMetadata: keys, count: String(keys.length) } };
            }
            case 'createAccessKey': {
                const userName = String(inputs.userName ?? '').trim();
                logger.log(`[IAM] Creating access key${userName ? ` for ${userName}` : ''}`);
                const params: Record<string, string> = { Action: 'CreateAccessKey' };
                if (userName) params.UserName = userName;
                const xml = await call(params);
                return { output: { accessKeyId: extractTag(xml, 'AccessKeyId'), secretAccessKey: extractTag(xml, 'SecretAccessKey'), status: extractTag(xml, 'Status') } };
            }
            case 'deleteAccessKey': {
                const accessKeyIdToDelete = String(inputs.accessKeyIdToDelete ?? inputs.deleteAccessKeyId ?? '').trim();
                if (!accessKeyIdToDelete) throw new Error('accessKeyIdToDelete is required.');
                logger.log(`[IAM] Deleting access key ${accessKeyIdToDelete}`);
                const params: Record<string, string> = { Action: 'DeleteAccessKey', AccessKeyId: accessKeyIdToDelete };
                if (inputs.userName) params.UserName = inputs.userName;
                await call(params);
                return { output: { deleted: 'true', accessKeyId: accessKeyIdToDelete } };
            }
            default:
                return { error: `AWS IAM action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'AWS IAM action failed.' };
    }
}
