'use server';

import { createHmac } from 'node:crypto';

function buildBaseUrl(accountId: string): string {
    const urlId = accountId.toLowerCase().replace(/_/g, '-');
    return `https://${urlId}.suitetalk.api.netsuite.com/services/rest/record/v1`;
}

function buildQueryBaseUrl(accountId: string): string {
    const urlId = accountId.toLowerCase().replace(/_/g, '-');
    return `https://${urlId}.suitetalk.api.netsuite.com/services/rest/query/v1`;
}

function buildOAuth1Header(
    method: string,
    url: string,
    accountId: string,
    consumerKey: string,
    consumerSecret: string,
    tokenId: string,
    tokenSecret: string
): string {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = Buffer.from(Math.random().toString(36) + Math.random().toString(36)).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 16);

    const oauthParams: Record<string, string> = {
        oauth_consumer_key: consumerKey,
        oauth_nonce: nonce,
        oauth_signature_method: 'HMAC-SHA256',
        oauth_timestamp: timestamp,
        oauth_token: tokenId,
        oauth_version: '1.0',
    };

    const sortedParams = Object.entries(oauthParams)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join('&');

    const baseString = [
        method.toUpperCase(),
        encodeURIComponent(url.split('?')[0]),
        encodeURIComponent(sortedParams),
    ].join('&');

    const signingKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(tokenSecret)}`;
    const signature = createHmac('sha256', signingKey).update(baseString).digest('base64');

    oauthParams.oauth_signature = signature;
    oauthParams.realm = accountId.toUpperCase();

    const headerValue = 'OAuth ' + Object.entries(oauthParams)
        .map(([k, v]) => `${k}="${encodeURIComponent(v)}"`)
        .join(', ');

    return headerValue;
}

function resolveAuth(inputs: any, method: string, url: string): string {
    if (inputs.authorizationHeader) return inputs.authorizationHeader;
    if (inputs.bearerToken) return `Bearer ${inputs.bearerToken}`;
    const { accountId, consumerKey, consumerSecret, tokenId, tokenSecret } = inputs;
    if (accountId && consumerKey && consumerSecret && tokenId && tokenSecret) {
        return buildOAuth1Header(method, url, accountId, consumerKey, consumerSecret, tokenId, tokenSecret);
    }
    throw new Error('NetSuite auth: provide bearerToken, authorizationHeader, or OAuth1 credentials (accountId, consumerKey, consumerSecret, tokenId, tokenSecret).');
}

async function nsRequest(method: string, url: string, authHeader: string, body?: any, queryParams?: Record<string, string>): Promise<any> {
    const reqUrl = new URL(url);
    if (queryParams) {
        for (const [k, v] of Object.entries(queryParams)) reqUrl.searchParams.set(k, v);
    }
    const res = await fetch(reqUrl.toString(), {
        method,
        headers: {
            Authorization: authHeader,
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Prefer: 'transient',
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (res.status === 204) return { success: true };
    const text = await res.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
    if (!res.ok) {
        throw new Error(data?.['o:errorDetails']?.[0]?.detail ?? data?.message ?? `NetSuite API error ${res.status}`);
    }
    return data;
}

export async function executeNetSuiteAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        if (!inputs.accountId && !inputs.authorizationHeader && !inputs.bearerToken) {
            return { error: 'Missing required input: accountId (or authorizationHeader / bearerToken)' };
        }
        const baseUrl = inputs.baseUrl ?? buildBaseUrl(inputs.accountId);
        const queryBaseUrl = buildQueryBaseUrl(inputs.accountId ?? 'account');
        logger.log(`Executing NetSuite action: ${actionName}`);

        switch (actionName) {

            case 'listRecords': {
                if (!inputs.recordType) return { error: 'Missing required input: recordType' };
                const url = `${baseUrl}/${inputs.recordType}`;
                const auth = resolveAuth(inputs, 'GET', url);
                const params: Record<string, string> = {};
                if (inputs.limit) params.limit = String(inputs.limit);
                if (inputs.offset) params.offset = String(inputs.offset);
                if (inputs.fields) params.fields = inputs.fields;
                if (inputs.expandSubResources) params.expandSubResources = 'true';
                const data = await nsRequest('GET', url, auth, undefined, params);
                return { output: { records: data.items ?? data.list ?? data, totalResults: data.totalResults, count: data.count } };
            }

            case 'getRecord': {
                if (!inputs.recordType) return { error: 'Missing required input: recordType' };
                if (!inputs.recordId) return { error: 'Missing required input: recordId' };
                const url = `${baseUrl}/${inputs.recordType}/${inputs.recordId}`;
                const auth = resolveAuth(inputs, 'GET', url);
                const params: Record<string, string> = {};
                if (inputs.expandSubResources) params.expandSubResources = 'true';
                if (inputs.fields) params.fields = inputs.fields;
                const data = await nsRequest('GET', url, auth, undefined, params);
                return { output: { record: data } };
            }

            case 'createRecord': {
                if (!inputs.recordType) return { error: 'Missing required input: recordType' };
                if (!inputs.data) return { error: 'Missing required input: data (record fields object)' };
                const url = `${baseUrl}/${inputs.recordType}`;
                const auth = resolveAuth(inputs, 'POST', url);
                const data = await nsRequest('POST', url, auth, inputs.data);
                return { output: { created: true, recordType: inputs.recordType, record: data } };
            }

            case 'updateRecord': {
                if (!inputs.recordType) return { error: 'Missing required input: recordType' };
                if (!inputs.recordId) return { error: 'Missing required input: recordId' };
                if (!inputs.data) return { error: 'Missing required input: data' };
                const url = `${baseUrl}/${inputs.recordType}/${inputs.recordId}`;
                const auth = resolveAuth(inputs, 'PATCH', url);
                const data = await nsRequest('PATCH', url, auth, inputs.data);
                return { output: { updated: true, recordId: inputs.recordId, result: data } };
            }

            case 'deleteRecord': {
                if (!inputs.recordType) return { error: 'Missing required input: recordType' };
                if (!inputs.recordId) return { error: 'Missing required input: recordId' };
                const url = `${baseUrl}/${inputs.recordType}/${inputs.recordId}`;
                const auth = resolveAuth(inputs, 'DELETE', url);
                await nsRequest('DELETE', url, auth);
                return { output: { deleted: true, recordType: inputs.recordType, recordId: inputs.recordId } };
            }

            case 'searchRecords': {
                if (!inputs.recordType) return { error: 'Missing required input: recordType' };
                if (!inputs.q) return { error: 'Missing required input: q (search query)' };
                const url = `${baseUrl}/${inputs.recordType}`;
                const auth = resolveAuth(inputs, 'GET', url);
                const params: Record<string, string> = { q: inputs.q };
                if (inputs.limit) params.limit = String(inputs.limit);
                if (inputs.offset) params.offset = String(inputs.offset);
                if (inputs.fields) params.fields = inputs.fields;
                const data = await nsRequest('GET', url, auth, undefined, params);
                return { output: { records: data.items ?? data.list ?? data, totalResults: data.totalResults } };
            }

            case 'listSalesOrders': {
                const url = `${baseUrl}/salesorder`;
                const auth = resolveAuth(inputs, 'GET', url);
                const params: Record<string, string> = {};
                if (inputs.limit) params.limit = String(inputs.limit);
                if (inputs.offset) params.offset = String(inputs.offset);
                if (inputs.status) params.q = `status IS ${inputs.status}`;
                const data = await nsRequest('GET', url, auth, undefined, params);
                return { output: { salesOrders: data.items ?? data, totalResults: data.totalResults } };
            }

            case 'getSalesOrder': {
                if (!inputs.orderId) return { error: 'Missing required input: orderId' };
                const url = `${baseUrl}/salesorder/${inputs.orderId}`;
                const auth = resolveAuth(inputs, 'GET', url);
                const data = await nsRequest('GET', url, auth, undefined, { expandSubResources: 'true' });
                return { output: { salesOrder: data } };
            }

            case 'createSalesOrder': {
                if (!inputs.data) return { error: 'Missing required input: data (sales order fields)' };
                const url = `${baseUrl}/salesorder`;
                const auth = resolveAuth(inputs, 'POST', url);
                const data = await nsRequest('POST', url, auth, inputs.data);
                return { output: { created: true, salesOrder: data } };
            }

            case 'listCustomers': {
                const url = `${baseUrl}/customer`;
                const auth = resolveAuth(inputs, 'GET', url);
                const params: Record<string, string> = {};
                if (inputs.limit) params.limit = String(inputs.limit);
                if (inputs.offset) params.offset = String(inputs.offset);
                if (inputs.q) params.q = inputs.q;
                const data = await nsRequest('GET', url, auth, undefined, params);
                return { output: { customers: data.items ?? data, totalResults: data.totalResults } };
            }

            case 'getCustomer': {
                if (!inputs.customerId) return { error: 'Missing required input: customerId' };
                const url = `${baseUrl}/customer/${inputs.customerId}`;
                const auth = resolveAuth(inputs, 'GET', url);
                const data = await nsRequest('GET', url, auth);
                return { output: { customer: data } };
            }

            case 'createCustomer': {
                if (!inputs.data) return { error: 'Missing required input: data (customer fields)' };
                const url = `${baseUrl}/customer`;
                const auth = resolveAuth(inputs, 'POST', url);
                const data = await nsRequest('POST', url, auth, inputs.data);
                return { output: { created: true, customer: data } };
            }

            case 'listInventoryItems': {
                const url = `${baseUrl}/inventoryitem`;
                const auth = resolveAuth(inputs, 'GET', url);
                const params: Record<string, string> = {};
                if (inputs.limit) params.limit = String(inputs.limit);
                if (inputs.offset) params.offset = String(inputs.offset);
                if (inputs.q) params.q = inputs.q;
                const data = await nsRequest('GET', url, auth, undefined, params);
                return { output: { inventoryItems: data.items ?? data, totalResults: data.totalResults } };
            }

            case 'listPurchaseOrders': {
                const url = `${baseUrl}/purchaseorder`;
                const auth = resolveAuth(inputs, 'GET', url);
                const params: Record<string, string> = {};
                if (inputs.limit) params.limit = String(inputs.limit);
                if (inputs.offset) params.offset = String(inputs.offset);
                if (inputs.status) params.q = `status IS ${inputs.status}`;
                const data = await nsRequest('GET', url, auth, undefined, params);
                return { output: { purchaseOrders: data.items ?? data, totalResults: data.totalResults } };
            }

            case 'runSavedSearch': {
                if (!inputs.query) return { error: 'Missing required input: query (SuiteQL SELECT statement)' };
                const url = `${queryBaseUrl}/suiteql`;
                const auth = resolveAuth(inputs, 'POST', url);
                const params: Record<string, string> = {};
                if (inputs.limit) params.limit = String(inputs.limit);
                if (inputs.offset) params.offset = String(inputs.offset);
                const data = await nsRequest('POST', url, auth, { q: inputs.query }, params);
                return { output: { results: data.items ?? data, totalResults: data.totalResults, hasMore: data.hasMore } };
            }

            default:
                return { error: `NetSuite action "${actionName}" is not implemented.` };
        }
    } catch (err: any) {
        logger.log(`NetSuite action error [${actionName}]: ${err?.message}`);
        return { error: err?.message ?? 'Unknown NetSuite error' };
    }
}
