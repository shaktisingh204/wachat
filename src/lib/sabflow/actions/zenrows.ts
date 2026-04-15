'use server';

const ZENROWS_BASE_URL = 'https://api.zenrows.com/v1';

async function zenrowsFetch(apiKey: string, method: string, path: string, params?: Record<string, any>, body?: any, logger?: any): Promise<any> {
    const qs = new URLSearchParams({ apikey: apiKey });
    if (params) {
        for (const [k, v] of Object.entries(params)) {
            if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
        }
    }
    const url = `${ZENROWS_BASE_URL}${path}?${qs.toString()}`;
    logger?.log(`[ZenRows] ${method} ${url}`);
    const options: RequestInit = { method, headers: { 'Content-Type': 'application/json', Accept: 'application/json' } };
    if (body !== undefined) options.body = JSON.stringify(body);
    const res = await fetch(url, options);
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`ZenRows error (${res.status}): ${text}`);
    }
    if (res.status === 204) return {};
    const contentType = res.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) return res.json();
    return { value: await res.text() };
}

export async function executeZenrowsAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const apiKey = String(inputs.apiKey ?? '').trim();
        if (!apiKey) return { error: 'apiKey is required.' };

        const zr = (method: string, path: string, params?: Record<string, any>, body?: any) =>
            zenrowsFetch(apiKey, method, path, params, body, logger);

        switch (actionName) {
            case 'scrapeUrl': {
                const url = String(inputs.url ?? '').trim();
                if (!url) return { error: 'url is required.' };
                const params: Record<string, any> = { url };
                if (inputs.jsRender !== undefined) params.js_render = String(inputs.jsRender);
                if (inputs.cssExtractor) params.css_extractor = inputs.cssExtractor;
                const data = await zr('GET', '/', params);
                return { output: { content: data.value ?? data } };
            }

            case 'scrapeWithJS': {
                const url = String(inputs.url ?? '').trim();
                if (!url) return { error: 'url is required.' };
                const params: Record<string, any> = { url, js_render: 'true' };
                if (inputs.waitFor) params.wait_for = inputs.waitFor;
                if (inputs.jsInstructions) params.js_instructions = inputs.jsInstructions;
                const data = await zr('GET', '/', params);
                return { output: { content: data.value ?? data } };
            }

            case 'extractData': {
                const url = String(inputs.url ?? '').trim();
                if (!url) return { error: 'url is required.' };
                const params: Record<string, any> = { url };
                if (inputs.cssExtractor) params.css_extractor = JSON.stringify(inputs.cssExtractor);
                if (inputs.xpathExtractor) params.xpath_extractor = JSON.stringify(inputs.xpathExtractor);
                const data = await zr('GET', '/', params);
                return { output: { extracted: data } };
            }

            case 'scrapeWithProxy': {
                const url = String(inputs.url ?? '').trim();
                if (!url) return { error: 'url is required.' };
                const params: Record<string, any> = { url };
                if (inputs.proxyCountry) params.proxy_country = inputs.proxyCountry;
                if (inputs.premiumProxy !== undefined) params.premium_proxy = String(inputs.premiumProxy);
                const data = await zr('GET', '/', params);
                return { output: { content: data.value ?? data } };
            }

            case 'batchScrape': {
                const urls = inputs.urls ?? [];
                if (!Array.isArray(urls) || urls.length === 0) return { error: 'urls array is required.' };
                const body: Record<string, any> = { urls };
                if (inputs.jsRender !== undefined) body.js_render = inputs.jsRender;
                const data = await zr('POST', '/batch', undefined, body);
                return { output: { batch: data } };
            }

            case 'getBatchResults': {
                const batchId = String(inputs.batchId ?? '').trim();
                if (!batchId) return { error: 'batchId is required.' };
                const data = await zr('GET', `/batch/${batchId}/results`);
                return { output: { results: data } };
            }

            case 'checkBatchStatus': {
                const batchId = String(inputs.batchId ?? '').trim();
                if (!batchId) return { error: 'batchId is required.' };
                const data = await zr('GET', `/batch/${batchId}`);
                return { output: { status: data } };
            }

            case 'extractLinks': {
                const url = String(inputs.url ?? '').trim();
                if (!url) return { error: 'url is required.' };
                const params: Record<string, any> = { url, css_extractor: JSON.stringify({ links: 'a @href' }) };
                const data = await zr('GET', '/', params);
                return { output: { links: data.links ?? data } };
            }

            case 'extractImages': {
                const url = String(inputs.url ?? '').trim();
                if (!url) return { error: 'url is required.' };
                const params: Record<string, any> = { url, css_extractor: JSON.stringify({ images: 'img @src' }) };
                const data = await zr('GET', '/', params);
                return { output: { images: data.images ?? data } };
            }

            case 'extractText': {
                const url = String(inputs.url ?? '').trim();
                if (!url) return { error: 'url is required.' };
                const params: Record<string, any> = { url, css_extractor: JSON.stringify({ text: 'body' }) };
                const data = await zr('GET', '/', params);
                return { output: { text: data.text ?? data } };
            }

            case 'screenshotPage': {
                const url = String(inputs.url ?? '').trim();
                if (!url) return { error: 'url is required.' };
                const params: Record<string, any> = { url, screenshot: 'true', js_render: 'true' };
                if (inputs.fullPage !== undefined) params.screenshot_fullpage = String(inputs.fullPage);
                const data = await zr('GET', '/', params);
                return { output: { screenshot: data.value ?? data } };
            }

            case 'generatePDF': {
                const url = String(inputs.url ?? '').trim();
                if (!url) return { error: 'url is required.' };
                const params: Record<string, any> = { url, pdf: 'true', js_render: 'true' };
                const data = await zr('GET', '/', params);
                return { output: { pdf: data.value ?? data } };
            }

            case 'getAccountInfo': {
                const data = await zr('GET', '/usage');
                return { output: { account: data } };
            }

            case 'checkCredits': {
                const data = await zr('GET', '/usage');
                return { output: { credits: data.remaining_credits ?? data, used: data.used_credits ?? data } };
            }

            case 'listCrawls': {
                const data = await zr('GET', '/crawls');
                return { output: { crawls: data } };
            }

            default:
                return { error: `Unknown ZenRows action: ${actionName}` };
        }
    } catch (err: any) {
        logger?.log(`[ZenRows] Error in ${actionName}: ${err.message}`);
        return { error: err.message ?? 'Unknown ZenRows error.' };
    }
}
