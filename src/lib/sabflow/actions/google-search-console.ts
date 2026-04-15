'use server';

export async function executeGoogleSearchConsoleAction(actionName: string, inputs: any, user: any, logger: any) {
    const { accessToken, siteUrl } = inputs;
    const baseUrl = 'https://searchconsole.googleapis.com/webmasters/v3';

    const headers: Record<string, string> = {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
    };

    try {
        switch (actionName) {
            case 'listSites': {
                const res = await fetch(`${baseUrl}/sites`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'listSites failed' };
                return { output: data };
            }

            case 'addSite': {
                const encodedSite = encodeURIComponent(inputs.siteUrl || siteUrl);
                const res = await fetch(`${baseUrl}/sites/${encodedSite}`, { method: 'PUT', headers });
                const data = res.status === 204 ? { success: true } : await res.json();
                if (!res.ok) return { error: (data as any).error?.message || 'addSite failed' };
                return { output: data };
            }

            case 'deleteSite': {
                const encodedSite = encodeURIComponent(inputs.siteUrl || siteUrl);
                const res = await fetch(`${baseUrl}/sites/${encodedSite}`, { method: 'DELETE', headers });
                if (!res.ok) {
                    const data = await res.json();
                    return { error: data.error?.message || 'deleteSite failed' };
                }
                return { output: { success: true } };
            }

            case 'querySiteSearchAnalytics': {
                const encodedSite = encodeURIComponent(siteUrl);
                const res = await fetch(`${baseUrl}/sites/${encodedSite}/searchAnalytics/query`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(inputs.body || {}),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'querySiteSearchAnalytics failed' };
                return { output: data };
            }

            case 'listSitemaps': {
                const encodedSite = encodeURIComponent(siteUrl);
                const res = await fetch(`${baseUrl}/sites/${encodedSite}/sitemaps`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'listSitemaps failed' };
                return { output: data };
            }

            case 'getSitemap': {
                const encodedSite = encodeURIComponent(siteUrl);
                const encodedFeedpath = encodeURIComponent(inputs.feedpath);
                const res = await fetch(`${baseUrl}/sites/${encodedSite}/sitemaps/${encodedFeedpath}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'getSitemap failed' };
                return { output: data };
            }

            case 'submitSitemap': {
                const encodedSite = encodeURIComponent(siteUrl);
                const encodedFeedpath = encodeURIComponent(inputs.feedpath);
                const res = await fetch(`${baseUrl}/sites/${encodedSite}/sitemaps/${encodedFeedpath}`, { method: 'PUT', headers });
                if (!res.ok) {
                    const data = await res.json();
                    return { error: data.error?.message || 'submitSitemap failed' };
                }
                return { output: { success: true } };
            }

            case 'deleteSitemap': {
                const encodedSite = encodeURIComponent(siteUrl);
                const encodedFeedpath = encodeURIComponent(inputs.feedpath);
                const res = await fetch(`${baseUrl}/sites/${encodedSite}/sitemaps/${encodedFeedpath}`, { method: 'DELETE', headers });
                if (!res.ok) {
                    const data = await res.json();
                    return { error: data.error?.message || 'deleteSitemap failed' };
                }
                return { output: { success: true } };
            }

            case 'listInspectionResults': {
                const res = await fetch(`https://searchconsole.googleapis.com/v1/urlInspection/index:inspect`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ inspectionUrl: inputs.inspectionUrl, siteUrl: inputs.siteUrl || siteUrl }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'listInspectionResults failed' };
                return { output: data };
            }

            case 'inspectUrl': {
                const res = await fetch(`https://searchconsole.googleapis.com/v1/urlInspection/index:inspect`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ inspectionUrl: inputs.inspectionUrl, siteUrl: inputs.siteUrl || siteUrl }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'inspectUrl failed' };
                return { output: data };
            }

            case 'getSearchAnalyticsData': {
                const encodedSite = encodeURIComponent(siteUrl);
                const body = Object.assign({ startDate: inputs.startDate, endDate: inputs.endDate, dimensions: inputs.dimensions || ['query'] }, inputs.body || {});
                const res = await fetch(`${baseUrl}/sites/${encodedSite}/searchAnalytics/query`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'getSearchAnalyticsData failed' };
                return { output: data };
            }

            case 'listKeywordData': {
                const encodedSite = encodeURIComponent(siteUrl);
                const body = { startDate: inputs.startDate, endDate: inputs.endDate, dimensions: ['query'], rowLimit: inputs.rowLimit || 1000 };
                const res = await fetch(`${baseUrl}/sites/${encodedSite}/searchAnalytics/query`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'listKeywordData failed' };
                return { output: data };
            }

            case 'getClickData': {
                const encodedSite = encodeURIComponent(siteUrl);
                const body = { startDate: inputs.startDate, endDate: inputs.endDate, dimensions: inputs.dimensions || ['query'], metrics: [{ expression: 'clicks' }] };
                const res = await fetch(`${baseUrl}/sites/${encodedSite}/searchAnalytics/query`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'getClickData failed' };
                return { output: data };
            }

            case 'getImpressionData': {
                const encodedSite = encodeURIComponent(siteUrl);
                const body = { startDate: inputs.startDate, endDate: inputs.endDate, dimensions: inputs.dimensions || ['query'], metrics: [{ expression: 'impressions' }] };
                const res = await fetch(`${baseUrl}/sites/${encodedSite}/searchAnalytics/query`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'getImpressionData failed' };
                return { output: data };
            }

            case 'getCTRData': {
                const encodedSite = encodeURIComponent(siteUrl);
                const body = { startDate: inputs.startDate, endDate: inputs.endDate, dimensions: inputs.dimensions || ['query'], metrics: [{ expression: 'ctr' }] };
                const res = await fetch(`${baseUrl}/sites/${encodedSite}/searchAnalytics/query`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'getCTRData failed' };
                return { output: data };
            }

            default:
                return { error: `Unknown action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`google-search-console error: ${err.message}`);
        return { error: err.message || 'Unexpected error in google-search-console action' };
    }
}
