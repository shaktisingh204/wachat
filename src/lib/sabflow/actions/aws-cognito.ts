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

export async function executeAwsCognitoAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const region = inputs.region || 'us-east-1';
        const keyId = inputs.accessKeyId || inputs.key_id;
        const secret = inputs.secretAccessKey || inputs.secret;
        const baseUrl = `https://cognito-idp.${region}.amazonaws.com`;
        const svc = 'cognito-idp';

        const cognitoFetch = (target: string, body: Record<string, any>) =>
            awsFetch('POST', baseUrl + '/', region, svc, keyId, secret, JSON.stringify(body), {
                'X-Amz-Target': `AmazonCognitoIdentityProvider.${target}`,
            });

        switch (actionName) {
            case 'signUp': {
                const res = await cognitoFetch('SignUp', {
                    ClientId: inputs.clientId,
                    Username: inputs.username,
                    Password: inputs.password,
                    UserAttributes: inputs.userAttributes || [],
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || data.__type || 'SignUp failed' };
                return { output: data };
            }
            case 'confirmSignUp': {
                const res = await cognitoFetch('ConfirmSignUp', {
                    ClientId: inputs.clientId,
                    Username: inputs.username,
                    ConfirmationCode: inputs.confirmationCode,
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || data.__type || 'ConfirmSignUp failed' };
                return { output: { confirmed: true, ...data } };
            }
            case 'initiateAuth': {
                const res = await cognitoFetch('InitiateAuth', {
                    ClientId: inputs.clientId,
                    AuthFlow: inputs.authFlow || 'USER_PASSWORD_AUTH',
                    AuthParameters: inputs.authParameters || {
                        USERNAME: inputs.username,
                        PASSWORD: inputs.password,
                    },
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || data.__type || 'InitiateAuth failed' };
                return { output: data };
            }
            case 'respondToAuthChallenge': {
                const res = await cognitoFetch('RespondToAuthChallenge', {
                    ClientId: inputs.clientId,
                    ChallengeName: inputs.challengeName,
                    Session: inputs.session,
                    ChallengeResponses: inputs.challengeResponses || {},
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || data.__type || 'RespondToAuthChallenge failed' };
                return { output: data };
            }
            case 'listUsers': {
                const body: Record<string, any> = { UserPoolId: inputs.userPoolId };
                if (inputs.filter) body.Filter = inputs.filter;
                if (inputs.limit) body.Limit = inputs.limit;
                if (inputs.paginationToken) body.PaginationToken = inputs.paginationToken;
                const res = await cognitoFetch('ListUsers', body);
                const data = await res.json();
                if (!res.ok) return { error: data.message || data.__type || 'ListUsers failed' };
                return { output: data };
            }
            case 'getUser': {
                const res = await cognitoFetch('GetUser', { AccessToken: inputs.accessToken });
                const data = await res.json();
                if (!res.ok) return { error: data.message || data.__type || 'GetUser failed' };
                return { output: data };
            }
            case 'adminGetUser': {
                const res = await cognitoFetch('AdminGetUser', {
                    UserPoolId: inputs.userPoolId,
                    Username: inputs.username,
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || data.__type || 'AdminGetUser failed' };
                return { output: data };
            }
            case 'adminCreateUser': {
                const body: Record<string, any> = {
                    UserPoolId: inputs.userPoolId,
                    Username: inputs.username,
                };
                if (inputs.temporaryPassword) body.TemporaryPassword = inputs.temporaryPassword;
                if (inputs.userAttributes) body.UserAttributes = inputs.userAttributes;
                if (inputs.messageAction) body.MessageAction = inputs.messageAction;
                const res = await cognitoFetch('AdminCreateUser', body);
                const data = await res.json();
                if (!res.ok) return { error: data.message || data.__type || 'AdminCreateUser failed' };
                return { output: data };
            }
            case 'adminDeleteUser': {
                const res = await cognitoFetch('AdminDeleteUser', {
                    UserPoolId: inputs.userPoolId,
                    Username: inputs.username,
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || data.__type || 'AdminDeleteUser failed' };
                return { output: { deleted: true, username: inputs.username } };
            }
            case 'adminUpdateUserAttributes': {
                const res = await cognitoFetch('AdminUpdateUserAttributes', {
                    UserPoolId: inputs.userPoolId,
                    Username: inputs.username,
                    UserAttributes: inputs.userAttributes || [],
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || data.__type || 'AdminUpdateUserAttributes failed' };
                return { output: { updated: true, ...data } };
            }
            case 'adminSetUserPassword': {
                const res = await cognitoFetch('AdminSetUserPassword', {
                    UserPoolId: inputs.userPoolId,
                    Username: inputs.username,
                    Password: inputs.password,
                    Permanent: inputs.permanent !== false,
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || data.__type || 'AdminSetUserPassword failed' };
                return { output: { passwordSet: true, ...data } };
            }
            case 'listUserPools': {
                const res = await cognitoFetch('ListUserPools', {
                    MaxResults: inputs.maxResults || 10,
                    NextToken: inputs.nextToken,
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || data.__type || 'ListUserPools failed' };
                return { output: data };
            }
            case 'getUserPool': {
                const res = await cognitoFetch('DescribeUserPool', { UserPoolId: inputs.userPoolId });
                const data = await res.json();
                if (!res.ok) return { error: data.message || data.__type || 'DescribeUserPool failed' };
                return { output: data };
            }
            case 'createUserPool': {
                const body: Record<string, any> = { PoolName: inputs.poolName };
                if (inputs.policies) body.Policies = inputs.policies;
                if (inputs.autoVerifiedAttributes) body.AutoVerifiedAttributes = inputs.autoVerifiedAttributes;
                if (inputs.schema) body.Schema = inputs.schema;
                const res = await cognitoFetch('CreateUserPool', body);
                const data = await res.json();
                if (!res.ok) return { error: data.message || data.__type || 'CreateUserPool failed' };
                return { output: data };
            }
            case 'deleteUserPool': {
                const res = await cognitoFetch('DeleteUserPool', { UserPoolId: inputs.userPoolId });
                const data = await res.json();
                if (!res.ok) return { error: data.message || data.__type || 'DeleteUserPool failed' };
                return { output: { deleted: true, userPoolId: inputs.userPoolId } };
            }
            default:
                return { error: `Unknown Cognito action: ${actionName}` };
        }
    } catch (err: any) {
        return { error: err.message || 'Unexpected error in executeAwsCognitoAction' };
    }
}
