'use server';

const SCRAPINGBEE_BASE_URL = 'https://app.scrapingbee.com/api/v1';

async function scrapingBeeFetch(apiKey: string, params: Record<string, any>, logger?: any): Promise<any> {
    const qs = new URLSearchParams({ api_key: apiKey });
    for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
    }
    const url = `${SCRAPINGBEE_BASE_URL}?${qs.toString()}`;
    logger?.log(`[ScrapingBee] GET ${url}`);
    const res = await fetch(url);
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`ScrapingBee error (${res.status}): ${text}`);
    }
    const contentType = res.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) return res.json();
    const text = await res.text();
    return { value: text };
}

async function scrapingBeeApiFetch(apiKey: string, method: string, path: string, body?: any, logger?: any): Promise<any> {
    const url = `https://app.scrapingbee.com${path}?api_key=${encodeURIComponent(apiKey)}`;
    logger?.log(`[ScrapingBee] ${method} ${url}`);
    const options: RequestInit = { method, headers: { 'Content-Type': 'application/json' } };
    if (body !== undefined) options.body = JSON.stringify(body);
    const res = await fetch(url, options);
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`ScrapingBee API error (${res.status}): ${text}`);
    }
    const contentType = res.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) return res.json();
    return { value: await res.text() };
}

export async function executeScrapingBeeAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const apiKey = String(inputs.apiKey ?? '').trim();
        if (!apiKey) return { error: 'apiKey is required.' };

        switch (actionName) {
            case 'scrapeUrl': {
                const url = String(inputs.url ?? '').trim();
                if (!url) return { error: 'url is required.' };
                const data = await scrapingBeeFetch(apiKey, { url, render_js: 'false' }, logger);
                return { output: { content: data.value ?? data } };
            }

            case 'scrapeUrlWithJS': {
                const url = String(inputs.url ?? '').trim();
                if (!url) return { error: 'url is required.' };
                const params: Record<string, any> = { url, render_js: 'true' };
                if (inputs.waitFor) params.wait = inputs.waitFor;
                if (inputs.js_scenario) params.js_scenario = JSON.stringify(inputs.js_scenario);
                const data = await scrapingBeeFetch(apiKey, params, logger);
                return { output: { content: data.value ?? data } };
            }

            case 'scrapeUrlScreenshot': {
                const url = String(inputs.url ?? '').trim();
                if (!url) return { error: 'url is required.' };
                const params: Record<string, any> = { url, screenshot: 'true', render_js: 'true' };
                if (inputs.fullPage) params.screenshot_full_page = String(inputs.fullPage);
                const data = await scrapingBeeFetch(apiKey, params, logger);
                return { output: { screenshot: data.value ?? data } };
            }

            case 'scrapeUrlExtract': {
                const url = String(inputs.url ?? '').trim();
                if (!url) return { error: 'url is required.' };
                const extractRules = inputs.extractRules ?? {};
                const params: Record<string, any> = {
                    url,
                    render_js: inputs.renderJs === false ? 'false' : 'true',
                    extract_rules: JSON.stringify(extractRules),
                };
                const data = await scrapingBeeFetch(apiKey, params, logger);
                return { output: { extracted: data } };
            }

            case 'scrapeUrlPdf': {
                const url = String(inputs.url ?? '').trim();
                if (!url) return { error: 'url is required.' };
                const params: Record<string, any> = { url, pdf: 'true', render_js: 'true' };
                const data = await scrapingBeeFetch(apiKey, params, logger);
                return { output: { pdf: data.value ?? data } };
            }

            case 'scrapeSERP': {
                const query = String(inputs.query ?? '').trim();
                if (!query) return { error: 'query is required.' };
                const params: Record<string, any> = {
                    url: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
                    render_js: 'false',
                };
                if (inputs.numResults) params.nb_results = inputs.numResults;
                const data = await scrapingBeeFetch(apiKey, params, logger);
                return { output: { content: data.value ?? data } };
            }

            case 'scrapeGoogle': {
                const query = String(inputs.query ?? '').trim();
                if (!query) return { error: 'query is required.' };
                const params: Record<string, any> = { search_type: 'web', url: query };
                if (inputs.country) params.country_code = inputs.country;
                if (inputs.language) params.language = inputs.language;
                const data = await scrapingBeeFetch(apiKey, params, logger);
                return { output: { results: data } };
            }

            case 'scrapeGoogleImages': {
                const query = String(inputs.query ?? '').trim();
                if (!query) return { error: 'query is required.' };
                const params: Record<string, any> = {
                    url: `https://www.google.com/search?q=${encodeURIComponent(query)}&tbm=isch`,
                    render_js: 'false',
                };
                const data = await scrapingBeeFetch(apiKey, params, logger);
                return { output: { content: data.value ?? data } };
            }

            case 'scrapeGoogleNews': {
                const query = String(inputs.query ?? '').trim();
                if (!query) return { error: 'query is required.' };
                const params: Record<string, any> = {
                    url: `https://news.google.com/search?q=${encodeURIComponent(query)}`,
                    render_js: 'true',
                };
                const data = await scrapingBeeFetch(apiKey, params, logger);
                return { output: { content: data.value ?? data } };
            }

            case 'getAccountInfo': {
                const data = await scrapingBeeApiFetch(apiKey, 'GET', '/api/v1/usage', undefined, logger);
                return { output: { account: data } };
            }

            case 'listProxies': {
                const data = await scrapingBeeApiFetch(apiKey, 'GET', '/api/v1/proxies', undefined, logger);
                return { output: { proxies: data } };
            }

            case 'checkCredits': {
                const data = await scrapingBeeApiFetch(apiKey, 'GET', '/api/v1/usage', undefined, logger);
                return { output: { credits: data.max_api_credit ?? data, used: data.used_api_credit ?? data } };
            }

            case 'batchScrape': {
                const urls = inputs.urls ?? [];
                if (!Array.isArray(urls) || urls.length === 0) return { error: 'urls array is required.' };
                const body = { urls, render_js: inputs.renderJs ?? false };
                const data = await scrapingBeeApiFetch(apiKey, 'POST', '/api/v1/batch', body, logger);
                return { output: { batch: data } };
            }

            case 'getBatchResults': {
                const batchId = String(inputs.batchId ?? '').trim();
                if (!batchId) return { error: 'batchId is required.' };
                const data = await scrapingBeeApiFetch(apiKey, 'GET', `/api/v1/batch/${batchId}/results`, undefined, logger);
                return { output: { results: data } };
            }

            case 'checkBatchStatus': {
                const batchId = String(inputs.batchId ?? '').trim();
                if (!batchId) return { error: 'batchId is required.' };
                const data = await scrapingBeeApiFetch(apiKey, 'GET', `/api/v1/batch/${batchId}`, undefined, logger);
                return { output: { status: data } };
            }

            default:
                return { error: `Unknown ScrapingBee action: ${actionName}` };
        }
    } catch (err: any) {
        logger?.log(`[ScrapingBee] Error in ${actionName}: ${err.message}`);
        return { error: err.message ?? 'Unknown ScrapingBee error.' };
    }
}
