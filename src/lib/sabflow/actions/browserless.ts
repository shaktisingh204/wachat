'use server';

const BROWSERLESS_BASE_URL = 'https://chrome.browserless.io';

async function browserlessFetch(apiKey: string, method: string, path: string, body?: any, logger?: any): Promise<any> {
    const url = `${BROWSERLESS_BASE_URL}${path}?token=${encodeURIComponent(apiKey)}`;
    logger?.log(`[Browserless] ${method} ${url}`);
    const options: RequestInit = {
        method,
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    };
    if (body !== undefined) options.body = JSON.stringify(body);
    const res = await fetch(url, options);
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Browserless error (${res.status}): ${text}`);
    }
    if (res.status === 204) return {};
    const contentType = res.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) return res.json();
    const text = await res.text();
    return { value: text };
}

export async function executeBrowserlessAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const apiKey = String(inputs.apiKey ?? '').trim();
        if (!apiKey) return { error: 'apiKey is required.' };

        switch (actionName) {
            case 'screenshot': {
                const targetUrl = String(inputs.url ?? '').trim();
                if (!targetUrl) return { error: 'url is required.' };
                const body: Record<string, any> = { url: targetUrl };
                if (inputs.fullPage !== undefined) body.fullPage = inputs.fullPage;
                if (inputs.type) body.type = inputs.type;
                if (inputs.quality) body.quality = inputs.quality;
                if (inputs.viewport) body.viewport = inputs.viewport;
                const data = await browserlessFetch(apiKey, 'POST', '/screenshot', body, logger);
                return { output: { screenshot: data.value ?? data } };
            }

            case 'pdf': {
                const targetUrl = String(inputs.url ?? '').trim();
                if (!targetUrl) return { error: 'url is required.' };
                const body: Record<string, any> = { url: targetUrl };
                if (inputs.options) body.options = inputs.options;
                const data = await browserlessFetch(apiKey, 'POST', '/pdf', body, logger);
                return { output: { pdf: data.value ?? data } };
            }

            case 'content': {
                const targetUrl = String(inputs.url ?? '').trim();
                if (!targetUrl) return { error: 'url is required.' };
                const body: Record<string, any> = { url: targetUrl };
                if (inputs.waitFor) body.waitFor = inputs.waitFor;
                if (inputs.elements) body.elements = inputs.elements;
                const data = await browserlessFetch(apiKey, 'POST', '/content', body, logger);
                return { output: { content: data.value ?? data } };
            }

            case 'scrape': {
                const targetUrl = String(inputs.url ?? '').trim();
                if (!targetUrl) return { error: 'url is required.' };
                const body: Record<string, any> = { url: targetUrl };
                if (inputs.elements) body.elements = inputs.elements;
                if (inputs.waitFor) body.waitFor = inputs.waitFor;
                if (inputs.debug) body.debug = inputs.debug;
                const data = await browserlessFetch(apiKey, 'POST', '/scrape', body, logger);
                return { output: { data } };
            }

            case 'executeScript': {
                const targetUrl = String(inputs.url ?? '').trim();
                const code = String(inputs.code ?? '').trim();
                if (!targetUrl || !code) return { error: 'url and code are required.' };
                const body = { url: targetUrl, code };
                const data = await browserlessFetch(apiKey, 'POST', '/execute', body, logger);
                return { output: { result: data } };
            }

            case 'executeFunction': {
                const code = String(inputs.code ?? '').trim();
                if (!code) return { error: 'code is required.' };
                const body: Record<string, any> = { code };
                if (inputs.context) body.context = inputs.context;
                const data = await browserlessFetch(apiKey, 'POST', '/function', body, logger);
                return { output: { result: data } };
            }

            case 'liveUrl': {
                const body: Record<string, any> = {};
                if (inputs.browserSettings) body.browserSettings = inputs.browserSettings;
                if (inputs.timeout) body.timeout = inputs.timeout;
                const data = await browserlessFetch(apiKey, 'POST', '/live', body, logger);
                return { output: { liveUrl: data.liveURL ?? data } };
            }

            case 'download': {
                const targetUrl = String(inputs.url ?? '').trim();
                if (!targetUrl) return { error: 'url is required.' };
                const body: Record<string, any> = { url: targetUrl };
                if (inputs.waitFor) body.waitFor = inputs.waitFor;
                const data = await browserlessFetch(apiKey, 'POST', '/download', body, logger);
                return { output: { data } };
            }

            case 'listSessions': {
                const data = await browserlessFetch(apiKey, 'GET', '/sessions', undefined, logger);
                return { output: { sessions: Array.isArray(data) ? data : (data.sessions ?? data) } };
            }

            case 'closeSession': {
                const sessionId = String(inputs.sessionId ?? '').trim();
                if (!sessionId) return { error: 'sessionId is required.' };
                const data = await browserlessFetch(apiKey, 'DELETE', `/sessions/${sessionId}`, undefined, logger);
                return { output: { closed: true, data } };
            }

            case 'manageDownloads': {
                const data = await browserlessFetch(apiKey, 'GET', '/download', undefined, logger);
                return { output: { downloads: data } };
            }

            case 'getMetrics': {
                const data = await browserlessFetch(apiKey, 'GET', '/metrics', undefined, logger);
                return { output: { metrics: data } };
            }

            case 'getConfig': {
                const data = await browserlessFetch(apiKey, 'GET', '/config', undefined, logger);
                return { output: { config: data } };
            }

            case 'checkStatus': {
                const data = await browserlessFetch(apiKey, 'GET', '/pressure', undefined, logger);
                return { output: { status: data } };
            }

            case 'performanceCheck': {
                const targetUrl = String(inputs.url ?? '').trim();
                if (!targetUrl) return { error: 'url is required.' };
                const body = { url: targetUrl };
                const data = await browserlessFetch(apiKey, 'POST', '/performance', body, logger);
                return { output: { performance: data } };
            }

            default:
                return { error: `Unknown Browserless action: ${actionName}` };
        }
    } catch (err: any) {
        logger?.log(`[Browserless] Error in ${actionName}: ${err.message}`);
        return { error: err.message ?? 'Unknown Browserless error.' };
    }
}
