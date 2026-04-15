'use server';

import crypto from 'crypto';

function buildEdgeGridAuthHeader(
    method: string,
    url: string,
    body: string,
    clientToken: string,
    clientSecret: string,
    accessToken: string,
): string {
    const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z').slice(0, 15) + '+0000';
    const nonce = crypto.randomUUID().replace(/-/g, '');
    const authHeader = `EG1-HMAC-SHA256 client_token=${clientToken};access_token=${accessToken};timestamp=${timestamp};nonce=${nonce};`;

    const parsedUrl = new URL(url);
    const contentHash = body
        ? crypto.createHash('sha256').update(body).digest('base64')
        : '';
    const dataToSign = [
        method.toUpperCase(),
        parsedUrl.protocol.replace(':', ''),
        parsedUrl.host,
        parsedUrl.pathname + (parsedUrl.search || ''),
        '', // canonicalized request headers (empty)
        contentHash,
        authHeader,
    ].join('\t');

    const signingKey = crypto
        .createHmac('sha256', clientSecret)
        .update(timestamp)
        .digest('base64');

    const signature = crypto
        .createHmac('sha256', signingKey)
        .update(dataToSign)
        .digest('base64');

    return `${authHeader}signature=${signature}`;
}

async function akamaiRequest(method: string, url: string, inputs: any, body?: any): Promise<any> {
    const { clientToken, clientSecret, accessToken } = inputs;
    const bodyStr = body ? JSON.stringify(body) : '';
    const authHeader = buildEdgeGridAuthHeader(method, url, bodyStr, clientToken, clientSecret, accessToken);
    const headers: Record<string, string> = {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
    };
    const res = await fetch(url, {
        method,
        headers,
        body: bodyStr || undefined,
    });
    if (res.status === 204) return { success: true };
    return res.json();
}

export async function executeAkamaiAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const { clientToken, clientSecret, accessToken, host } = inputs;
        if (!clientToken || !clientSecret || !accessToken || !host) {
            return { error: 'Missing required Akamai credentials: clientToken, clientSecret, accessToken, host' };
        }

        const baseUrl = `https://${host}`;

        switch (actionName) {
            case 'listProperties': {
                const contractId = inputs.contractId || '';
                const groupId = inputs.groupId || '';
                const url = `${baseUrl}/papi/v1/properties?contractId=${contractId}&groupId=${groupId}`;
                const data = await akamaiRequest('GET', url, inputs);
                return { output: data };
            }
            case 'getProperty': {
                if (!inputs.propertyId) return { error: 'Missing propertyId' };
                const url = `${baseUrl}/papi/v1/properties/${inputs.propertyId}?contractId=${inputs.contractId || ''}&groupId=${inputs.groupId || ''}`;
                const data = await akamaiRequest('GET', url, inputs);
                return { output: data };
            }
            case 'createProperty': {
                if (!inputs.propertyName) return { error: 'Missing propertyName' };
                const url = `${baseUrl}/papi/v1/properties?contractId=${inputs.contractId || ''}&groupId=${inputs.groupId || ''}`;
                const body = {
                    propertyName: inputs.propertyName,
                    productId: inputs.productId || 'prd_SPM',
                    ruleFormat: inputs.ruleFormat || 'latest',
                };
                const data = await akamaiRequest('POST', url, inputs, body);
                return { output: data };
            }
            case 'updateProperty': {
                if (!inputs.propertyId) return { error: 'Missing propertyId' };
                const url = `${baseUrl}/papi/v1/properties/${inputs.propertyId}/versions/${inputs.propertyVersion || '1'}/rules?contractId=${inputs.contractId || ''}&groupId=${inputs.groupId || ''}`;
                const data = await akamaiRequest('PUT', url, inputs, inputs.rules || {});
                return { output: data };
            }
            case 'deleteProperty': {
                if (!inputs.propertyId) return { error: 'Missing propertyId' };
                const url = `${baseUrl}/papi/v1/properties/${inputs.propertyId}?contractId=${inputs.contractId || ''}&groupId=${inputs.groupId || ''}`;
                const data = await akamaiRequest('DELETE', url, inputs);
                return { output: data };
            }
            case 'activateProperty': {
                if (!inputs.propertyId || !inputs.propertyVersion) return { error: 'Missing propertyId or propertyVersion' };
                const url = `${baseUrl}/papi/v1/properties/${inputs.propertyId}/activations?contractId=${inputs.contractId || ''}&groupId=${inputs.groupId || ''}`;
                const body = {
                    propertyVersion: inputs.propertyVersion,
                    network: inputs.network || 'STAGING',
                    note: inputs.note || 'Activated via SabFlow',
                    notifyEmails: inputs.notifyEmails || [],
                };
                const data = await akamaiRequest('POST', url, inputs, body);
                return { output: data };
            }
            case 'deactivateProperty': {
                if (!inputs.propertyId || !inputs.propertyVersion) return { error: 'Missing propertyId or propertyVersion' };
                const url = `${baseUrl}/papi/v1/properties/${inputs.propertyId}/activations?contractId=${inputs.contractId || ''}&groupId=${inputs.groupId || ''}`;
                const body = {
                    propertyVersion: inputs.propertyVersion,
                    network: inputs.network || 'STAGING',
                    note: inputs.note || 'Deactivated via SabFlow',
                    notifyEmails: inputs.notifyEmails || [],
                    acknowledgeWarnings: [],
                    complianceRecord: { noncomplianceReason: 'EMERGENCY' },
                    activationType: 'DEACTIVATE',
                };
                const data = await akamaiRequest('POST', url, inputs, body);
                return { output: data };
            }
            case 'listEdgeHostnames': {
                const url = `${baseUrl}/papi/v1/edgehostnames?contractId=${inputs.contractId || ''}&groupId=${inputs.groupId || ''}`;
                const data = await akamaiRequest('GET', url, inputs);
                return { output: data };
            }
            case 'getEdgeHostname': {
                if (!inputs.edgeHostnameId) return { error: 'Missing edgeHostnameId' };
                const url = `${baseUrl}/papi/v1/edgehostnames/${inputs.edgeHostnameId}?contractId=${inputs.contractId || ''}&groupId=${inputs.groupId || ''}`;
                const data = await akamaiRequest('GET', url, inputs);
                return { output: data };
            }
            case 'listCPCodes': {
                const url = `${baseUrl}/papi/v1/cpcodes?contractId=${inputs.contractId || ''}&groupId=${inputs.groupId || ''}`;
                const data = await akamaiRequest('GET', url, inputs);
                return { output: data };
            }
            case 'getCPCode': {
                if (!inputs.cpCodeId) return { error: 'Missing cpCodeId' };
                const url = `${baseUrl}/papi/v1/cpcodes/${inputs.cpCodeId}?contractId=${inputs.contractId || ''}&groupId=${inputs.groupId || ''}`;
                const data = await akamaiRequest('GET', url, inputs);
                return { output: data };
            }
            case 'createCPCode': {
                if (!inputs.cpCodeName) return { error: 'Missing cpCodeName' };
                const url = `${baseUrl}/papi/v1/cpcodes?contractId=${inputs.contractId || ''}&groupId=${inputs.groupId || ''}`;
                const body = {
                    productId: inputs.productId || 'prd_SPM',
                    cpcodeName: inputs.cpCodeName,
                };
                const data = await akamaiRequest('POST', url, inputs, body);
                return { output: data };
            }
            case 'flushContent': {
                if (!inputs.objects) return { error: 'Missing objects (array of URLs) to flush' };
                const url = `${baseUrl}/ccu/v3/delete/url/${inputs.network || 'production'}`;
                const body = {
                    objects: Array.isArray(inputs.objects) ? inputs.objects : [inputs.objects],
                };
                const data = await akamaiRequest('POST', url, inputs, body);
                return { output: data };
            }
            case 'getActivation': {
                if (!inputs.propertyId || !inputs.activationId) return { error: 'Missing propertyId or activationId' };
                const url = `${baseUrl}/papi/v1/properties/${inputs.propertyId}/activations/${inputs.activationId}?contractId=${inputs.contractId || ''}&groupId=${inputs.groupId || ''}`;
                const data = await akamaiRequest('GET', url, inputs);
                return { output: data };
            }
            case 'listActivations': {
                if (!inputs.propertyId) return { error: 'Missing propertyId' };
                const url = `${baseUrl}/papi/v1/properties/${inputs.propertyId}/activations?contractId=${inputs.contractId || ''}&groupId=${inputs.groupId || ''}`;
                const data = await akamaiRequest('GET', url, inputs);
                return { output: data };
            }
            default:
                return { error: `Unknown Akamai action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`executeAkamaiAction error: ${err.message}`);
        return { error: err.message || 'Unknown error in Akamai action' };
    }
}
