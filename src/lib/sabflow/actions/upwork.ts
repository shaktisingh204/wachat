'use server';

import * as crypto from 'crypto';

function buildOAuth1Header(
    method: string,
    url: string,
    consumerKey: string,
    consumerSecret: string,
    token: string,
    tokenSecret: string,
    extraParams: Record<string, string> = {}
): string {
    const oauthParams: Record<string, string> = {
        oauth_consumer_key: consumerKey,
        oauth_nonce: Buffer.from(crypto.randomBytes(16)).toString('base64').replace(/[^a-zA-Z0-9]/g, ''),
        oauth_signature_method: 'HMAC-SHA1',
        oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
        oauth_token: token,
        oauth_version: '1.0',
        ...extraParams,
    };

    const allParams = { ...oauthParams };
    const sortedKeys = Object.keys(allParams).sort();
    const paramString = sortedKeys
        .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(allParams[k])}`)
        .join('&');

    const baseString = [
        method.toUpperCase(),
        encodeURIComponent(url),
        encodeURIComponent(paramString),
    ].join('&');

    const signingKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(tokenSecret)}`;
    const signature = crypto
        .createHmac('sha1', signingKey)
        .update(baseString)
        .digest('base64');

    oauthParams['oauth_signature'] = signature;

    const authHeader =
        'OAuth ' +
        Object.keys(oauthParams)
            .sort()
            .map(k => `${encodeURIComponent(k)}="${encodeURIComponent(oauthParams[k])}"`)
            .join(', ');

    return authHeader;
}

export async function executeUpworkAction(actionName: string, inputs: any, user: any, logger: any) {
    const consumerKey = inputs.consumerKey;
    const consumerSecret = inputs.consumerSecret;
    const token = inputs.token;
    const tokenSecret = inputs.tokenSecret;
    const baseUrl = 'https://api.upwork.com/api';

    async function apiRequest(method: string, path: string, body?: any) {
        const url = `${baseUrl}${path}`;
        const authHeader = buildOAuth1Header(method, url, consumerKey, consumerSecret, token, tokenSecret);
        const fetchOptions: RequestInit = {
            method,
            headers: {
                'Authorization': authHeader,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
        };
        if (body) {
            fetchOptions.body = JSON.stringify(body);
        }
        const res = await fetch(url, fetchOptions);
        const data = await res.json();
        if (!res.ok) return { error: data.error?.message || data.message || `HTTP ${res.status}`, _data: data };
        return { output: data };
    }

    try {
        switch (actionName) {
            case 'getProfile': {
                const username = inputs.username || 'me';
                const result = await apiRequest('GET', `/profiles/v1/contractors/${username}`);
                return result.error ? { error: result.error } : { output: result.output };
            }
            case 'searchJobs': {
                const params = new URLSearchParams();
                if (inputs.q) params.set('q', inputs.q);
                if (inputs.category2) params.set('category2', inputs.category2);
                if (inputs.budget) params.set('budget', inputs.budget);
                if (inputs.paging) params.set('paging', inputs.paging);
                const result = await apiRequest('GET', `/jobs/v1/search/jobs?${params}`);
                return result.error ? { error: result.error } : { output: result.output };
            }
            case 'getJob': {
                const jobId = inputs.jobId;
                const result = await apiRequest('GET', `/jobs/v1/search/jobs/${jobId}`);
                return result.error ? { error: result.error } : { output: result.output };
            }
            case 'submitProposal': {
                const jobId = inputs.jobId;
                const result = await apiRequest('POST', `/hr/v2/proposals/${jobId}`, inputs.proposal || {});
                return result.error ? { error: result.error } : { output: result.output };
            }
            case 'listProposals': {
                const params = new URLSearchParams();
                if (inputs.status) params.set('status', inputs.status);
                if (inputs.paging) params.set('paging', inputs.paging);
                const result = await apiRequest('GET', `/hr/v2/proposals?${params}`);
                return result.error ? { error: result.error } : { output: result.output };
            }
            case 'getProposal': {
                const proposalId = inputs.proposalId;
                const result = await apiRequest('GET', `/hr/v2/proposals/${proposalId}`);
                return result.error ? { error: result.error } : { output: result.output };
            }
            case 'listContracts': {
                const params = new URLSearchParams();
                if (inputs.status) params.set('status', inputs.status);
                if (inputs.paging) params.set('paging', inputs.paging);
                const result = await apiRequest('GET', `/hr/v2/contracts?${params}`);
                return result.error ? { error: result.error } : { output: result.output };
            }
            case 'getContract': {
                const contractId = inputs.contractId;
                const result = await apiRequest('GET', `/hr/v2/contracts/${contractId}`);
                return result.error ? { error: result.error } : { output: result.output };
            }
            case 'listTransactions': {
                const accountId = inputs.accountId;
                const params = new URLSearchParams();
                if (inputs.paging) params.set('paging', inputs.paging);
                if (inputs.fromDate) params.set('from_date', inputs.fromDate);
                if (inputs.toDate) params.set('to_date', inputs.toDate);
                const result = await apiRequest('GET', `/reports/v1/finance/accounts/${accountId}/transactions?${params}`);
                return result.error ? { error: result.error } : { output: result.output };
            }
            case 'getTransaction': {
                const accountId = inputs.accountId;
                const transactionId = inputs.transactionId;
                const result = await apiRequest('GET', `/reports/v1/finance/accounts/${accountId}/transactions/${transactionId}`);
                return result.error ? { error: result.error } : { output: result.output };
            }
            case 'searchFreelancers': {
                const params = new URLSearchParams();
                if (inputs.q) params.set('q', inputs.q);
                if (inputs.skills) params.set('skills', inputs.skills);
                if (inputs.paging) params.set('paging', inputs.paging);
                const result = await apiRequest('GET', `/profiles/v2/search/contractors?${params}`);
                return result.error ? { error: result.error } : { output: result.output };
            }
            case 'getFreelancer': {
                const profileKey = inputs.profileKey;
                const result = await apiRequest('GET', `/profiles/v1/contractors/${profileKey}`);
                return result.error ? { error: result.error } : { output: result.output };
            }
            case 'sendMessage': {
                const roomId = inputs.roomId;
                const result = await apiRequest('POST', `/messages/v3/${roomId}/messages`, inputs.message || {});
                return result.error ? { error: result.error } : { output: result.output };
            }
            case 'listMessages': {
                const roomId = inputs.roomId;
                const params = new URLSearchParams();
                if (inputs.paging) params.set('paging', inputs.paging);
                const result = await apiRequest('GET', `/messages/v3/${roomId}/messages?${params}`);
                return result.error ? { error: result.error } : { output: result.output };
            }
            case 'getEngagement': {
                const engagementId = inputs.engagementId;
                const result = await apiRequest('GET', `/hr/v2/engagements/${engagementId}`);
                return result.error ? { error: result.error } : { output: result.output };
            }
            default:
                return { error: `Unknown Upwork action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Upwork action error: ${err.message}`);
        return { error: err.message || 'Unexpected error in Upwork action' };
    }
}
