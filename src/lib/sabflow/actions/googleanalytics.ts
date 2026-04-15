
'use server';

const GA_DATA_BASE = 'https://analyticsdata.googleapis.com/v1beta';
const GA_ADMIN_BASE = 'https://analyticsadmin.googleapis.com/v1beta';

async function gaFetch(
    method: string,
    url: string,
    accessToken: string,
    body?: any
): Promise<any> {
    const res = await fetch(url, {
        method,
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data?.error?.message || `GA API error ${res.status}`);
    }
    return data;
}

export async function executeGoogleAnalyticsAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
): Promise<{ output?: any; error?: string }> {
    try {
        const accessToken = String(inputs.accessToken ?? '').trim();
        if (!accessToken) throw new Error('accessToken is required.');

        const propertyId = String(inputs.propertyId ?? '').trim();

        switch (actionName) {
            case 'runReport': {
                if (!propertyId) throw new Error('propertyId is required.');
                const dimensions = inputs.dimensions || [];
                const metrics = inputs.metrics || [];
                const dateRanges = inputs.dateRanges || [{ startDate: '30daysAgo', endDate: 'today' }];
                const data = await gaFetch('POST', `${GA_DATA_BASE}/${propertyId}:runReport`, accessToken, {
                    dimensions,
                    metrics,
                    dateRanges,
                });
                logger.log(`[GoogleAnalytics] runReport for ${propertyId}`);
                return { output: data };
            }

            case 'runRealtimeReport': {
                if (!propertyId) throw new Error('propertyId is required.');
                const dimensions = inputs.dimensions || [];
                const metrics = inputs.metrics || [];
                const data = await gaFetch('POST', `${GA_DATA_BASE}/${propertyId}:runRealtimeReport`, accessToken, {
                    dimensions,
                    metrics,
                });
                logger.log(`[GoogleAnalytics] runRealtimeReport for ${propertyId}`);
                return { output: data };
            }

            case 'runPivotReport': {
                if (!propertyId) throw new Error('propertyId is required.');
                const body = inputs.body || {};
                const data = await gaFetch('POST', `${GA_DATA_BASE}/${propertyId}:runPivotReport`, accessToken, body);
                logger.log(`[GoogleAnalytics] runPivotReport for ${propertyId}`);
                return { output: data };
            }

            case 'batchRunReports': {
                if (!propertyId) throw new Error('propertyId is required.');
                const requests = inputs.requests || [];
                const data = await gaFetch('POST', `${GA_DATA_BASE}/${propertyId}:batchRunReports`, accessToken, { requests });
                logger.log(`[GoogleAnalytics] batchRunReports for ${propertyId}`);
                return { output: data };
            }

            case 'getMetadata': {
                if (!propertyId) throw new Error('propertyId is required.');
                const data = await gaFetch('GET', `${GA_DATA_BASE}/${propertyId}/metadata`, accessToken);
                logger.log(`[GoogleAnalytics] getMetadata for ${propertyId}`);
                return { output: data };
            }

            case 'listAccountSummaries': {
                const data = await gaFetch('GET', `${GA_ADMIN_BASE}/accountSummaries`, accessToken);
                logger.log(`[GoogleAnalytics] listAccountSummaries`);
                return { output: data };
            }

            case 'listProperties': {
                const accountId = String(inputs.accountId ?? '').trim();
                if (!accountId) throw new Error('accountId is required.');
                const data = await gaFetch('GET', `${GA_ADMIN_BASE}/properties?filter=parent:${accountId}`, accessToken);
                logger.log(`[GoogleAnalytics] listProperties for account ${accountId}`);
                return { output: data };
            }

            case 'createAudience': {
                if (!propertyId) throw new Error('propertyId is required.');
                const audienceBody = inputs.audience || {};
                const data = await gaFetch('POST', `${GA_ADMIN_BASE}/${propertyId}/audiences`, accessToken, audienceBody);
                logger.log(`[GoogleAnalytics] createAudience for ${propertyId}`);
                return { output: data };
            }

            case 'getAudienceList': {
                if (!propertyId) throw new Error('propertyId is required.');
                const audienceListId = String(inputs.audienceListId ?? '').trim();
                if (!audienceListId) throw new Error('audienceListId is required.');
                const data = await gaFetch('GET', `${GA_DATA_BASE}/${propertyId}/audienceLists/${audienceListId}`, accessToken);
                logger.log(`[GoogleAnalytics] getAudienceList ${audienceListId}`);
                return { output: data };
            }

            case 'runFunnelReport': {
                if (!propertyId) throw new Error('propertyId is required.');
                const body = inputs.body || {};
                const data = await gaFetch('POST', `${GA_DATA_BASE}/${propertyId}:runFunnelReport`, accessToken, body);
                logger.log(`[GoogleAnalytics] runFunnelReport for ${propertyId}`);
                return { output: data };
            }

            default:
                throw new Error(`GoogleAnalytics action "${actionName}" is not implemented.`);
        }
    } catch (err: any) {
        const message = err?.message || 'Unknown GoogleAnalytics error';
        logger.log(`[GoogleAnalytics] Error: ${message}`);
        return { error: message };
    }
}
