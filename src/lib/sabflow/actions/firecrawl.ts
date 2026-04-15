
'use server';

const FIRECRAWL_BASE_URL = 'https://api.firecrawl.dev/v1';

async function firecrawlFetch(apiKey: string, method: string, path: string, body?: any, logger?: any): Promise<any> {
    logger?.log(`[Firecrawl] ${method} ${path}`);
    const url = path.startsWith('http') ? path : `${FIRECRAWL_BASE_URL}${path}`;
    const options: RequestInit = {
        method,
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);
    const res = await fetch(url, options);
    if (res.status === 204) return { success: true };
    let data: any;
    try {
        data = await res.json();
    } catch {
        if (!res.ok) throw new Error(`Firecrawl API error: ${res.status}`);
        return { success: true };
    }
    if (!res.ok) {
        throw new Error(data?.error || data?.message || `Firecrawl API error: ${res.status}`);
    }
    return data;
}

async function pollFirecrawlJob(apiKey: string, pollPath: string, maxAttempts = 60, intervalMs = 3000, logger?: any): Promise<any> {
    for (let i = 0; i < maxAttempts; i++) {
        const result = await firecrawlFetch(apiKey, 'GET', pollPath, undefined, logger);
        const status = result.status;
        if (status === 'completed' || result.data?.llmstxt) return result;
        if (status === 'failed') throw new Error(`Firecrawl job failed: ${result.error ?? 'unknown error'}`);
        await new Promise(r => setTimeout(r, intervalMs));
    }
    throw new Error('Firecrawl job timed out.');
}

export async function executeFirecrawlAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const apiKey = String(inputs.apiKey ?? '').trim();
        if (!apiKey) return { error: 'apiKey is required.' };

        const fc = (method: string, path: string, body?: any) =>
            firecrawlFetch(apiKey, method, path, body, logger);

        switch (actionName) {
            case 'scrapeUrl': {
                const url = String(inputs.url ?? '').trim();
                if (!url) return { error: 'url is required.' };
                const body: any = {
                    url,
                    formats: inputs.formats ?? ['markdown', 'html'],
                    onlyMainContent: inputs.onlyMainContent ?? true,
                };
                if (inputs.includeTags) body.includeTags = inputs.includeTags;
                if (inputs.excludeTags) body.excludeTags = inputs.excludeTags;
                if (inputs.headers) body.headers = inputs.headers;
                if (inputs.waitFor) body.waitFor = inputs.waitFor;
                const data = await fc('POST', '/scrape', body);
                return {
                    output: {
                        success: data.success,
                        data: {
                            markdown: data.data?.markdown,
                            html: data.data?.html,
                            metadata: {
                                title: data.data?.metadata?.title,
                                description: data.data?.metadata?.description,
                                ogTitle: data.data?.metadata?.ogTitle,
                                statusCode: data.data?.metadata?.statusCode,
                            },
                        },
                    },
                };
            }

            case 'crawlUrl': {
                const url = String(inputs.url ?? '').trim();
                if (!url) return { error: 'url is required.' };
                const body: any = {
                    url,
                    limit: inputs.limit ?? 10,
                    maxDepth: inputs.maxDepth ?? 2,
                    allowBackwardLinks: inputs.allowBackwardLinks ?? false,
                    allowExternalLinks: inputs.allowExternalLinks ?? false,
                    ignoreSitemap: inputs.ignoreSitemap ?? false,
                    scrapeOptions: inputs.scrapeOptions ?? { formats: ['markdown'] },
                };
                const data = await fc('POST', '/crawl', body);
                return { output: { success: data.success, id: data.id, url: data.url } };
            }

            case 'getCrawlStatus': {
                const jobId = String(inputs.jobId ?? '').trim();
                if (!jobId) return { error: 'jobId is required.' };
                const data = await fc('GET', `/crawl/${jobId}`);
                return {
                    output: {
                        status: data.status,
                        total: data.total,
                        completed: data.completed,
                        creditsUsed: data.creditsUsed,
                        data: data.data ?? [],
                    },
                };
            }

            case 'cancelCrawl': {
                const jobId = String(inputs.jobId ?? '').trim();
                if (!jobId) return { error: 'jobId is required.' };
                const data = await fc('DELETE', `/crawl/${jobId}`);
                return { output: { success: data.success, message: data.message } };
            }

            case 'mapUrl': {
                const url = String(inputs.url ?? '').trim();
                if (!url) return { error: 'url is required.' };
                const body: any = {
                    url,
                    limit: inputs.limit ?? 100,
                    ignoreSitemap: inputs.ignoreSitemap ?? false,
                };
                if (inputs.search) body.search = inputs.search;
                const data = await fc('POST', '/map', body);
                return { output: { success: data.success, links: data.links ?? [] } };
            }

            case 'searchWeb': {
                const query = String(inputs.query ?? '').trim();
                if (!query) return { error: 'query is required.' };
                const body: any = {
                    query,
                    limit: inputs.limit ?? 5,
                    lang: inputs.lang ?? 'en',
                    country: inputs.country ?? 'us',
                };
                if (inputs.tbs) body.tbs = inputs.tbs;
                if (inputs.filter) body.filter = inputs.filter;
                const data = await fc('POST', '/search', body);
                return {
                    output: {
                        success: data.success,
                        data: (data.data ?? []).map((r: any) => ({
                            title: r.title,
                            url: r.url,
                            description: r.description,
                            markdown: r.markdown,
                        })),
                    },
                };
            }

            case 'extractStructured': {
                const url = String(inputs.url ?? '').trim();
                const schema = inputs.schema;
                if (!url || !schema) return { error: 'url and schema are required.' };
                const body: any = {
                    url,
                    formats: ['extract'],
                    extract: { schema },
                };
                if (inputs.prompt) body.extract.prompt = inputs.prompt;
                const data = await fc('POST', '/scrape', body);
                return { output: { success: data.success, data: { extract: data.data?.extract ?? {} } } };
            }

            case 'batchScrape': {
                const urls = inputs.urls;
                if (!urls || !Array.isArray(urls) || urls.length === 0) return { error: 'urls (array) is required.' };
                const body = {
                    urls,
                    formats: inputs.formats ?? ['markdown'],
                    onlyMainContent: inputs.onlyMainContent ?? true,
                };
                const data = await fc('POST', '/batch/scrape', body);
                return { output: { success: data.success, id: data.id, url: data.url } };
            }

            case 'getBatchStatus': {
                const jobId = String(inputs.jobId ?? '').trim();
                if (!jobId) return { error: 'jobId is required.' };
                const data = await fc('GET', `/batch/scrape/${jobId}`);
                return {
                    output: {
                        status: data.status,
                        total: data.total,
                        completed: data.completed,
                        data: data.data ?? [],
                    },
                };
            }

            case 'checkCredits': {
                const data = await fc('GET', '/team/credits');
                return {
                    output: {
                        remaining: data.remaining,
                        used: data.used,
                        limit: data.limit,
                    },
                };
            }

            case 'generateLlmsTxt': {
                const url = String(inputs.url ?? '').trim();
                if (!url) return { error: 'url is required.' };
                const body = {
                    url,
                    maxUrls: inputs.maxUrls ?? 10,
                    showFullText: inputs.showFullText ?? false,
                };
                const created = await fc('POST', '/llmstxt', body);
                if (!created.id) return { output: { success: created.success, data: created.data } };
                const result = await pollFirecrawlJob(apiKey, `/llmstxt/${created.id}`, 60, 3000, logger);
                return {
                    output: {
                        success: true,
                        data: {
                            llmstxt: result.data?.llmstxt,
                            llmsfulltxt: result.data?.llmsfulltxt,
                        },
                    },
                };
            }

            default:
                return { error: `Unknown Firecrawl action: ${actionName}` };
        }
    } catch (err: any) {
        logger?.log(`[Firecrawl] Error in ${actionName}: ${err.message}`);
        return { error: err.message ?? 'Unknown Firecrawl error.' };
    }
}
