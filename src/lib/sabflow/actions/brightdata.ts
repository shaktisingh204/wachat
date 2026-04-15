'use server';

const BRIGHTDATA_BASE_URL = 'https://brightdata.com/api';

async function brightDataFetch(inputs: any, method: string, path: string, body?: any, logger?: any): Promise<any> {
    const url = `${BRIGHTDATA_BASE_URL}${path}`;
    logger?.log(`[BrightData] ${method} ${url}`);

    const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' };

    if (inputs.apiKey) {
        headers['Authorization'] = `Bearer ${inputs.apiKey}`;
    } else if (inputs.username && inputs.password) {
        const creds = Buffer.from(`${inputs.username}:${inputs.password}`).toString('base64');
        headers['Authorization'] = `Basic ${creds}`;
    }

    const options: RequestInit = { method, headers };
    if (body !== undefined) options.body = JSON.stringify(body);

    const res = await fetch(url, options);
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`BrightData error (${res.status}): ${text}`);
    }
    if (res.status === 204) return {};
    const contentType = res.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) return res.json();
    return { value: await res.text() };
}

export async function executeBrightDataAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        if (!inputs.apiKey && !(inputs.username && inputs.password)) {
            return { error: 'apiKey or username+password credentials are required.' };
        }

        const bd = (method: string, path: string, body?: any) => brightDataFetch(inputs, method, path, body, logger);

        switch (actionName) {
            case 'scrapUrl': {
                const targetUrl = String(inputs.url ?? '').trim();
                if (!targetUrl) return { error: 'url is required.' };
                const body: Record<string, any> = { url: targetUrl };
                if (inputs.country) body.country = inputs.country;
                if (inputs.renderJs !== undefined) body.render_js = inputs.renderJs;
                const data = await bd('POST', '/scrape', body);
                return { output: { content: data } };
            }

            case 'getDataset': {
                const datasetId = String(inputs.datasetId ?? '').trim();
                if (!datasetId) return { error: 'datasetId is required.' };
                const data = await bd('GET', `/datasets/${datasetId}`);
                return { output: { dataset: data } };
            }

            case 'listDatasets': {
                const data = await bd('GET', '/datasets');
                return { output: { datasets: data } };
            }

            case 'createDataset': {
                const name = String(inputs.name ?? '').trim();
                if (!name) return { error: 'name is required.' };
                const body: Record<string, any> = { name };
                if (inputs.description) body.description = inputs.description;
                const data = await bd('POST', '/datasets', body);
                return { output: { dataset: data } };
            }

            case 'triggerDatasetCollection': {
                const datasetId = String(inputs.datasetId ?? '').trim();
                if (!datasetId) return { error: 'datasetId is required.' };
                const body: Record<string, any> = {};
                if (inputs.inputs) body.inputs = inputs.inputs;
                if (inputs.limit) body.limit = inputs.limit;
                const data = await bd('POST', `/datasets/${datasetId}/trigger`, body);
                return { output: { collectionId: data.id ?? data, status: data.status } };
            }

            case 'getCollectionStatus': {
                const collectionId = String(inputs.collectionId ?? '').trim();
                if (!collectionId) return { error: 'collectionId is required.' };
                const data = await bd('GET', `/collections/${collectionId}`);
                return { output: { status: data.status, progress: data.progress, data } };
            }

            case 'getCollectionResults': {
                const collectionId = String(inputs.collectionId ?? '').trim();
                if (!collectionId) return { error: 'collectionId is required.' };
                const data = await bd('GET', `/collections/${collectionId}/results`);
                return { output: { results: data } };
            }

            case 'listProxies': {
                const data = await bd('GET', '/proxies');
                return { output: { proxies: data } };
            }

            case 'getProxy': {
                const proxyId = String(inputs.proxyId ?? '').trim();
                if (!proxyId) return { error: 'proxyId is required.' };
                const data = await bd('GET', `/proxies/${proxyId}`);
                return { output: { proxy: data } };
            }

            case 'createProxy': {
                const body: Record<string, any> = {};
                if (inputs.type) body.type = inputs.type;
                if (inputs.country) body.country = inputs.country;
                if (inputs.city) body.city = inputs.city;
                const data = await bd('POST', '/proxies', body);
                return { output: { proxy: data } };
            }

            case 'deleteProxy': {
                const proxyId = String(inputs.proxyId ?? '').trim();
                if (!proxyId) return { error: 'proxyId is required.' };
                await bd('DELETE', `/proxies/${proxyId}`);
                return { output: { deleted: true } };
            }

            case 'getAccountInfo': {
                const data = await bd('GET', '/account');
                return { output: { account: data } };
            }

            case 'getUsageStats': {
                const data = await bd('GET', '/account/usage');
                return { output: { usage: data } };
            }

            case 'listZones': {
                const data = await bd('GET', '/zone');
                return { output: { zones: data } };
            }

            case 'createZone': {
                const name = String(inputs.name ?? '').trim();
                if (!name) return { error: 'name is required.' };
                const body: Record<string, any> = { name };
                if (inputs.type) body.type = inputs.type;
                if (inputs.plan) body.plan = inputs.plan;
                const data = await bd('POST', '/zone', body);
                return { output: { zone: data } };
            }

            default:
                return { error: `Unknown BrightData action: ${actionName}` };
        }
    } catch (err: any) {
        logger?.log(`[BrightData] Error in ${actionName}: ${err.message}`);
        return { error: err.message ?? 'Unknown BrightData error.' };
    }
}
