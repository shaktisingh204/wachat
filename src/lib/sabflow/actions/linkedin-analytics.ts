'use server';

export async function executeLinkedInAnalyticsAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const accessToken = inputs.accessToken;
        const baseUrl = 'https://api.linkedin.com/v2';

        const headers: Record<string, string> = {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'X-Restli-Protocol-Version': '2.0.0',
        };

        switch (actionName) {
            case 'getOrganization': {
                const organizationId = inputs.organizationId;
                const res = await fetch(`${baseUrl}/organizations/${organizationId}`, { headers });
                if (!res.ok) return { error: await res.text() };
                return { output: { organization: await res.json() } };
            }

            case 'getOrganicAnalytics': {
                const organizationId = inputs.organizationId;
                const startDate = inputs.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                const endDate = inputs.endDate || new Date().toISOString().split('T')[0];
                const params = new URLSearchParams({
                    q: 'organizationalEntity',
                    organizationalEntity: `urn:li:organization:${organizationId}`,
                    timeIntervals: JSON.stringify({
                        timeRange: {
                            start: new Date(startDate).getTime(),
                            end: new Date(endDate).getTime(),
                        },
                        timeGranularityType: inputs.granularity || 'DAY',
                    }),
                });
                const res = await fetch(`${baseUrl}/organizationalEntityShareStatistics?${params.toString()}`, { headers });
                if (!res.ok) return { error: await res.text() };
                return { output: await res.json() };
            }

            case 'getFollowerStatistics': {
                const organizationId = inputs.organizationId;
                const params = new URLSearchParams({
                    q: 'organizationalEntity',
                    organizationalEntity: `urn:li:organization:${organizationId}`,
                });
                const res = await fetch(`${baseUrl}/organizationalEntityFollowerStatistics?${params.toString()}`, { headers });
                if (!res.ok) return { error: await res.text() };
                return { output: await res.json() };
            }

            case 'listPosts': {
                const organizationId = inputs.organizationId;
                const count = inputs.count || 20;
                const params = new URLSearchParams({
                    q: 'author',
                    author: `urn:li:organization:${organizationId}`,
                    count: String(count),
                });
                if (inputs.start) params.append('start', String(inputs.start));
                const res = await fetch(`${baseUrl}/ugcPosts?${params.toString()}`, { headers });
                if (!res.ok) return { error: await res.text() };
                return { output: await res.json() };
            }

            case 'getPost': {
                const postId = inputs.postId;
                const res = await fetch(`${baseUrl}/ugcPosts/${encodeURIComponent(postId)}`, { headers });
                if (!res.ok) return { error: await res.text() };
                return { output: { post: await res.json() } };
            }

            case 'createPost': {
                const organizationId = inputs.organizationId;
                const body: any = {
                    author: `urn:li:organization:${organizationId}`,
                    lifecycleState: 'PUBLISHED',
                    specificContent: {
                        'com.linkedin.ugc.ShareContent': {
                            shareCommentary: {
                                text: inputs.text || '',
                            },
                            shareMediaCategory: inputs.mediaCategory || 'NONE',
                        },
                    },
                    visibility: {
                        'com.linkedin.ugc.MemberNetworkVisibility': inputs.visibility || 'PUBLIC',
                    },
                };
                if (inputs.media) {
                    body.specificContent['com.linkedin.ugc.ShareContent'].media = inputs.media;
                }
                const res = await fetch(`${baseUrl}/ugcPosts`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                if (!res.ok) return { error: await res.text() };
                return { output: { post: await res.json() } };
            }

            case 'deletePost': {
                const postId = inputs.postId;
                const res = await fetch(`${baseUrl}/ugcPosts/${encodeURIComponent(postId)}`, {
                    method: 'DELETE',
                    headers,
                });
                if (!res.ok) return { error: await res.text() };
                return { output: { success: true, postId } };
            }

            case 'getPostAnalytics': {
                const postUrn = inputs.postUrn || inputs.postId;
                const params = new URLSearchParams({
                    q: 'organizationalEntity',
                    ugcPosts: postUrn,
                });
                const res = await fetch(`${baseUrl}/organizationalEntityShareStatistics?${params.toString()}`, { headers });
                if (!res.ok) return { error: await res.text() };
                return { output: await res.json() };
            }

            case 'getAdAccounts': {
                const params = new URLSearchParams({
                    q: 'search',
                    'search.status.values[0]': inputs.status || 'ACTIVE',
                });
                if (inputs.count) params.append('count', String(inputs.count));
                const res = await fetch(`${baseUrl}/adAccountsV2?${params.toString()}`, { headers });
                if (!res.ok) return { error: await res.text() };
                return { output: await res.json() };
            }

            case 'getCampaigns': {
                const adAccountId = inputs.adAccountId;
                const params = new URLSearchParams({
                    q: 'search',
                    'search.account.values[0]': `urn:li:sponsoredAccount:${adAccountId}`,
                });
                if (inputs.status) params.append('search.status.values[0]', inputs.status);
                if (inputs.count) params.append('count', String(inputs.count));
                const res = await fetch(`${baseUrl}/adCampaignsV2?${params.toString()}`, { headers });
                if (!res.ok) return { error: await res.text() };
                return { output: await res.json() };
            }

            case 'getCampaignAnalytics': {
                const adAccountId = inputs.adAccountId;
                const campaignId = inputs.campaignId;
                const startDate = inputs.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                const endDate = inputs.endDate || new Date().toISOString().split('T')[0];
                const [startYear, startMonth, startDay] = startDate.split('-');
                const [endYear, endMonth, endDay] = endDate.split('-');
                const params = new URLSearchParams({
                    q: 'analytics',
                    pivot: 'CAMPAIGN',
                    dateRange: JSON.stringify({
                        start: { year: parseInt(startYear), month: parseInt(startMonth), day: parseInt(startDay) },
                        end: { year: parseInt(endYear), month: parseInt(endMonth), day: parseInt(endDay) },
                    }),
                    campaigns: `List(urn:li:sponsoredCampaign:${campaignId})`,
                    accounts: `List(urn:li:sponsoredAccount:${adAccountId})`,
                });
                const res = await fetch(`${baseUrl}/adAnalyticsV2?${params.toString()}`, { headers });
                if (!res.ok) return { error: await res.text() };
                return { output: await res.json() };
            }

            case 'getImpressionsByCountry': {
                const organizationId = inputs.organizationId;
                const params = new URLSearchParams({
                    q: 'organizationalEntity',
                    organizationalEntity: `urn:li:organization:${organizationId}`,
                    'facets[0]': 'GEO',
                });
                const res = await fetch(`${baseUrl}/organizationalEntityFollowerStatistics?${params.toString()}`, { headers });
                if (!res.ok) return { error: await res.text() };
                return { output: await res.json() };
            }

            case 'getImpressionsByFunction': {
                const organizationId = inputs.organizationId;
                const params = new URLSearchParams({
                    q: 'organizationalEntity',
                    organizationalEntity: `urn:li:organization:${organizationId}`,
                    'facets[0]': 'FUNCTION',
                });
                const res = await fetch(`${baseUrl}/organizationalEntityFollowerStatistics?${params.toString()}`, { headers });
                if (!res.ok) return { error: await res.text() };
                return { output: await res.json() };
            }

            case 'getImpressionsBySeniority': {
                const organizationId = inputs.organizationId;
                const params = new URLSearchParams({
                    q: 'organizationalEntity',
                    organizationalEntity: `urn:li:organization:${organizationId}`,
                    'facets[0]': 'SENIORITY',
                });
                const res = await fetch(`${baseUrl}/organizationalEntityFollowerStatistics?${params.toString()}`, { headers });
                if (!res.ok) return { error: await res.text() };
                return { output: await res.json() };
            }

            case 'getEngagementMetrics': {
                const organizationId = inputs.organizationId;
                const startDate = inputs.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                const endDate = inputs.endDate || new Date().toISOString().split('T')[0];
                const params = new URLSearchParams({
                    q: 'organizationalEntity',
                    organizationalEntity: `urn:li:organization:${organizationId}`,
                    timeIntervals: JSON.stringify({
                        timeRange: {
                            start: new Date(startDate).getTime(),
                            end: new Date(endDate).getTime(),
                        },
                        timeGranularityType: inputs.granularity || 'MONTH',
                    }),
                });
                const res = await fetch(`${baseUrl}/organizationalEntityShareStatistics?${params.toString()}`, { headers });
                if (!res.ok) return { error: await res.text() };
                return { output: await res.json() };
            }

            default:
                return { error: `Unknown LinkedIn Analytics action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`LinkedIn Analytics action error: ${err.message}`);
        return { error: err.message || 'LinkedIn Analytics action failed' };
    }
}
